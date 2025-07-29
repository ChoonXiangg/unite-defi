// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Taker Registry Interface
 * @notice Interface for managing and tracking taker availability and capacity
 * @custom:security-contact security@1inch.io
 */
interface ITakerRegistry {
    struct TakerInfo {
        address taker;                  // Taker address
        uint256 capacity;               // Maximum capacity per fill
        uint256 totalCapacity;          // Total capacity across all tokens
        uint256 activeOrders;           // Number of active orders
        uint256 successRate;            // Success rate (0-10000 basis points)
        uint256 averageResponseTime;    // Average response time in seconds
        bool isActive;                  // Whether taker is currently active
        uint256 lastActivity;           // Timestamp of last activity
    }

    struct TakerStats {
        uint256 totalFills;             // Total successful fills
        uint256 totalVolume;            // Total volume filled
        uint256 averageGasUsed;         // Average gas used per fill
        uint256 reputation;             // Reputation score (0-10000)
    }

    /**
     * @notice Register a new taker
     * @param capacity Maximum capacity per fill
     * @param supportedTokens List of supported tokens
     */
    function registerTaker(uint256 capacity, address[] calldata supportedTokens) external;

    /**
     * @notice Update taker capacity
     * @param newCapacity New capacity value
     */
    function updateCapacity(uint256 newCapacity) external;

    /**
     * @notice Set taker active/inactive status
     * @param active Whether taker is active
     */
    function setTakerStatus(bool active) external;

    /**
     * @notice Get available takers for a token and amount
     * @param token Token address
     * @param amount Required amount
     * @return takers Array of available taker addresses
     * @return totalCapacity Total capacity of available takers
     */
    function getAvailableTakers(address token, uint256 amount) 
        external view returns (address[] memory takers, uint256 totalCapacity);

    /**
     * @notice Get taker information
     * @param taker Taker address
     * @return info Taker information
     */
    function getTakerInfo(address taker) external view returns (TakerInfo memory info);

    /**
     * @notice Get taker statistics
     * @param taker Taker address
     * @return stats Taker statistics
     */
    function getTakerStats(address taker) external view returns (TakerStats memory stats);

    /**
     * @notice Record a successful fill
     * @param taker Taker address
     * @param amount Amount filled
     * @param gasUsed Gas used for the fill
     */
    function recordFill(address taker, uint256 amount, uint256 gasUsed) external;

    /**
     * @notice Get optimal taker distribution for an amount
     * @param token Token address
     * @param totalAmount Total amount to fill
     * @return takers Array of taker addresses
     * @return amounts Array of amounts for each taker
     */
    function getOptimalDistribution(address token, uint256 totalAmount)
        external view returns (address[] memory takers, uint256[] memory amounts);

    // Events
    event TakerRegistered(address indexed taker, uint256 capacity);
    event TakerCapacityUpdated(address indexed taker, uint256 oldCapacity, uint256 newCapacity);
    event TakerStatusChanged(address indexed taker, bool active);
    event FillRecorded(address indexed taker, uint256 amount, uint256 gasUsed);
}