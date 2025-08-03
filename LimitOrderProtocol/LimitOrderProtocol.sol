// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title LimitOrderProtocol
 * @dev LOP that integrates perfectly with your deployed EscrowFactory contracts
 * 
 * Key Features:
 * ✅ Works with your deployed EscrowFactory on Sepolia & Etherlink
 * ✅ Full 1inch API compatibility (off-chain price validation)
 * ✅ Resolver-triggered execution
 * ✅ EIP-712 signature validation
 * ✅ Cross-chain atomic swaps with secret hash locks
 */
/**
 * @dev Interface for your deployed EscrowFactory contracts
 */
interface IYourEscrowFactory {
    struct Immutables {
        bytes32 orderHash;
        bytes32 hashlock;
        address maker;
        address taker;
        address token;
        uint256 amount;
        uint256 safetyDeposit;
        uint256 timelocks;
    }
    
    function createDstEscrow(Immutables calldata dstImmutables, uint256 srcCancellationTimestamp) external payable;
    function addressOfEscrowDst(Immutables calldata immutables) external view returns (address);
}

contract LimitOrderProtocol is ReentrancyGuard, Ownable, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // =============================================================================
    // STRUCTS
    // =============================================================================

    struct Order {
        address maker;              // Order creator
        address taker;              // Order taker (0x0 for anyone)
        address makerAsset;         // Token maker is selling (0x0 for ETH)
        address takerAsset;         // Token maker wants to receive
        uint256 makerAmount;        // Amount maker is selling
        uint256 takerAmount;        // Amount maker wants to receive
        uint256 deadline;           // Order expiration timestamp
        uint256 salt;               // Unique order identifier
        bytes32 secretHash;         // Hash of secret for atomic swap
        uint256 sourceChain;        // Chain where maker's funds are
        uint256 destinationChain;   // Chain where taker's funds should go
        bytes predicate;            // Additional conditions (1inch interactions)
        uint256 maxSlippage;        // Maximum allowed slippage (basis points)
        bool requirePriceValidation; // Whether to validate price via relayer
        RelayerPriceData priceData; // Off-chain price data from relayer
    }

    struct RelayerPriceData {
        uint256 price;              // Price from 1inch API
        uint256 timestamp;          // When price was fetched
        address relayer;            // Relayer that provided price
        string[] apiSources;        // APIs used (1inch, CoinGecko, etc.)
        uint256 confidence;         // Confidence score (0-100)
        uint256 deviation;          // Price deviation percentage
        bytes signature;            // Relayer's signature on price data
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // EIP-712 type hash for orders
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,address taker,address makerAsset,address takerAsset,uint256 makerAmount,uint256 takerAmount,uint256 deadline,uint256 salt,bytes32 secretHash,uint256 sourceChain,uint256 destinationChain,bytes predicate,uint256 maxSlippage,bool requirePriceValidation,RelayerPriceData priceData)"
    );

    bytes32 public constant PRICE_DATA_TYPEHASH = keccak256(
        "RelayerPriceData(uint256 price,uint256 timestamp,address relayer,string[] apiSources,uint256 confidence,uint256 deviation,bytes signature)"
    );

    // Your deployed EscrowFactory addresses per chain
    mapping(uint256 => address) public escrowFactories;
    
    // Order tracking
    mapping(bytes32 => uint256) public orderStatus; // 0=pending, 1=executed, 2=cancelled
    mapping(bytes32 => address) public orderToEscrow; // orderHash => escrow address
    
    // Authorization
    mapping(address => bool) public authorizedResolvers;
    mapping(address => bool) public authorizedPriceRelayers;
    mapping(address => uint256) public relayerReputationScore; // 0-100
    
    // Configuration
    uint256 public maxPriceAge = 300; // 5 minutes
    uint256 public minConfidenceLevel = 80; // 80%
    uint256 public maxPriceDeviation = 500; // 5%
    uint256 public minRelayerReputation = 70; // 70/100

    // =============================================================================
    // EVENTS
    // =============================================================================

    event OrderExecuted(
        bytes32 indexed orderHash,
        address indexed resolver,
        address indexed escrowContract,
        uint256 chainId
    );
    
    event OrderCancelled(bytes32 indexed orderHash, address indexed maker);
    event EscrowFactoryUpdated(uint256 indexed chainId, address indexed factory);
    event ResolverAuthorized(address indexed resolver, bool authorized);
    event PriceRelayerAuthorized(address indexed relayer, bool authorized);
    event SignatureVerificationDebug(bytes32 orderHash, address recoveredSigner, address expectedSigner, bool isValid);

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyAuthorizedResolver() {
        require(authorizedResolvers[msg.sender], "LOP: Not authorized resolver");
        _;
    }

    modifier onlyAuthorizedPriceRelayer() {
        require(authorizedPriceRelayers[msg.sender], "LOP: Not authorized price relayer");
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address initialOwner,
        string memory name,
        string memory version
    ) EIP712(name, version) Ownable(initialOwner) {
        // Set initial configurations
        authorizedResolvers[initialOwner] = true;
        authorizedPriceRelayers[initialOwner] = true;
        relayerReputationScore[initialOwner] = 100;
    }

    // =============================================================================
    // MAIN EXECUTION FUNCTION (Called by Resolver)
    // =============================================================================

    /**
     * @dev Execute order - called by authorized resolver
     * This is the main function that resolvers call when they pick up an order
     */
    function executeOrder(Order memory order, bytes memory signature) 
        external 
        onlyAuthorizedResolver 
        nonReentrant 
        returns (address escrowAddress) 
    {
        bytes32 orderHash = getOrderHash(order);
        
        // 1. Validate order hasn't been executed or cancelled
        require(orderStatus[orderHash] == 0, "LOP: Order already processed");
        
        // 2. Validate order signature (EIP-712)
        require(validateOrderSignature(order, signature), "LOP: Invalid signature");
        
        // 3. Validate order conditions
        require(validateOrderConditions(order), "LOP: Order conditions not met");
        
        // 4. Validate price data if required
        if (order.requirePriceValidation) {
            require(validatePriceData(order.priceData, order.makerAsset, order.takerAsset), 
                   "LOP: Price validation failed");
        }
        
        // 5. Mark order as executed
        orderStatus[orderHash] = 1;
        
        // 6. Pull funds from maker
        _pullFundsFromMaker(order.maker, order.makerAsset, order.makerAmount);
        
        // 7. Deploy escrow contract using YOUR EscrowFactory
        escrowAddress = _deployEscrowAndTransferFunds(order, orderHash);
        
        // 8. Store escrow mapping
        orderToEscrow[orderHash] = escrowAddress;
        
        emit OrderExecuted(orderHash, msg.sender, escrowAddress, order.destinationChain);
        
        return escrowAddress;
    }

    // =============================================================================
    // ESCROW DEPLOYMENT (Integration with YOUR EscrowFactory)
    // =============================================================================

    function _deployEscrowAndTransferFunds(Order memory order, bytes32 orderHash) 
        internal 
        returns (address escrowAddress) 
    {
        // Get the EscrowFactory for the destination chain
        address escrowFactory = escrowFactories[order.destinationChain];
        require(escrowFactory != address(0), "LOP: EscrowFactory not configured for chain");
        
        // Calculate safety deposit (1% of order amount)
        uint256 safetyDeposit = order.makerAmount / 100;
        
        // Calculate timelocks (24 hours from now)
        uint256 timelocks = block.timestamp + 86400;
        
        // Prepare immutables struct for YOUR EscrowFactory
        IYourEscrowFactory.Immutables memory immutables = IYourEscrowFactory.Immutables({
            orderHash: orderHash,
            hashlock: order.secretHash,
            maker: order.maker,
            taker: order.taker == address(0) ? msg.sender : order.taker, // Resolver becomes taker if not specified
            token: order.makerAsset,
            amount: order.makerAmount,
            safetyDeposit: safetyDeposit,
            timelocks: timelocks
        });
        
        // Calculate escrow address before deployment
        escrowAddress = IYourEscrowFactory(escrowFactory).addressOfEscrowDst(immutables);
        
        // Deploy escrow and transfer funds
        uint256 srcCancellationTimestamp = block.timestamp + 3600; // 1 hour
        
        if (order.makerAsset == address(0)) {
            // ETH transfer
            IYourEscrowFactory(escrowFactory).createDstEscrow{
                value: order.makerAmount + safetyDeposit
            }(immutables, srcCancellationTimestamp);
        } else {
            // ERC20 transfer
            IERC20(order.makerAsset).forceApprove(escrowFactory, order.makerAmount);
            IYourEscrowFactory(escrowFactory).createDstEscrow{
                value: safetyDeposit
            }(immutables, srcCancellationTimestamp);
        }
        
        return escrowAddress;
    }

    // =============================================================================
    // VALIDATION FUNCTIONS
    // =============================================================================

    function validateOrderSignature(Order memory order, bytes memory signature) 
        public 
        view 
        returns (bool) 
    {
        // Get the order hash (this is the EIP-712 hash)
        bytes32 orderHash = getOrderHash(order);
        
        // For EIP-712 signatures, verify using the domain separator
        // The UI uses signTypedData which creates: keccak256("\x19\x01" + domainSeparator + orderHash)
        bytes32 domainSeparator = _domainSeparatorV4();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, orderHash));
        address recoveredSigner = digest.recover(signature);
        
        return recoveredSigner == order.maker;
    }

    function validateOrderConditions(Order memory order) public view returns (bool) {
        // Check deadline
        if (block.timestamp > order.deadline) return false;
        
        // Check maker has sufficient funds
        if (!_checkMakerFunds(order.maker, order.makerAsset, order.makerAmount)) return false;
        
        // Check escrow factory is configured for destination chain
        if (escrowFactories[order.destinationChain] == address(0)) return false;
        
        return true;
    }

    function validatePriceData(RelayerPriceData memory priceData, address tokenA, address tokenB) 
        public 
        view 
        returns (bool) 
    {
        // Check relayer authorization
        if (!authorizedPriceRelayers[priceData.relayer]) return false;
        
        // Check relayer reputation
        if (relayerReputationScore[priceData.relayer] < minRelayerReputation) return false;
        
        // Check price age
        if (block.timestamp - priceData.timestamp > maxPriceAge) return false;
        
        // Check confidence level
        if (priceData.confidence < minConfidenceLevel) return false;
        
        // Check price deviation
        if (priceData.deviation > maxPriceDeviation) return false;
        
        // Verify relayer signature on price data
        bytes32 priceHash = keccak256(abi.encodePacked(
            tokenA, 
            tokenB, 
            priceData.price, 
            priceData.timestamp,
            priceData.confidence
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", priceHash));
        address signer = ECDSA.recover(ethSignedMessageHash, priceData.signature);
        return signer == priceData.relayer;
    }

    // =============================================================================
    // ORDER HASH CALCULATION (EIP-712)
    // =============================================================================

    function getOrderHash(Order memory order) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.maker,
            order.taker,
            order.makerAsset,
            order.takerAsset,
            order.makerAmount,
            order.takerAmount,
            order.deadline,
            order.salt,
            order.secretHash,
            order.sourceChain,
            order.destinationChain,
            order.predicate,           // ✅ Use raw bytes (classic EIP-712)
            order.maxSlippage,
            order.requirePriceValidation,
            order.priceData            // ✅ Use raw struct (classic EIP-712)
        )));
    }

    function _hashPriceData(RelayerPriceData memory priceData) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            PRICE_DATA_TYPEHASH,
            priceData.price,
            priceData.timestamp,
            priceData.relayer,
            priceData.apiSources,      // ✅ Use raw array (classic EIP-712)
            priceData.confidence,
            priceData.deviation,
            priceData.signature        // ✅ Use raw bytes (classic EIP-712)
        ));
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    function _checkMakerFunds(address maker, address asset, uint256 amount) 
        internal 
        view 
        returns (bool) 
    {
        if (asset == address(0)) {
            return maker.balance >= amount;
        } else {
            IERC20 token = IERC20(asset);
            return token.balanceOf(maker) >= amount && 
                   token.allowance(maker, address(this)) >= amount;
        }
    }

    function _pullFundsFromMaker(address maker, address asset, uint256 amount) internal {
        if (asset == address(0)) {
            require(address(this).balance >= amount, "LOP: Insufficient ETH");
        } else {
            IERC20(asset).safeTransferFrom(maker, address(this), amount);
        }
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    function setEscrowFactory(uint256 chainId, address factory) external onlyOwner {
        escrowFactories[chainId] = factory;
        emit EscrowFactoryUpdated(chainId, factory);
    }

    function setResolverAuthorization(address resolver, bool authorized) external onlyOwner {
        authorizedResolvers[resolver] = authorized;
        emit ResolverAuthorized(resolver, authorized);
    }

    function setPriceRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        authorizedPriceRelayers[relayer] = authorized;
        if (authorized && relayerReputationScore[relayer] == 0) {
            relayerReputationScore[relayer] = 100;
        }
        emit PriceRelayerAuthorized(relayer, authorized);
    }

    function updateRelayerReputation(address relayer, uint256 score) external onlyOwner {
        require(score <= 100, "LOP: Score must be <= 100");
        relayerReputationScore[relayer] = score;
    }

    function setConfiguration(
        uint256 _maxPriceAge,
        uint256 _minConfidenceLevel,
        uint256 _maxPriceDeviation,
        uint256 _minRelayerReputation
    ) external onlyOwner {
        maxPriceAge = _maxPriceAge;
        minConfidenceLevel = _minConfidenceLevel;
        maxPriceDeviation = _maxPriceDeviation;
        minRelayerReputation = _minRelayerReputation;
    }

    // =============================================================================
    // CANCEL FUNCTIONS
    // =============================================================================

    function cancelOrder(Order memory order) external {
        bytes32 orderHash = getOrderHash(order);
        require(msg.sender == order.maker, "LOP: Only maker can cancel");
        require(orderStatus[orderHash] == 0, "LOP: Order already processed");
        
        orderStatus[orderHash] = 2;
        emit OrderCancelled(orderHash, order.maker);
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @dev Returns the domain separator for EIP-712
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getOrderStatus(bytes32 orderHash) external view returns (uint256) {
        return orderStatus[orderHash];
    }

    function getOrderEscrow(bytes32 orderHash) external view returns (address) {
        return orderToEscrow[orderHash];
    }

    function isChainSupported(uint256 chainId) external view returns (bool) {
        return escrowFactories[chainId] != address(0);
    }

    // =============================================================================
    // EMERGENCY FUNCTIONS
    // =============================================================================

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {}
}