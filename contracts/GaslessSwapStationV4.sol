// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// Uniswap V3 Router interface
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
    
    function refundETH() external payable;
    
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;
}

// WETH interface
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GaslessSwapStationV4
 * @dev Gasless token swapping using Uniswap V3 (much simpler and more reliable)
 */
contract GaslessSwapStationV4 is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Uniswap V3 Router on Arbitrum
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    // WETH on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    // ETH placeholder address
    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Common Uniswap V3 fee tiers
    uint24 public constant FEE_LOW = 500;    // 0.05%
    uint24 public constant FEE_MEDIUM = 3000; // 0.3%
    uint24 public constant FEE_HIGH = 10000;  // 1%

    // Fee configuration
    uint256 public feePercent = 10; // 0.1% fee
    uint256 public maxGasPrice = 20 gwei; // Increased for Arbitrum
    
    // User nonces for replay protection
    mapping(address => uint256) public userNonces;
    
    // Fee collection
    mapping(address => uint256) public collectedFees;
    
    // Emergency pause
    bool public paused = false;
    
    // EIP-712 type hash
    bytes32 public constant GASLESS_SWAP_TYPEHASH = keccak256(
        "GaslessSwap(address user,address fromToken,address toToken,uint256 fromAmount,uint256 minToAmount,uint256 deadline,uint256 nonce)"
    );

    // Events
    event GaslessSwapExecuted(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 gasFeePaid,
        string swapMethod
    );
    
    event MetaTransactionExecuted(
        address indexed user,
        bytes32 indexed metaTxHash,
        bool success
    );

    // Structs
    struct GaslessSwap {
        address user;
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 minToAmount;
        uint256 deadline;
        uint256 nonce;
    }

    constructor() EIP712("GaslessSwapStation", "4") Ownable(msg.sender) {
        // Constructor
    }

    receive() external payable {}

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev Execute a gasless swap using Uniswap V3
     */
    function executeGaslessSwap(
        GaslessSwap memory swap,
        bytes memory signature
    ) external payable nonReentrant whenNotPaused {
        // Verify signature and parameters
        _verifyGaslessSwap(swap, signature);
        
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        require(block.timestamp <= swap.deadline, "Swap expired");
        
        // Increment nonce
        userNonces[swap.user]++;
        
        // Calculate fee
        uint256 feeAmount = (swap.fromAmount * feePercent) / 10000;
        uint256 swapAmount = swap.fromAmount - feeAmount;
        
        uint256 outputAmount;
        string memory swapMethod;
        
        if (swap.fromToken == ETH) {
            // ETH to token swaps
            require(msg.value >= swap.fromAmount, "Insufficient ETH sent");
            (outputAmount, swapMethod) = _swapETHForToken(swap.toToken, swapAmount, swap.minToAmount, swap.user);
            collectedFees[ETH] += feeAmount;
            
        } else if (swap.toToken == ETH) {
            // Token to ETH swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForETH(swap.fromToken, swapAmount, swap.minToAmount, swap.user);
            collectedFees[swap.fromToken] += feeAmount;
            
        } else {
            // Token to token swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForToken(swap.fromToken, swap.toToken, swapAmount, swap.minToAmount, swap.user);
            collectedFees[swap.fromToken] += feeAmount;
        }
        
        emit GaslessSwapExecuted(
            swap.user,
            swap.fromToken,
            swap.toToken,
            swap.fromAmount,
            outputAmount,
            tx.gasprice * 250000,
            swapMethod
        );
        
        bytes32 metaTxHash = _hashTypedDataV4(keccak256(abi.encode(
            GASLESS_SWAP_TYPEHASH,
            swap.user,
            swap.fromToken,
            swap.toToken,
            swap.fromAmount,
            swap.minToAmount,
            swap.deadline,
            swap.nonce
        )));
        
        emit MetaTransactionExecuted(swap.user, metaTxHash, true);
    }

    /**
     * @dev Swap ETH for tokens using Uniswap V3
     */
    function _swapETHForToken(
        address toToken,
        uint256 ethAmount,
        uint256 minTokenAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        if (toToken == WETH) {
            // ETH to WETH: Direct conversion
            IWETH(WETH).deposit{value: ethAmount}();
            IERC20(WETH).safeTransfer(recipient, ethAmount);
            return (ethAmount, "eth_to_weth_direct");
        }
        
        // ETH to Token via Uniswap V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: toToken,
            fee: FEE_MEDIUM, // Try 0.3% fee tier first
            recipient: recipient,
            deadline: block.timestamp + 300,
            amountIn: ethAmount,
            amountOutMinimum: minTokenAmount,
            sqrtPriceLimitX96: 0
        });
        
        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle{value: ethAmount}(params) returns (uint256 amountOut) {
            return (amountOut, "uniswap_v3_medium_fee");
        } catch {
            // Try with high fee tier (1%)
            params.fee = FEE_HIGH;
            try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle{value: ethAmount}(params) returns (uint256 amountOut) {
                return (amountOut, "uniswap_v3_high_fee");
            } catch {
                // Try with low fee tier (0.05%)
                params.fee = FEE_LOW;
                try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle{value: ethAmount}(params) returns (uint256 amountOut) {
                    return (amountOut, "uniswap_v3_low_fee");
                } catch {
                    revert("No Uniswap V3 liquidity available for ETH to token");
                }
            }
        }
    }

    /**
     * @dev Swap tokens for ETH using Uniswap V3
     */
    function _swapTokenForETH(
        address fromToken,
        uint256 tokenAmount,
        uint256 minETHAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        if (fromToken == WETH) {
            // WETH to ETH: Direct conversion
            IWETH(WETH).withdraw(tokenAmount);
            payable(recipient).transfer(tokenAmount);
            return (tokenAmount, "weth_to_eth_direct");
        }
        
        // Approve Uniswap V3 Router
        IERC20(fromToken).forceApprove(UNISWAP_V3_ROUTER, tokenAmount);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: fromToken,
            tokenOut: WETH,
            fee: FEE_MEDIUM,
            recipient: address(this), // Receive WETH first
            deadline: block.timestamp + 300,
            amountIn: tokenAmount,
            amountOutMinimum: minETHAmount,
            sqrtPriceLimitX96: 0
        });
        
        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
            // Convert WETH to ETH and send to recipient
            IWETH(WETH).withdraw(amountOut);
            payable(recipient).transfer(amountOut);
            return (amountOut, "uniswap_v3_medium_fee");
        } catch {
            // Try high fee tier
            params.fee = FEE_HIGH;
            try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
                IWETH(WETH).withdraw(amountOut);
                payable(recipient).transfer(amountOut);
                return (amountOut, "uniswap_v3_high_fee");
            } catch {
                // Try low fee tier
                params.fee = FEE_LOW;
                try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
                    IWETH(WETH).withdraw(amountOut);
                    payable(recipient).transfer(amountOut);
                    return (amountOut, "uniswap_v3_low_fee");
                } catch {
                    // Reset approval
                    IERC20(fromToken).forceApprove(UNISWAP_V3_ROUTER, 0);
                    revert("No Uniswap V3 liquidity available for token to ETH");
                }
            }
        }
    }

    /**
     * @dev Swap tokens for tokens using Uniswap V3
     */
    function _swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        IERC20(fromToken).forceApprove(UNISWAP_V3_ROUTER, fromAmount);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: fromToken,
            tokenOut: toToken,
            fee: FEE_MEDIUM,
            recipient: recipient,
            deadline: block.timestamp + 300,
            amountIn: fromAmount,
            amountOutMinimum: minToAmount,
            sqrtPriceLimitX96: 0
        });
        
        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
            return (amountOut, "uniswap_v3_medium_fee");
        } catch {
            params.fee = FEE_HIGH;
            try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
                return (amountOut, "uniswap_v3_high_fee");
            } catch {
                params.fee = FEE_LOW;
                try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 amountOut) {
                    return (amountOut, "uniswap_v3_low_fee");
                } catch {
                    IERC20(fromToken).forceApprove(UNISWAP_V3_ROUTER, 0);
                    revert("No Uniswap V3 liquidity available for token pair");
                }
            }
        }
    }

    function _verifyGaslessSwap(GaslessSwap memory swap, bytes memory signature) private view {
        require(swap.nonce == userNonces[swap.user], "Invalid nonce");
        
        bytes32 structHash = keccak256(abi.encode(
            GASLESS_SWAP_TYPEHASH,
            swap.user,
            swap.fromToken,
            swap.toToken,
            swap.fromAmount,
            swap.minToAmount,
            swap.deadline,
            swap.nonce
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == swap.user, "Invalid signature");
    }

    // Admin functions
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function updateFeePercent(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 500, "Fee too high");
        feePercent = newFeePercent;
    }

    function updateMaxGasPrice(uint256 newMaxGasPrice) external onlyOwner {
        maxGasPrice = newMaxGasPrice;
    }

    function withdrawFees(address token) external onlyOwner {
        uint256 amount = collectedFees[token];
        require(amount > 0, "No fees to withdraw");
        collectedFees[token] = 0;
        
        if (token == ETH) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function version() external pure returns (string memory) {
        return "4.0.0-uniswap-v3";
    }
}