// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Market Oracle Interface
 * @notice Interface for getting real-time market data to optimize partial fills
 * @custom:security-contact security@1inch.io
 */
interface IMarketOracle {
    struct MarketConditions {
        uint256 activeTakers;           // Number of active takers
        uint256 averageTakerCapacity;   // Average capacity per taker
        uint256 totalLiquidity;         // Total available liquidity
        uint256 networkCongestion;      // Network congestion level (0-100)
        uint256 gasPrice;               // Current gas price
        uint256 timestamp;              // Data timestamp
    }

    struct OptimizationParams {
        uint256 orderAmount;            // Total order amount
        uint256 minPartSize;            // Minimum part size
        uint256 maxParts;               // Maximum number of parts
        address token;                  // Token being traded
        uint256 urgency;                // Urgency level (0-100)
    }

    /**
     * @notice Get current market conditions
     * @param token The token to get conditions for
     * @return conditions Current market conditions
     */
    function getMarketConditions(address token) external view returns (MarketConditions memory conditions);

    /**
     * @notice Calculate optimal number of parts for an order
     * @param params Optimization parameters
     * @return optimalParts Recommended number of parts
     * @return confidence Confidence level (0-100)
     */
    function calculateOptimalParts(OptimizationParams calldata params) 
        external returns (uint256 optimalParts, uint256 confidence);

    /**
     * @notice Get estimated gas cost for different part configurations
     * @param orderAmount Total order amount
     * @param parts Number of parts
     * @return gasCost Estimated gas cost
     */
    function estimateGasCost(uint256 orderAmount, uint256 parts) external view returns (uint256 gasCost);

    /**
     * @notice Check if market conditions are favorable for execution
     * @param token Token to check
     * @param amount Amount to trade
     * @return favorable True if conditions are good
     */
    function isMarketFavorable(address token, uint256 amount) external view returns (bool favorable);

    // Events
    event MarketConditionsUpdated(address indexed token, MarketConditions conditions);
    event OptimalPartsCalculated(address indexed token, uint256 amount, uint256 optimalParts, uint256 confidence);
}