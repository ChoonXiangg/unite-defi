// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// 1inch Router v5 interface (simplified)
interface IOneInchRouter {
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
    
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }
    
    function unoswap(
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256 dexs
    ) external payable returns (uint256 returnAmount);
}

// WETH interface
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GaslessSwapStationV3
 * @dev Production-ready gasless token swapping with real 1inch integration
 */
contract GaslessSwapStationV3 is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // 1inch Router v5 on Arbitrum  
    address public constant INCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    // WETH on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    // ETH placeholder address
    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Fee configuration
    uint256 public feePercent = 10; // 0.1% fee (10 basis points)
    uint256 public maxGasPrice = 10 gwei;
    
    // User nonces for replay protection
    mapping(address => uint256) public userNonces;
    
    // Fee collection
    mapping(address => uint256) public collectedFees;
    
    // Emergency pause
    bool public paused = false;
    
    // EIP-712 type hash for gasless swaps
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
    
    event SwapDataReceived(bytes swapData, uint256 dataLength);
    event EmergencyPause(bool paused);

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

    constructor() EIP712("GaslessSwapStation", "3") Ownable(msg.sender) {
        // Constructor
    }

    receive() external payable {
        // Allow contract to receive ETH
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev Execute a gasless swap using meta-transaction
     */
    function executeGaslessSwap(
        GaslessSwap memory swap,
        bytes memory signature
    ) external payable nonReentrant whenNotPaused {
        // Verify signature and swap parameters
        _verifyGaslessSwap(swap, signature);
        
        // Check gas price limit
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        
        // Check deadline
        require(block.timestamp <= swap.deadline, "Swap expired");
        
        // Increment nonce to prevent replay
        userNonces[swap.user]++;
        
        // Calculate fee
        uint256 feeAmount = (swap.fromAmount * feePercent) / 10000;
        uint256 swapAmount = swap.fromAmount - feeAmount;
        
        // Execute the swap based on token types
        uint256 outputAmount;
        string memory swapMethod;
        
        if (swap.fromToken == ETH) {
            // ETH to token swaps
            require(msg.value >= swap.fromAmount, "Insufficient ETH sent");
            (outputAmount, swapMethod) = _swapETHForToken(swap.toToken, swapAmount, swap.minToAmount, swap.user);
            
            // Collect ETH fee
            if (feeAmount > 0) {
                collectedFees[ETH] += feeAmount;
            }
            
        } else if (swap.toToken == ETH) {
            // Token to ETH swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForETH(swap.fromToken, swapAmount, swap.minToAmount, swap.user);
            
            // Collect token fee
            if (feeAmount > 0) {
                collectedFees[swap.fromToken] += feeAmount;
            }
            
        } else {
            // Token to token swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForToken(swap.fromToken, swap.toToken, swapAmount, swap.minToAmount, swap.user);
            
            // Collect input token fee
            if (feeAmount > 0) {
                collectedFees[swap.fromToken] += feeAmount;
            }
        }
        
        // Calculate gas fee
        uint256 gasFeePaid = tx.gasprice * 200000; // Estimate
        
        emit GaslessSwapExecuted(
            swap.user,
            swap.fromToken,
            swap.toToken,
            swap.fromAmount,
            outputAmount,
            gasFeePaid,
            swapMethod
        );
        
        // Calculate meta-transaction hash
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
     * @dev Execute swap with external swap data (for real 1inch integration)
     */
    function executeSwapWithData(
        GaslessSwap memory swap,
        bytes memory signature,
        bytes memory swapData
    ) external payable nonReentrant whenNotPaused {
        // Verify signature
        _verifyGaslessSwap(swap, signature);
        require(block.timestamp <= swap.deadline, "Swap expired");
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        
        // Increment nonce
        userNonces[swap.user]++;
        
        emit SwapDataReceived(swapData, swapData.length);
        
        // Calculate fee
        uint256 feeAmount = (swap.fromAmount * feePercent) / 10000;
        uint256 swapAmount = swap.fromAmount - feeAmount;
        
        uint256 outputAmount;
        
        if (swap.fromToken == ETH) {
            require(msg.value >= swap.fromAmount, "Insufficient ETH sent");
            
            // Call 1inch router with swap data
            (bool success, bytes memory result) = INCH_ROUTER.call{value: swapAmount}(swapData);
            require(success, "1inch swap failed");
            
            // Decode return amount (first 32 bytes of result)
            if (result.length >= 32) {
                outputAmount = abi.decode(result, (uint256));
            }
            
            collectedFees[ETH] += feeAmount;
            
        } else {
            // Transfer tokens from user
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            
            // Approve 1inch router
            IERC20(swap.fromToken).forceApprove(INCH_ROUTER, swapAmount);
            
            // Call 1inch router
            (bool success, bytes memory result) = INCH_ROUTER.call(swapData);
            require(success, "1inch swap failed");
            
            // Decode return amount
            if (result.length >= 32) {
                outputAmount = abi.decode(result, (uint256));
            }
            
            // Reset approval
            IERC20(swap.fromToken).forceApprove(INCH_ROUTER, 0);
            
            // Transfer output to user
            if (swap.toToken == ETH) {
                payable(swap.user).transfer(outputAmount);
            } else {
                IERC20(swap.toToken).safeTransfer(swap.user, outputAmount);
            }
            
            collectedFees[swap.fromToken] += feeAmount;
        }
        
        require(outputAmount >= swap.minToAmount, "Insufficient output amount");
        
        emit GaslessSwapExecuted(
            swap.user,
            swap.fromToken,
            swap.toToken,
            swap.fromAmount,
            outputAmount,
            tx.gasprice * 250000,
            "1inch_custom_data"
        );
    }

    /**
     * @dev Simple ETH to token swap using basic liquidity
     */
    function _swapETHForToken(
        address toToken,
        uint256 ethAmount,
        uint256 minTokenAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        if (toToken == WETH) {
            // ETH to WETH: 1:1 conversion
            IWETH(WETH).deposit{value: ethAmount}();
            IERC20(WETH).safeTransfer(recipient, ethAmount);
            return (ethAmount, "eth_to_weth");
        } else {
            // For other tokens, try simplified 1inch unoswap
            try IOneInchRouter(INCH_ROUTER).unoswap{value: ethAmount}(
                ETH,
                ethAmount,
                minTokenAmount,
                0x80000000 // Default DEX flags
            ) returns (uint256 amount) {
                // Transfer tokens to user
                IERC20(toToken).safeTransfer(recipient, amount);
                return (amount, "1inch_unoswap");
            } catch {
                revert("No liquidity for this token pair");
            }
        }
    }

    /**
     * @dev Simple token to ETH swap
     */
    function _swapTokenForETH(
        address fromToken,
        uint256 tokenAmount,
        uint256 minETHAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        if (fromToken == WETH) {
            // WETH to ETH: 1:1 conversion
            IWETH(WETH).withdraw(tokenAmount);
            payable(recipient).transfer(tokenAmount);
            return (tokenAmount, "weth_to_eth");
        } else {
            // For other tokens, try 1inch unoswap
            IERC20(fromToken).forceApprove(INCH_ROUTER, tokenAmount);
            
            try IOneInchRouter(INCH_ROUTER).unoswap(
                fromToken,
                tokenAmount,
                minETHAmount,
                0x80000000
            ) returns (uint256 amount) {
                // Transfer ETH to user
                payable(recipient).transfer(amount);
                return (amount, "1inch_unoswap");
            } catch {
                IERC20(fromToken).forceApprove(INCH_ROUTER, 0);
                revert("No liquidity for this token pair");
            }
        }
    }

    /**
     * @dev Simple token to token swap
     */
    function _swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount,
        address recipient
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        // Approve 1inch router
        IERC20(fromToken).forceApprove(INCH_ROUTER, fromAmount);
        
        try IOneInchRouter(INCH_ROUTER).unoswap(
            fromToken,
            fromAmount,
            minToAmount,
            0x80000000
        ) returns (uint256 amount) {
            // Transfer output tokens to user
            IERC20(toToken).safeTransfer(recipient, amount);
            return (amount, "1inch_unoswap");
        } catch {
            IERC20(fromToken).forceApprove(INCH_ROUTER, 0);
            revert("No liquidity for this token pair");
        }
    }

    /**
     * @dev Verify gasless swap signature
     */
    function _verifyGaslessSwap(
        GaslessSwap memory swap,
        bytes memory signature
    ) private view {
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

    /**
     * @dev Emergency pause (only owner)
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    /**
     * @dev Update fee percentage (only owner)
     */
    function updateFeePercent(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 500, "Fee too high"); // Max 5%
        feePercent = newFeePercent;
    }

    /**
     * @dev Update max gas price (only owner)
     */
    function updateMaxGasPrice(uint256 newMaxGasPrice) external onlyOwner {
        maxGasPrice = newMaxGasPrice;
    }

    /**
     * @dev Withdraw collected fees (only owner)
     */
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

    /**
     * @dev Get domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "3.0.0-production-1inch";
    }
}