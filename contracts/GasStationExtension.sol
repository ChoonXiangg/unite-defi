// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IFlashLoanReceiver.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/I1inchLimitOrderProtocol.sol";
import "./ArbitrumConfig.sol";

/**
 * @title GasStationExtension
 * @dev 1inch Limit Order Protocol extension for gasless swaps via flash loans
 */
contract GasStationExtension is Ownable, ReentrancyGuard, IFlashLoanReceiver {
    
    // Events
    event GasStationInitialized(address indexed owner);
    event OrderPairRegistered(bytes32 indexed orderHash1, bytes32 indexed orderHash2);
    event FlashLoanInitiated(bytes32 indexed batchId, uint256 amount);
    event FeesCollected(address indexed token, uint256 amount);
    
    // State variables
    mapping(bytes32 => bool) public registeredOrders;
    mapping(bytes32 => bytes32) public orderPairs; // orderHash => counterpartOrderHash
    mapping(bytes32 => bool) public completedPairs;
    mapping(bytes32 => bool) public flashLoanActive; // batchId => active status
    
    uint256 public constant GAS_STATION_FEE_BASIS_POINTS = 10; // 0.1%
    uint256 public constant MAX_GAS_PRICE = 50 gwei;
    
    // Flash loan configuration
    IPool public immutable AAVE_POOL;
    address public immutable WETH;
    
    // 1inch Limit Order Protocol
    I1inchLimitOrderProtocol public immutable INCH_LOP;
    
    struct FlashLoanParams {
        bytes32 orderHash1;
        bytes32 orderHash2;
        I1inchLimitOrderProtocol.Order order1;
        I1inchLimitOrderProtocol.Order order2;
        bytes signature1;
        bytes signature2;
        uint256 estimatedGasUsed;
        bool useNativeETH; // True if dealing with native ETH instead of WETH
    }
    
    /**
     * @dev Constructor with optional custom configuration
     * @param _aavePool Custom Aave pool address (use address(0) for Sepolia default)
     * @param _weth Custom WETH address (use address(0) for Sepolia default)
     */
    constructor(address _aavePool, address _weth, address _inch) Ownable(msg.sender) {
        // Use ternary operators to initialize immutable variables
        AAVE_POOL = IPool(_aavePool == address(0) ? ArbitrumConfig.AAVE_POOL : _aavePool);
        WETH = _weth == address(0) ? ArbitrumConfig.WETH : _weth;
        INCH_LOP = I1inchLimitOrderProtocol(_inch == address(0) ? ArbitrumConfig.get1inchLOP() : _inch);
        
        emit GasStationInitialized(msg.sender);
    }
    
    /**
     * @dev Register a pair of orders for gasless execution
     * @param orderHash1 First order hash
     * @param orderHash2 Second order hash (counterpart)
     */
    function registerOrderPair(bytes32 orderHash1, bytes32 orderHash2) external onlyOwner {
        require(!registeredOrders[orderHash1], "Order1 already registered");
        require(!registeredOrders[orderHash2], "Order2 already registered");
        require(orderHash1 != orderHash2, "Cannot pair order with itself");
        
        registeredOrders[orderHash1] = true;
        registeredOrders[orderHash2] = true;
        orderPairs[orderHash1] = orderHash2;
        orderPairs[orderHash2] = orderHash1;
        
        emit OrderPairRegistered(orderHash1, orderHash2);
    }
    
    /**
     * @dev Check if an order pair is registered and ready for execution
     * @param orderHash Order hash to check
     * @return bool True if order pair is registered
     */
    function isOrderPairReady(bytes32 orderHash) public view returns (bool) {
        return registeredOrders[orderHash] && 
               registeredOrders[orderPairs[orderHash]] && 
               !completedPairs[orderHash];
    }
    
    /**
     * @dev Get the counterpart order hash for a given order
     * @param orderHash Order hash
     * @return bytes32 Counterpart order hash
     */
    function getCounterpartOrder(bytes32 orderHash) external view returns (bytes32) {
        require(registeredOrders[orderHash], "Order not registered");
        return orderPairs[orderHash];
    }
    
    /**
     * @dev Mark an order pair as completed
     * @param orderHash Order hash
     */
    function markPairCompleted(bytes32 orderHash) external onlyOwner {
        require(registeredOrders[orderHash], "Order not registered");
        bytes32 counterpartHash = orderPairs[orderHash];
        
        completedPairs[orderHash] = true;
        completedPairs[counterpartHash] = true;
    }
    
    /**
     * @dev Emergency function to reset order pair if needed
     * @param orderHash Order hash to reset
     */
    function resetOrderPair(bytes32 orderHash) external onlyOwner {
        require(registeredOrders[orderHash], "Order not registered");
        bytes32 counterpartHash = orderPairs[orderHash];
        
        registeredOrders[orderHash] = false;
        registeredOrders[counterpartHash] = false;
        completedPairs[orderHash] = false;
        completedPairs[counterpartHash] = false;
        
        delete orderPairs[orderHash];
        delete orderPairs[counterpartHash];
    }
    
    /**
     * @dev Execute paired orders with flash loan for gasless swaps
     * @param order1 First 1inch limit order
     * @param signature1 Signature for first order
     * @param order2 Second 1inch limit order
     * @param signature2 Signature for second order
     * @param estimatedGasUsed Estimated gas for both swaps
     */
    function executePairedOrders(
        I1inchLimitOrderProtocol.Order calldata order1,
        bytes calldata signature1,
        I1inchLimitOrderProtocol.Order calldata order2,
        bytes calldata signature2,
        uint256 estimatedGasUsed
    ) external onlyOwner nonReentrant {
        // Validate orders
        bytes32 orderHash1 = INCH_LOP.hashOrder(order1);
        bytes32 orderHash2 = INCH_LOP.hashOrder(order2);
        
        require(isOrderPairReady(orderHash1), "Order pair not ready");
        require(orderPairs[orderHash1] == orderHash2, "Invalid order pair");
        require(order1.maker != address(0) && order2.maker != address(0), "Invalid maker addresses");
        require(estimatedGasUsed > 0, "Invalid gas estimate");
        
        // Validate signatures
        require(INCH_LOP.isValidSignature(order1, signature1), "Invalid signature for order1");
        require(INCH_LOP.isValidSignature(order2, signature2), "Invalid signature for order2");
        
        // Validate tokens are supported
        require(_isValidToken(order1.makerAsset), "Order1 maker asset not supported");
        require(_isValidToken(order2.makerAsset), "Order2 maker asset not supported");
        
        bytes32 batchId = keccak256(abi.encodePacked(orderHash1, orderHash2, block.timestamp));
        require(!flashLoanActive[batchId], "Flash loan already active for this batch");
        
        // Calculate required ETH for gas
        uint256 requiredEth = estimatedGasUsed * tx.gasprice;
        require(requiredEth > 0, "Cannot calculate gas cost");
        
        // Mark flash loan as active
        flashLoanActive[batchId] = true;
        
        // Determine if we need to handle native ETH
        bool useNativeETH = ArbitrumConfig.isNativeETH(order1.makerAsset) || ArbitrumConfig.isNativeETH(order2.makerAsset);
        
        // Prepare flash loan parameters
        FlashLoanParams memory params = FlashLoanParams({
            orderHash1: orderHash1,
            orderHash2: orderHash2,
            order1: order1,
            order2: order2,
            signature1: signature1,
            signature2: signature2,
            estimatedGasUsed: estimatedGasUsed,
            useNativeETH: useNativeETH
        });
        
        // Setup flash loan
        address[] memory assets = new address[](1);
        assets[0] = WETH;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = requiredEth;
        
        uint256[] memory interestRateModes = new uint256[](1);
        interestRateModes[0] = 0; // No debt, pay back in same transaction
        
        emit FlashLoanInitiated(batchId, requiredEth);
        
        // Execute flash loan
        AAVE_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            interestRateModes,
            address(this),
            abi.encode(params),
            0 // no referral code
        );
    }
    
    /**
     * @dev Called by Aave after receiving the flash loan
     * @param assets The addresses of the flash-borrowed assets
     * @param amounts The amounts of the flash-borrowed assets
     * @param premiums The fees of the flash-borrowed assets
     * @param initiator The address of the flashloan initiator
     * @param params The encoded parameters passed to the flashloan
     * @return True if the execution succeeds
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(AAVE_POOL), "Caller must be Aave Pool");
        require(initiator == address(this), "Invalid flash loan initiator");
        require(assets.length == 1 && assets[0] == WETH, "Invalid flash loan asset");
        
        FlashLoanParams memory flashParams = abi.decode(params, (FlashLoanParams));
        
        // Handle native ETH conversion if needed
        if (flashParams.useNativeETH) {
            // Unwrap WETH to ETH for native ETH operations
            IWETH(assets[0]).withdraw(amounts[0]);
        }
        
        // Execute both 1inch limit orders atomically
        try this._executeBothOrders(flashParams) {
            // Orders executed successfully
            emit FeesCollected(flashParams.order1.makerAsset, amounts[0]);
            emit FeesCollected(flashParams.order2.makerAsset, amounts[0]);
        } catch Error(string memory reason) {
            // If orders fail, we still need to repay the flash loan
            // This would typically revert the entire transaction
            revert(string(abi.encodePacked("Order execution failed: ", reason)));
        }
        
        // Handle native ETH conversion back if needed
        if (flashParams.useNativeETH) {
            // Wrap ETH back to WETH for repayment
            IWETH(assets[0]).deposit{value: amounts[0] + premiums[0]}();
        }
        
        // Calculate total amount to repay (borrowed amount + premium)
        uint256 amountToRepay = amounts[0] + premiums[0];
        
        // Approve Aave Pool to pull the repayment
        IERC20(assets[0]).approve(address(AAVE_POOL), amountToRepay);
        
        // Mark flash loan as completed
        bytes32 batchId = keccak256(abi.encodePacked(
            flashParams.orderHash1, 
            flashParams.orderHash2, 
            block.timestamp
        ));
        flashLoanActive[batchId] = false;
        
        return true;
    }
    
    /**
     * @dev Internal function to execute both 1inch orders
     * @param params Flash loan parameters containing both orders
     */
    function _executeBothOrders(FlashLoanParams memory params) external {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Execute first order
        (uint256 actualMaking1, uint256 actualTaking1) = INCH_LOP.fillOrder(
            params.order1,
            params.signature1,
            bytes(""), // No interaction data
            params.order1.makingAmount,
            params.order1.takingAmount,
            0 // No skip permit
        );
        
        // Execute second order
        (uint256 actualMaking2, uint256 actualTaking2) = INCH_LOP.fillOrder(
            params.order2,
            params.signature2,
            bytes(""), // No interaction data
            params.order2.makingAmount,
            params.order2.takingAmount,
            0 // No skip permit
        );
        
        // Verify orders were filled as expected
        require(actualMaking1 > 0 && actualTaking1 > 0, "Order1 execution failed");
        require(actualMaking2 > 0 && actualTaking2 > 0, "Order2 execution failed");
        
        // Mark order pair as completed
        completedPairs[params.orderHash1] = true;
        completedPairs[params.orderHash2] = true;
    }

    /**
     * @dev Check if flash loan is active for a batch
     * @param batchId Batch identifier
     * @return bool True if flash loan is active
     */
    function isFlashLoanActive(bytes32 batchId) external view returns (bool) {
        return flashLoanActive[batchId];
    }
    
    /**
     * @dev Estimate gas cost for a swap pair
     * @param gasPrice Gas price in wei
     * @param gasLimit Estimated gas limit
     * @return uint256 Estimated cost in wei
     */
    function estimateGasCost(uint256 gasPrice, uint256 gasLimit) external pure returns (uint256) {
        return gasPrice * gasLimit;
    }
    
    /**
     * @dev Emergency function to reset flash loan state
     * @param batchId Batch identifier to reset
     */
    function resetFlashLoanState(bytes32 batchId) external onlyOwner {
        flashLoanActive[batchId] = false;
    }
    
    /**
     * @dev Check if a token is valid for flash loan operations
     * @param token Token address to validate (address(0) for native ETH)
     * @return bool True if token is supported
     */
    function _isValidToken(address token) internal view returns (bool) {
        // Allow native ETH
        if (ArbitrumConfig.isNativeETH(token)) {
            return true;
        }
        
        // Allow WETH (both Arbitrum config and current contract WETH)
        if (token == WETH || token == ArbitrumConfig.WETH) {
            return true;
        }
        
        // Allow other Arbitrum supported assets
        return ArbitrumConfig.isSupportedAsset(token);
    }
    
    /**
     * @dev Get supported tokens for gasless swaps
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() external pure returns (address[] memory tokens) {
        address[] memory configTokens = ArbitrumConfig.getSupportedTokens();
        tokens = new address[](configTokens.length + 1);
        
        // Add native ETH (address(0)) as first option
        tokens[0] = ArbitrumConfig.getNativeETH();
        
        // Add all ERC20 tokens from config
        for (uint i = 0; i < configTokens.length; i++) {
            tokens[i + 1] = configTokens[i];
        }
    }
    
    /**
     * @dev Check if a token is supported
     * @param token Token address to check
     * @return bool True if token is supported
     */
    function isTokenSupported(address token) external view returns (bool) {
        return _isValidToken(token);
    }
    
    /**
     * @dev Get WETH address used by the contract
     * @return address WETH contract address
     */
    function getWETH() external view returns (address) {
        return WETH;
    }
    
    /**
     * @dev Get Aave Pool address used by the contract
     * @return address Aave Pool contract address
     */
    function getAavePool() external view returns (address) {
        return address(AAVE_POOL);
    }
    
    /**
     * @dev Emergency function to rescue tokens sent to contract
     * @param token Token address (use address(0) for ETH)
     * @param amount Amount to rescue
     * @param recipient Recipient address
     */
    function rescueTokens(address token, uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        
        if (ArbitrumConfig.isNativeETH(token)) {
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(recipient).transfer(amount);
        } else {
            require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient token balance");
            IERC20(token).transfer(recipient, amount);
        }
    }
    
    /**
     * @dev Validate a 1inch limit order
     * @param order Order to validate
     * @param signature Order signature
     * @return bool True if order is valid
     */
    function validateOrder(
        I1inchLimitOrderProtocol.Order calldata order,
        bytes calldata signature
    ) external view returns (bool) {
        // Check signature validity
        if (!INCH_LOP.isValidSignature(order, signature)) {
            return false;
        }
        
        // Check if order has remaining amount
        bytes32 orderHash = INCH_LOP.hashOrder(order);
        if (INCH_LOP.remaining(orderHash) == 0) {
            return false;
        }
        
        // Check if assets are supported
        if (!_isValidToken(order.makerAsset) || !_isValidToken(order.takerAsset)) {
            return false;
        }
        
        // Check predicate if exists
        if (!INCH_LOP.checkPredicate(order)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Get 1inch Limit Order Protocol address
     * @return address 1inch LOP contract address
     */
    function get1inchLOP() external view returns (address) {
        return address(INCH_LOP);
    }

    /**
     * @dev Get contract version for upgrades
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.2.0";
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}