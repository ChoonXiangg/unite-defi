// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { EnumerableSet } from "openzeppelin-contracts/contracts/utils/structs/EnumerableSet.sol";
import { ITakerRegistry } from "./interfaces/ITakerRegistry.sol";

/**
 * @title Taker Registry
 * @notice Manages taker registration, capacity tracking, and optimal distribution calculations
 * @dev Provides real-time taker availability data for dynamic partial fill optimization
 * @custom:security-contact security@1inch.io
 */
contract TakerRegistry is ITakerRegistry, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    
    // Storage
    mapping(address => TakerInfo) public takerInfo;
    mapping(address => TakerStats) public takerStats;
    mapping(address => mapping(address => bool)) public supportedTokens; // taker => token => supported
    mapping(address => EnumerableSet.AddressSet) private tokenTakers; // token => takers
    
    EnumerableSet.AddressSet private allTakers;
    
    // Configuration
    uint256 public constant MIN_CAPACITY = 0.01 ether;
    uint256 public constant MAX_CAPACITY = 10000 ether;
    uint256 public constant ACTIVITY_TIMEOUT = 1 hours;
    uint256 public constant MIN_SUCCESS_RATE = 7000; // 70%
    uint256 public constant REPUTATION_DECAY_PERIOD = 30 days;
    
    // Reputation and scoring
    uint256 public constant BASE_REPUTATION = 5000; // 50%
    uint256 public constant MAX_REPUTATION = 10000; // 100%
    uint256 public constant FILL_BONUS = 10; // Reputation bonus per successful fill
    uint256 public constant FAIL_PENALTY = 50; // Reputation penalty per failed fill
    
    // Events
    event TokenSupportAdded(address indexed taker, address indexed token);
    event TokenSupportRemoved(address indexed taker, address indexed token);
    event TakerDeactivated(address indexed taker, string reason);
    event ReputationUpdated(address indexed taker, uint256 oldReputation, uint256 newReputation);
    
    constructor(address initialOwner) Ownable(initialOwner) {}
    
    /**
     * @notice Register a new taker
     * @param capacity Maximum capacity per fill
     * @param supportedTokensList List of supported tokens
     */
    function registerTaker(uint256 capacity, address[] calldata supportedTokensList) external override {
        require(capacity >= MIN_CAPACITY && capacity <= MAX_CAPACITY, "Invalid capacity");
        require(supportedTokensList.length > 0, "Must support at least one token");
        require(!allTakers.contains(msg.sender), "Taker already registered");
        
        // Initialize taker info
        takerInfo[msg.sender] = TakerInfo({
            taker: msg.sender,
            capacity: capacity,
            totalCapacity: capacity * supportedTokensList.length,
            activeOrders: 0,
            successRate: 10000, // Start with 100% success rate
            averageResponseTime: 0,
            isActive: true,
            lastActivity: block.timestamp
        });
        
        // Initialize taker stats
        takerStats[msg.sender] = TakerStats({
            totalFills: 0,
            totalVolume: 0,
            averageGasUsed: 0,
            reputation: BASE_REPUTATION
        });
        
        // Add to registry
        allTakers.add(msg.sender);
        
        // Add supported tokens
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            require(token != address(0), "Invalid token address");
            
            supportedTokens[msg.sender][token] = true;
            tokenTakers[token].add(msg.sender);
            
            emit TokenSupportAdded(msg.sender, token);
        }
        
        emit TakerRegistered(msg.sender, capacity);
    }
    
    /**
     * @notice Update taker capacity
     * @param newCapacity New capacity value
     */
    function updateCapacity(uint256 newCapacity) external override {
        require(allTakers.contains(msg.sender), "Taker not registered");
        require(newCapacity >= MIN_CAPACITY && newCapacity <= MAX_CAPACITY, "Invalid capacity");
        
        TakerInfo storage info = takerInfo[msg.sender];
        uint256 oldCapacity = info.capacity;
        
        info.capacity = newCapacity;
        info.lastActivity = block.timestamp;
        
        // Update total capacity (approximate)
        uint256 supportedTokenCount = _getSupportedTokenCount(msg.sender);
        info.totalCapacity = newCapacity * supportedTokenCount;
        
        emit TakerCapacityUpdated(msg.sender, oldCapacity, newCapacity);
    }
    
    /**
     * @notice Set taker active/inactive status
     * @param active Whether taker is active
     */
    function setTakerStatus(bool active) external override {
        require(allTakers.contains(msg.sender), "Taker not registered");
        
        TakerInfo storage info = takerInfo[msg.sender];
        info.isActive = active;
        info.lastActivity = block.timestamp;
        
        emit TakerStatusChanged(msg.sender, active);
    }
    
    /**
     * @notice Get available takers for a token and amount
     * @param token Token address
     * @param amount Required amount
     * @return takers Array of available taker addresses
     * @return totalCapacity Total capacity of available takers
     */
    function getAvailableTakers(address token, uint256 amount) 
        external view override returns (address[] memory takers, uint256 totalCapacity) {
        
        EnumerableSet.AddressSet storage tokenTakerSet = tokenTakers[token];
        uint256 takerCount = tokenTakerSet.length();
        
        // First pass: count available takers
        uint256 availableCount = 0;
        for (uint256 i = 0; i < takerCount; i++) {
            address taker = tokenTakerSet.at(i);
            if (_isTakerAvailable(taker, amount)) {
                availableCount++;
            }
        }
        
        // Second pass: populate arrays
        takers = new address[](availableCount);
        uint256 index = 0;
        totalCapacity = 0;
        
        for (uint256 i = 0; i < takerCount; i++) {
            address taker = tokenTakerSet.at(i);
            if (_isTakerAvailable(taker, amount)) {
                takers[index] = taker;
                totalCapacity += takerInfo[taker].capacity;
                index++;
            }
        }
        
        return (takers, totalCapacity);
    }
    
    /**
     * @notice Get taker information
     * @param taker Taker address
     * @return info Taker information
     */
    function getTakerInfo(address taker) external view override returns (TakerInfo memory info) {
        return takerInfo[taker];
    }
    
    /**
     * @notice Get taker statistics
     * @param taker Taker address
     * @return stats Taker statistics
     */
    function getTakerStats(address taker) external view override returns (TakerStats memory stats) {
        return takerStats[taker];
    }
    
    /**
     * @notice Record a successful fill
     * @param taker Taker address
     * @param amount Amount filled
     * @param gasUsed Gas used for the fill
     */
    function recordFill(address taker, uint256 amount, uint256 gasUsed) external override {
        require(allTakers.contains(taker), "Taker not registered");
        
        TakerInfo storage info = takerInfo[taker];
        TakerStats storage stats = takerStats[taker];
        
        // Update stats
        stats.totalFills++;
        stats.totalVolume += amount;
        
        // Update average gas used
        if (stats.totalFills == 1) {
            stats.averageGasUsed = gasUsed;
        } else {
            stats.averageGasUsed = (stats.averageGasUsed * (stats.totalFills - 1) + gasUsed) / stats.totalFills;
        }
        
        // Update success rate (simplified - assumes this is only called for successful fills)
        info.successRate = (info.successRate * 99 + 10000) / 100; // Gradual improvement
        if (info.successRate > 10000) info.successRate = 10000;
        
        // Update reputation
        uint256 oldReputation = stats.reputation;
        stats.reputation += FILL_BONUS;
        if (stats.reputation > MAX_REPUTATION) stats.reputation = MAX_REPUTATION;
        
        // Update activity
        info.lastActivity = block.timestamp;
        
        emit FillRecorded(taker, amount, gasUsed);
        
        if (stats.reputation != oldReputation) {
            emit ReputationUpdated(taker, oldReputation, stats.reputation);
        }
    }
    
    /**
     * @notice Get optimal taker distribution for an amount
     * @param token Token address
     * @param totalAmount Total amount to fill
     * @return takers Array of taker addresses
     * @return amounts Array of amounts for each taker
     */
    function getOptimalDistribution(address token, uint256 totalAmount)
        external view override returns (address[] memory takers, uint256[] memory amounts) {
        
        (address[] memory availableTakers, uint256 totalCapacity) = this.getAvailableTakers(token, 0);
        
        if (availableTakers.length == 0 || totalCapacity == 0) {
            return (new address[](0), new uint256[](0));
        }
        
        // If total capacity exceeds amount, select best takers
        if (totalCapacity >= totalAmount) {
            return _selectOptimalTakers(availableTakers, totalAmount);
        }
        
        // Otherwise, distribute among all available takers
        return _distributeAmongAllTakers(availableTakers, totalAmount);
    }
    
    /**
     * @notice Check if a taker is available for a given amount
     */
    function _isTakerAvailable(address taker, uint256 amount) internal view returns (bool) {
        TakerInfo memory info = takerInfo[taker];
        
        // Check if taker is active
        if (!info.isActive) return false;
        
        // Check if taker has been active recently
        if (block.timestamp - info.lastActivity > ACTIVITY_TIMEOUT) return false;
        
        // Check capacity (if amount is specified)
        if (amount > 0 && info.capacity < amount) return false;
        
        // Check success rate
        if (info.successRate < MIN_SUCCESS_RATE) return false;
        
        // Check reputation
        TakerStats memory stats = takerStats[taker];
        if (stats.reputation < BASE_REPUTATION / 2) return false; // Below 25%
        
        return true;
    }
    
    /**
     * @notice Select optimal takers when capacity exceeds demand
     */
    function _selectOptimalTakers(address[] memory availableTakers, uint256 totalAmount)
        internal view returns (address[] memory selectedTakers, uint256[] memory amounts) {
        
        // Sort takers by score (reputation + success rate + capacity)
        address[] memory sortedTakers = _sortTakersByScore(availableTakers);
        
        uint256 remainingAmount = totalAmount;
        uint256 selectedCount = 0;
        
        // First pass: count how many takers we need
        for (uint256 i = 0; i < sortedTakers.length && remainingAmount > 0; i++) {
            address taker = sortedTakers[i];
            uint256 takerCapacity = takerInfo[taker].capacity;
            
            if (takerCapacity >= remainingAmount) {
                selectedCount++;
                break;
            } else {
                selectedCount++;
                remainingAmount -= takerCapacity;
            }
        }
        
        // Second pass: populate arrays
        selectedTakers = new address[](selectedCount);
        amounts = new uint256[](selectedCount);
        remainingAmount = totalAmount;
        
        for (uint256 i = 0; i < selectedCount; i++) {
            address taker = sortedTakers[i];
            uint256 takerCapacity = takerInfo[taker].capacity;
            
            selectedTakers[i] = taker;
            
            if (takerCapacity >= remainingAmount) {
                amounts[i] = remainingAmount;
                remainingAmount = 0;
            } else {
                amounts[i] = takerCapacity;
                remainingAmount -= takerCapacity;
            }
        }
        
        return (selectedTakers, amounts);
    }
    
    /**
     * @notice Distribute amount among all available takers proportionally
     */
    function _distributeAmongAllTakers(address[] memory availableTakers, uint256 totalAmount)
        internal view returns (address[] memory takers, uint256[] memory amounts) {
        
        takers = availableTakers;
        amounts = new uint256[](availableTakers.length);
        
        uint256 totalCapacity = 0;
        for (uint256 i = 0; i < availableTakers.length; i++) {
            totalCapacity += takerInfo[availableTakers[i]].capacity;
        }
        
        // Distribute proportionally
        uint256 distributedAmount = 0;
        for (uint256 i = 0; i < availableTakers.length; i++) {
            if (i == availableTakers.length - 1) {
                // Last taker gets remaining amount
                amounts[i] = totalAmount - distributedAmount;
            } else {
                uint256 takerCapacity = takerInfo[availableTakers[i]].capacity;
                amounts[i] = (totalAmount * takerCapacity) / totalCapacity;
                distributedAmount += amounts[i];
            }
        }
        
        return (takers, amounts);
    }
    
    /**
     * @notice Sort takers by composite score
     */
    function _sortTakersByScore(address[] memory takers) internal view returns (address[] memory) {
        // Simple bubble sort for demonstration - in production, use more efficient sorting
        address[] memory sorted = new address[](takers.length);
        for (uint256 i = 0; i < takers.length; i++) {
            sorted[i] = takers[i];
        }
        
        for (uint256 i = 0; i < sorted.length; i++) {
            for (uint256 j = i + 1; j < sorted.length; j++) {
                if (_getTakerScore(sorted[i]) < _getTakerScore(sorted[j])) {
                    address temp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = temp;
                }
            }
        }
        
        return sorted;
    }
    
    /**
     * @notice Calculate composite score for a taker
     */
    function _getTakerScore(address taker) internal view returns (uint256) {
        TakerInfo memory info = takerInfo[taker];
        TakerStats memory stats = takerStats[taker];
        
        // Weighted score: 40% reputation, 30% success rate, 20% capacity, 10% activity
        uint256 reputationScore = (stats.reputation * 40) / 100;
        uint256 successScore = (info.successRate * 30) / 10000;
        uint256 capacityScore = (info.capacity * 20) / MAX_CAPACITY;
        
        uint256 activityScore = 0;
        uint256 timeSinceActivity = block.timestamp - info.lastActivity;
        if (timeSinceActivity < ACTIVITY_TIMEOUT) {
            activityScore = ((ACTIVITY_TIMEOUT - timeSinceActivity) * 10) / ACTIVITY_TIMEOUT;
        }
        
        return reputationScore + successScore + capacityScore + activityScore;
    }
    
    /**
     * @notice Get count of supported tokens for a taker
     */
    function _getSupportedTokenCount(address taker) internal view returns (uint256 count) {
        // This is a simplified implementation
        // In production, you'd maintain a proper count
        return 1; // Placeholder
    }
    
    // Admin functions
    function deactivateTaker(address taker, string calldata reason) external onlyOwner {
        require(allTakers.contains(taker), "Taker not registered");
        
        takerInfo[taker].isActive = false;
        
        emit TakerDeactivated(taker, reason);
    }
    
    function updateTakerReputation(address taker, uint256 newReputation) external onlyOwner {
        require(allTakers.contains(taker), "Taker not registered");
        require(newReputation <= MAX_REPUTATION, "Invalid reputation");
        
        uint256 oldReputation = takerStats[taker].reputation;
        takerStats[taker].reputation = newReputation;
        
        emit ReputationUpdated(taker, oldReputation, newReputation);
    }
    
    function emergencyPause(address taker) external onlyOwner {
        if (allTakers.contains(taker)) {
            takerInfo[taker].isActive = false;
            emit TakerDeactivated(taker, "Emergency pause");
        }
    }
}