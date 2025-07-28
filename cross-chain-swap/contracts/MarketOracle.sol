// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { IMarketOracle } from "./interfaces/IMarketOracle.sol";
import { ITakerRegistry } from "./interfaces/ITakerRegistry.sol";

/**
 * @title Market Oracle
 * @notice Provides real-time market data and optimization calculations for dynamic partial fills
 * @dev Aggregates data from multiple sources to provide optimal part calculations
 * @custom:security-contact security@1inch.io
 */
contract MarketOracle is IMarketOracle, Ownable {
    
    // Data sources
    ITakerRegistry public immutable takerRegistry;
    
    // Market data storage
    mapping(address => MarketConditions) public marketConditions;
    mapping(address => uint256) public lastUpdateTime;
    
    // Configuration
    uint256 public constant DATA_FRESHNESS_THRESHOLD = 300; // 5 minutes
    uint256 public constant MIN_CONFIDENCE = 1000; // 10%
    uint256 public constant MAX_CONFIDENCE = 10000; // 100%
    
    // Gas cost estimation parameters
    uint256 public baseGasCost = 21000; // Base transaction cost
    uint256 public gasPerPart = 15000; // Additional gas per part
    uint256 public complexityMultiplier = 120; // 20% overhead for complexity
    
    // Optimization parameters
    uint256 public liquidityWeight = 40; // 40% weight for liquidity
    uint256 public takerWeight = 35; // 35% weight for taker availability
    uint256 public gasWeight = 25; // 25% weight for gas optimization
    
    // Events
    event DataSourceUpdated(address indexed token, address indexed source);
    event ParametersUpdated(uint256 liquidityWeight, uint256 takerWeight, uint256 gasWeight);
    event MarketDataStale(address indexed token, uint256 lastUpdate);
    
    constructor(ITakerRegistry _takerRegistry, address initialOwner) Ownable(initialOwner) {
        takerRegistry = _takerRegistry;
    }
    
    /**
     * @notice Update market conditions for a token
     * @param token Token address
     * @param conditions New market conditions
     */
    function updateMarketConditions(address token, MarketConditions calldata conditions) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(conditions.timestamp <= block.timestamp, "Future timestamp");
        require(conditions.timestamp > lastUpdateTime[token], "Stale data");
        
        marketConditions[token] = conditions;
        lastUpdateTime[token] = conditions.timestamp;
        
        emit MarketConditionsUpdated(token, conditions);
    }
    
    /**
     * @notice Get current market conditions for a token
     * @param token Token address
     * @return conditions Current market conditions
     */
    function getMarketConditions(address token) external view override returns (MarketConditions memory conditions) {
        conditions = marketConditions[token];
        
        // If data is stale, supplement with taker registry data
        if (block.timestamp - lastUpdateTime[token] > DATA_FRESHNESS_THRESHOLD) {
            conditions = _supplementWithTakerData(token, conditions);
        }
        
        return conditions;
    }
    
    /**
     * @notice Calculate optimal number of parts for an order
     * @param params Optimization parameters
     * @return optimalParts Recommended number of parts
     * @return confidence Confidence level (0-10000)
     */
    function calculateOptimalParts(OptimizationParams calldata params) 
        external override returns (uint256 optimalParts, uint256 confidence) {
        
        require(params.orderAmount > 0, "Invalid order amount");
        require(params.maxParts > 0, "Invalid max parts");
        
        MarketConditions memory conditions = this.getMarketConditions(params.token);
        
        // Calculate different optimization approaches
        uint256 liquidityBasedParts = _calculateLiquidityBasedParts(params, conditions);
        uint256 takerBasedParts = _calculateTakerBasedParts(params, conditions);
        uint256 gasBasedParts = _calculateGasBasedParts(params);
        
        // Weighted average based on configuration
        optimalParts = (
            liquidityBasedParts * liquidityWeight +
            takerBasedParts * takerWeight +
            gasBasedParts * gasWeight
        ) / 100;
        
        // Apply bounds
        optimalParts = _applyBounds(optimalParts, params);
        
        // Calculate confidence based on data freshness and consistency
        confidence = _calculateConfidence(params.token, liquidityBasedParts, takerBasedParts, gasBasedParts);
        
        emit OptimalPartsCalculated(params.token, params.orderAmount, optimalParts, confidence);
        
        return (optimalParts, confidence);
    }
    
    /**
     * @notice Estimate gas cost for a given configuration
     * @param orderAmount Total order amount
     * @param parts Number of parts
     * @return gasCost Estimated gas cost
     */
    function estimateGasCost(uint256 orderAmount, uint256 parts) external view override returns (uint256 gasCost) {
        // Base cost + per-part cost + complexity overhead
        gasCost = baseGasCost + (parts * gasPerPart);
        
        // Add complexity based on order size
        if (orderAmount > 1000 ether) {
            gasCost = (gasCost * complexityMultiplier) / 100;
        }
        
        // Add network congestion factor (simplified)
        uint256 congestionMultiplier = 100 + (block.basefee / 1 gwei); // Rough approximation
        gasCost = (gasCost * congestionMultiplier) / 100;
        
        return gasCost;
    }
    
    /**
     * @notice Check if market conditions are favorable
     * @param token Token to check
     * @param amount Amount to trade
     * @return favorable True if conditions are good
     */
    function isMarketFavorable(address token, uint256 amount) external view override returns (bool favorable) {
        MarketConditions memory conditions = this.getMarketConditions(token);
        
        // Check data freshness
        if (block.timestamp - lastUpdateTime[token] > DATA_FRESHNESS_THRESHOLD * 2) {
            return false; // Too stale
        }
        
        // Check liquidity
        if (conditions.totalLiquidity < amount / 2) {
            return false; // Insufficient liquidity
        }
        
        // Check taker availability
        if (conditions.activeTakers < 2) {
            return false; // Too few takers
        }
        
        // Check network congestion
        if (conditions.networkCongestion > 80) {
            return false; // Too congested
        }
        
        return true;
    }
    
    /**
     * @notice Calculate liquidity-based optimal parts
     */
    function _calculateLiquidityBasedParts(
        OptimizationParams calldata params,
        MarketConditions memory conditions
    ) internal pure returns (uint256) {
        if (conditions.totalLiquidity == 0) {
            return params.maxParts / 2; // Conservative default
        }
        
        // If liquidity is abundant, use fewer parts
        if (conditions.totalLiquidity >= params.orderAmount * 3) {
            return 1;
        }
        
        // If liquidity is scarce, use more parts
        if (conditions.totalLiquidity < params.orderAmount) {
            return params.maxParts;
        }
        
        // Scale parts based on liquidity ratio
        uint256 liquidityRatio = (params.orderAmount * 100) / conditions.totalLiquidity;
        return (liquidityRatio * params.maxParts) / 100;
    }
    
    /**
     * @notice Calculate taker-based optimal parts
     */
    function _calculateTakerBasedParts(
        OptimizationParams calldata params,
        MarketConditions memory conditions
    ) internal pure returns (uint256) {
        if (conditions.activeTakers == 0) {
            return params.maxParts; // Conservative approach
        }
        
        // If many takers available, can use more parts
        if (conditions.activeTakers >= 10) {
            return conditions.activeTakers;
        }
        
        // Calculate based on average taker capacity
        if (conditions.averageTakerCapacity > 0) {
            uint256 partsNeeded = (params.orderAmount + conditions.averageTakerCapacity - 1) / conditions.averageTakerCapacity;
            return partsNeeded > params.maxParts ? params.maxParts : partsNeeded;
        }
        
        return conditions.activeTakers * 2; // Conservative multiplier
    }
    
    /**
     * @notice Calculate gas-based optimal parts
     */
    function _calculateGasBasedParts(OptimizationParams calldata params) internal view returns (uint256) {
        uint256 minGasCost = type(uint256).max;
        uint256 optimalParts = 1;
        
        // Test different part configurations
        for (uint256 parts = 1; parts <= 20 && parts <= params.maxParts; parts++) {
            uint256 gasCost = this.estimateGasCost(params.orderAmount, parts);
            
            if (gasCost < minGasCost) {
                minGasCost = gasCost;
                optimalParts = parts;
            }
        }
        
        return optimalParts;
    }
    
    /**
     * @notice Apply bounds to calculated parts
     */
    function _applyBounds(uint256 parts, OptimizationParams calldata params) internal pure returns (uint256) {
        if (parts < 1) parts = 1;
        if (parts > params.maxParts) parts = params.maxParts;
        
        // Ensure minimum part size is respected
        if (params.minPartSize > 0) {
            uint256 maxPartsForMinSize = params.orderAmount / params.minPartSize;
            if (parts > maxPartsForMinSize) {
                parts = maxPartsForMinSize;
            }
        }
        
        return parts;
    }
    
    /**
     * @notice Calculate confidence level for the recommendation
     */
    function _calculateConfidence(
        address token,
        uint256 liquidityParts,
        uint256 takerParts,
        uint256 gasParts
    ) internal view returns (uint256 confidence) {
        // Base confidence from data freshness
        uint256 dataAge = block.timestamp - lastUpdateTime[token];
        uint256 freshnessScore = dataAge > DATA_FRESHNESS_THRESHOLD ? 
            5000 : 10000 - (dataAge * 5000 / DATA_FRESHNESS_THRESHOLD);
        
        // Consistency score based on how close the different methods are
        uint256 maxParts = liquidityParts > takerParts ? liquidityParts : takerParts;
        maxParts = maxParts > gasParts ? maxParts : gasParts;
        uint256 minParts = liquidityParts < takerParts ? liquidityParts : takerParts;
        minParts = minParts < gasParts ? minParts : gasParts;
        
        uint256 consistencyScore = maxParts > 0 ? (minParts * 10000) / maxParts : 0;
        
        // Combined confidence
        confidence = (freshnessScore + consistencyScore) / 2;
        
        // Ensure bounds
        if (confidence < MIN_CONFIDENCE) confidence = MIN_CONFIDENCE;
        if (confidence > MAX_CONFIDENCE) confidence = MAX_CONFIDENCE;
        
        return confidence;
    }
    
    /**
     * @notice Supplement stale data with taker registry information
     */
    function _supplementWithTakerData(address token, MarketConditions memory conditions) 
        internal view returns (MarketConditions memory) {
        
        (address[] memory takers, uint256 totalCapacity) = takerRegistry.getAvailableTakers(token, 1 ether);
        
        // Update with fresh taker data
        conditions.activeTakers = takers.length;
        conditions.averageTakerCapacity = takers.length > 0 ? totalCapacity / takers.length : 0;
        conditions.timestamp = block.timestamp;
        
        // Keep other fields as they were, or set conservative defaults
        if (conditions.totalLiquidity == 0) {
            conditions.totalLiquidity = totalCapacity * 2; // Conservative estimate
        }
        
        if (conditions.networkCongestion == 0) {
            conditions.networkCongestion = block.basefee > 20 gwei ? 70 : 30; // Simple heuristic
        }
        
        conditions.gasPrice = block.basefee;
        
        return conditions;
    }
    
    // Admin functions
    function setWeights(uint256 _liquidityWeight, uint256 _takerWeight, uint256 _gasWeight) external onlyOwner {
        require(_liquidityWeight + _takerWeight + _gasWeight == 100, "Weights must sum to 100");
        
        liquidityWeight = _liquidityWeight;
        takerWeight = _takerWeight;
        gasWeight = _gasWeight;
        
        emit ParametersUpdated(_liquidityWeight, _takerWeight, _gasWeight);
    }
    
    function setGasParameters(uint256 _baseGasCost, uint256 _gasPerPart, uint256 _complexityMultiplier) external onlyOwner {
        baseGasCost = _baseGasCost;
        gasPerPart = _gasPerPart;
        complexityMultiplier = _complexityMultiplier;
    }
    
    function emergencyUpdateMarketData(address token, uint256 liquidity, uint256 takers) external onlyOwner {
        marketConditions[token] = MarketConditions({
            activeTakers: takers,
            averageTakerCapacity: liquidity / (takers > 0 ? takers : 1),
            totalLiquidity: liquidity,
            networkCongestion: 50, // Default
            gasPrice: block.basefee,
            timestamp: block.timestamp
        });
        
        lastUpdateTime[token] = block.timestamp;
        
        emit MarketConditionsUpdated(token, marketConditions[token]);
    }
}