// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GasStationExtension
 * @dev 1inch Limit Order Protocol extension for gasless swaps via flash loans
 */
contract GasStationExtension is Ownable, ReentrancyGuard {
    
    // Events
    event GasStationInitialized(address indexed owner);
    event OrderPairRegistered(bytes32 indexed orderHash1, bytes32 indexed orderHash2);
    event FlashLoanInitiated(bytes32 indexed batchId, uint256 amount);
    event FeesCollected(address indexed token, uint256 amount);
    
    // State variables
    mapping(bytes32 => bool) public registeredOrders;
    mapping(bytes32 => bytes32) public orderPairs; // orderHash => counterpartOrderHash
    mapping(bytes32 => bool) public completedPairs;
    
    uint256 public constant GAS_STATION_FEE_BASIS_POINTS = 10; // 0.1%
    uint256 public constant MAX_GAS_PRICE = 50 gwei;
    
    constructor() Ownable(msg.sender) {
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
    function isOrderPairReady(bytes32 orderHash) external view returns (bool) {
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
     * @dev Get contract version for upgrades
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}