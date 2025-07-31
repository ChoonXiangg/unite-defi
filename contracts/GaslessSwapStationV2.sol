// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// 1inch Router interface
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
}

// 1inch LOP interface (simplified)
interface IOneInchLOP {
    function fillOrder(
        bytes calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount);
}

// WETH interface
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GaslessSwapStationV2
 * @dev Gasless token swapping using 1inch Limit Order Protocol and liquidity pools
 * @notice Enables users to perform gasless swaps by having relayers execute transactions
 */
contract GaslessSwapStationV2 is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // 1inch Limit Order Protocol on Arbitrum
    address public constant INCH_LOP = 0x111111125421cA6dc452d289314280a0f8842A65;
    
    // 1inch Router v5 on Arbitrum  
    address public constant INCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    // WETH on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    // ETH placeholder address
    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Fee configuration
    uint256 public feePercent = 10; // 0.1% fee (10 basis points)
    uint256 public maxGasPrice = 10 gwei; // Maximum gas price for gasless transactions
    
    // User nonces for replay protection
    mapping(address => uint256) public userNonces;
    
    // Fee collection
    mapping(address => uint256) public collectedFees;
    
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
    
    event FeeUpdated(uint256 newFeePercent);
    event MaxGasPriceUpdated(uint256 newMaxGasPrice);
    event FeesWithdrawn(address indexed token, uint256 amount);

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


    constructor() EIP712("GaslessSwapStation", "2") Ownable(msg.sender) {
        // Constructor inherits from EIP712 and Ownable
    }

    receive() external payable {
        // Allow contract to receive ETH
    }

    /**
     * @dev Execute a gasless swap using meta-transaction
     * @param swap The swap parameters
     * @param signature EIP-712 signature from the user
     */
    function executeGaslessSwap(
        GaslessSwap memory swap,
        bytes memory signature
    ) external payable nonReentrant {
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
        
        // Execute the swap
        uint256 outputAmount;
        string memory swapMethod;
        
        if (swap.fromToken == ETH) {
            // Handle ETH to token swaps
            require(msg.value >= swap.fromAmount, "Insufficient ETH sent");
            (outputAmount, swapMethod) = _swapETHForToken(swap.toToken, swapAmount, swap.minToAmount);
            
            // Collect ETH fee
            if (feeAmount > 0) {
                collectedFees[ETH] += feeAmount;
            }
            
        } else if (swap.toToken == ETH) {
            // Handle token to ETH swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForETH(swap.fromToken, swapAmount, swap.minToAmount);
            
            // Transfer ETH to user
            payable(swap.user).transfer(outputAmount);
            
            // Collect token fee
            if (feeAmount > 0) {
                collectedFees[swap.fromToken] += feeAmount;
            }
            
        } else {
            // Handle token to token swaps
            IERC20(swap.fromToken).safeTransferFrom(swap.user, address(this), swap.fromAmount);
            (outputAmount, swapMethod) = _swapTokenForToken(swap.fromToken, swap.toToken, swapAmount, swap.minToAmount);
            
            // Transfer output tokens to user
            IERC20(swap.toToken).safeTransfer(swap.user, outputAmount);
            
            // Collect input token fee
            if (feeAmount > 0) {
                collectedFees[swap.fromToken] += feeAmount;
            }
        }
        
        // Calculate gas fee (simple estimation)
        uint256 gasFeePaid = tx.gasprice * gasleft();
        
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
     * @dev Swap ETH for tokens using 1inch
     */
    function _swapETHForToken(
        address toToken,
        uint256 ethAmount,
        uint256 minTokenAmount
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        // First try 1inch Router
        try this._tryOneInchRouter{value: ethAmount}(ETH, toToken, ethAmount, minTokenAmount) returns (uint256 amount) {
            return (amount, "1inch_router");
        } catch {
            // Fallback: Try 1inch LOP (would need more complex implementation)
            // For now, revert with meaningful error
            revert("Swap failed: No liquidity available");
        }
    }

    /**
     * @dev Swap tokens for ETH using 1inch
     */
    function _swapTokenForETH(
        address fromToken,
        uint256 tokenAmount,
        uint256 minETHAmount
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        // Approve 1inch router
        IERC20(fromToken).forceApprove(INCH_ROUTER, tokenAmount);
        
        // First try 1inch Router
        try this._tryOneInchRouter(fromToken, ETH, tokenAmount, minETHAmount) returns (uint256 amount) {
            return (amount, "1inch_router");
        } catch {
            // Reset approval
            IERC20(fromToken).forceApprove(INCH_ROUTER, 0);
            revert("Swap failed: No liquidity available");
        }
    }

    /**
     * @dev Swap tokens for tokens using 1inch
     */
    function _swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount
    ) private returns (uint256 outputAmount, string memory swapMethod) {
        // Approve 1inch router
        IERC20(fromToken).forceApprove(INCH_ROUTER, fromAmount);
        
        // First try 1inch Router
        try this._tryOneInchRouter(fromToken, toToken, fromAmount, minToAmount) returns (uint256 amount) {
            return (amount, "1inch_router");
        } catch {
            // Reset approval
            IERC20(fromToken).forceApprove(INCH_ROUTER, 0);
            revert("Swap failed: No liquidity available");
        }
    }

    /**
     * @dev Try to execute swap via 1inch Router (external call for try/catch)
     */
    function _tryOneInchRouter(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 /* minReturn */
    ) external payable returns (uint256) {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // This is a simplified implementation
        // In a real implementation, you'd need to:
        // 1. Get swap data from 1inch API
        // 2. Call the 1inch router with proper calldata
        // 3. Handle ETH/WETH conversions
        
        // For now, simulate a basic swap calculation
        // In production, you'd integrate with actual 1inch API
        
        if (fromToken == ETH && toToken == WETH) {
            // ETH to WETH: 1:1 conversion
            IWETH(WETH).deposit{value: amount}();
            return amount;
        } else if (fromToken == WETH && toToken == ETH) {
            // WETH to ETH: 1:1 conversion
            IWETH(WETH).withdraw(amount);
            return amount;
        } else {
            // For other pairs, revert for now
            // In production, implement actual 1inch integration
            revert("Swap pair not supported in demo");
        }
    }

    /**
     * @dev Verify gasless swap signature
     */
    function _verifyGaslessSwap(
        GaslessSwap memory swap,
        bytes memory signature
    ) private view {
        // Check nonce
        require(swap.nonce == userNonces[swap.user], "Invalid nonce");
        
        // Verify signature
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
     * @dev Update fee percentage (only owner)
     */
    function updateFeePercent(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 500, "Fee too high"); // Max 5%
        feePercent = newFeePercent;
        emit FeeUpdated(newFeePercent);
    }

    /**
     * @dev Update max gas price (only owner)
     */
    function updateMaxGasPrice(uint256 newMaxGasPrice) external onlyOwner {
        maxGasPrice = newMaxGasPrice;
        emit MaxGasPriceUpdated(newMaxGasPrice);
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
        
        emit FeesWithdrawn(token, amount);
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
        return "2.1.0-gasless-with-1inch";
    }
}