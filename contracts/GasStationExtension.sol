// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IFlashLoanReceiver.sol";
import "./interfaces/IWETH.sol";
import "./SepoliaConfig.sol";

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
    
    struct FlashLoanParams {
        bytes32 orderHash1;
        bytes32 orderHash2;
        address maker1;
        address maker2;
        address token1; // Token that maker1 is offering
        address token2; // Token that maker2 is offering
        uint256 estimatedGasUsed;
        bool useNativeETH; // True if dealing with native ETH instead of WETH
    }
    
    /**
     * @dev Constructor with optional custom configuration
     * @param _aavePool Custom Aave pool address (use address(0) for Sepolia default)
     * @param _weth Custom WETH address (use address(0) for Sepolia default)
     */
    constructor(address _aavePool, address _weth) Ownable(msg.sender) {
        // Use ternary operators to initialize immutable variables
        AAVE_POOL = IPool(_aavePool == address(0) ? SepoliaConfig.AAVE_POOL : _aavePool);
        WETH = _weth == address(0) ? SepoliaConfig.WETH : _weth;
        
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
     * @dev Initiate flash loan for gasless swap execution
     * @param orderHash1 First order hash
     * @param orderHash2 Second order hash (counterpart)
     * @param maker1 First order maker address
     * @param maker2 Second order maker address
     * @param token1 Token that maker1 is offering (use address(0) for native ETH)
     * @param token2 Token that maker2 is offering (use address(0) for native ETH)
     * @param estimatedGasUsed Estimated gas for both swaps
     */
    function initiateFlashLoanSwap(
        bytes32 orderHash1,
        bytes32 orderHash2,
        address maker1,
        address maker2,
        address token1,
        address token2,
        uint256 estimatedGasUsed
    ) external onlyOwner nonReentrant {
        require(isOrderPairReady(orderHash1), "Order pair not ready");
        require(orderPairs[orderHash1] == orderHash2, "Invalid order pair");
        require(maker1 != address(0) && maker2 != address(0), "Invalid maker addresses");
        require(estimatedGasUsed > 0, "Invalid gas estimate");
        
        // Validate tokens are supported
        require(_isValidToken(token1), "Token1 not supported");
        require(_isValidToken(token2), "Token2 not supported");
        
        bytes32 batchId = keccak256(abi.encodePacked(orderHash1, orderHash2, block.timestamp));
        require(!flashLoanActive[batchId], "Flash loan already active for this batch");
        
        // Calculate required ETH for gas
        uint256 requiredEth = estimatedGasUsed * tx.gasprice;
        require(requiredEth > 0, "Cannot calculate gas cost");
        
        // Mark flash loan as active
        flashLoanActive[batchId] = true;
        
        // Determine if we need to handle native ETH
        bool useNativeETH = SepoliaConfig.isNativeETH(token1) || SepoliaConfig.isNativeETH(token2);
        
        // Prepare flash loan parameters
        FlashLoanParams memory params = FlashLoanParams({
            orderHash1: orderHash1,
            orderHash2: orderHash2,
            maker1: maker1,
            maker2: maker2,
            token1: token1,
            token2: token2,
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
        
        // TODO: Execute the actual swaps here (will be implemented in next feature)
        // For now, just emit an event to track execution with token info
        emit FeesCollected(flashParams.token1, amounts[0]);
        emit FeesCollected(flashParams.token2, amounts[0]);
        
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
        if (SepoliaConfig.isNativeETH(token)) {
            return true;
        }
        
        // Allow WETH (both Sepolia config and current contract WETH)
        if (token == WETH || token == SepoliaConfig.WETH) {
            return true;
        }
        
        // Allow other Sepolia supported assets
        return SepoliaConfig.isSupportedAsset(token);
    }
    
    /**
     * @dev Get supported tokens for gasless swaps
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() external pure returns (address[] memory tokens) {
        address[] memory configTokens = SepoliaConfig.getSupportedTokens();
        tokens = new address[](configTokens.length + 1);
        
        // Add native ETH (address(0)) as first option
        tokens[0] = SepoliaConfig.getNativeETH();
        
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
        
        if (SepoliaConfig.isNativeETH(token)) {
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(recipient).transfer(amount);
        } else {
            require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient token balance");
            IERC20(token).transfer(recipient, amount);
        }
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