// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IOrderMixin } from "limit-order-protocol/contracts/interfaces/IOrderMixin.sol";

import { DynamicEscrowFactory } from "../contracts/DynamicEscrowFactory.sol";
import { IMarketOracle } from "../contracts/interfaces/IMarketOracle.sol";
import { ITakerRegistry } from "../contracts/interfaces/ITakerRegistry.sol";

/**
 * @title Dynamic Escrow Usage Examples
 * @notice Comprehensive examples of how to use the production-ready dynamic escrow system
 * @dev This contract demonstrates various usage patterns for different scenarios
 */
contract DynamicEscrowUsage {
    
    DynamicEscrowFactory public immutable dynamicFactory;
    IMarketOracle public immutable marketOracle;
    ITakerRegistry public immutable takerRegistry;
    
    constructor(
        address _dynamicFactory,
        address _marketOracle,
        address _takerRegistry
    ) {
        dynamicFactory = DynamicEscrowFactory(_dynamicFactory);
        marketOracle = IMarketOracle(_marketOracle);
        takerRegistry = ITakerRegistry(_takerRegistry);
    }
    
    /**
     * @notice Example 1: Basic dynamic escrow creation with system optimization
     * @dev Let the system automatically determine optimal parts based on market conditions
     */
    function createDynamicEscrow(
        address token,
        uint256 amount,
        uint256 urgencyLevel
    ) external view returns (
        DynamicEscrowFactory.OptimizationMode recommendedMode,
        string memory reason,
        uint256 estimatedParts,
        uint256 confidence
    ) {
        // Step 1: Get system recommendation
        (recommendedMode, reason) = dynamicFactory.getRecommendedMode(token, amount, urgencyLevel);
        
        // Step 2: Get optimal parts calculation
        IMarketOracle.OptimizationParams memory params = IMarketOracle.OptimizationParams({
            orderAmount: amount,
            minPartSize: amount / 1000, // Minimum 0.1% parts
            maxParts: 100,
            token: token,
            urgency: urgencyLevel
        });
        
        (estimatedParts, confidence) = marketOracle.calculateOptimalParts(params);
        
        return (recommendedMode, reason, estimatedParts, confidence);
    }
    
    /**
     * @notice Example 2: Conservative approach with user-defined bounds
     * @dev Use hybrid mode to let system optimize within user-specified limits
     */
    function createBoundedDynamicEscrow(
        address token,
        uint256 amount,
        uint256 minParts,
        uint256 maxParts,
        uint256 maxGasCost
    ) external view returns (
        uint256 optimalParts,
        uint256 estimatedGasCost,
        bool isWithinBounds
    ) {
        // Calculate optimal parts
        IMarketOracle.OptimizationParams memory params = IMarketOracle.OptimizationParams({
            orderAmount: amount,
            minPartSize: amount / maxParts,
            maxParts: maxParts,
            token: token,
            urgency: 50 // Medium urgency
        });
        
        (optimalParts,) = marketOracle.calculateOptimalParts(params);
        
        // Apply user bounds
        if (optimalParts < minParts) optimalParts = minParts;
        if (optimalParts > maxParts) optimalParts = maxParts;
        
        // Check gas cost
        estimatedGasCost = marketOracle.estimateGasCost(amount, optimalParts);
        isWithinBounds = estimatedGasCost <= maxGasCost;
        
        return (optimalParts, estimatedGasCost, isWithinBounds);
    }
    
    /**
     * @notice Example 3: Gas-optimized escrow for cost-sensitive users
     * @dev Minimize gas costs while maintaining reasonable execution probability
     */
    function createGasOptimizedEscrow(
        address token,
        uint256 amount,
        uint256 maxGasBudget
    ) external view returns (
        uint256 optimalParts,
        uint256 actualGasCost,
        uint256 gasSavings
    ) {
        // Test different part configurations to find gas-optimal solution
        uint256 minGasCost = type(uint256).max;
        optimalParts = 1;
        
        for (uint256 parts = 1; parts <= 20; parts++) {
            uint256 gasCost = marketOracle.estimateGasCost(amount, parts);
            
            if (gasCost <= maxGasBudget && gasCost < minGasCost) {
                minGasCost = gasCost;
                optimalParts = parts;
            }
        }
        
        actualGasCost = minGasCost;
        
        // Calculate savings compared to naive single-part approach
        uint256 singlePartCost = marketOracle.estimateGasCost(amount, 1);
        gasSavings = singlePartCost > actualGasCost ? singlePartCost - actualGasCost : 0;
        
        return (optimalParts, actualGasCost, gasSavings);
    }
    
    /**
     * @notice Example 4: Liquidity-aware escrow for large orders
     * @dev Optimize for maximum fill probability in low-liquidity conditions
     */
    function createLiquidityOptimizedEscrow(
        address token,
        uint256 amount
    ) external view returns (
        uint256 optimalParts,
        address[] memory availableTakers,
        uint256[] memory recommendedAmounts,
        uint256 totalAvailableCapacity
    ) {
        // Get available takers and their capacity
        (availableTakers, totalAvailableCapacity) = takerRegistry.getAvailableTakers(token, 0);
        
        // Get optimal distribution
        (address[] memory distributionTakers, uint256[] memory distributionAmounts) = 
            takerRegistry.getOptimalDistribution(token, amount);
        
        optimalParts = distributionTakers.length;
        recommendedAmounts = distributionAmounts;
        
        // If we have specific taker distribution, use those takers
        if (distributionTakers.length > 0) {
            availableTakers = distributionTakers;
        }
        
        return (optimalParts, availableTakers, recommendedAmounts, totalAvailableCapacity);
    }
    
    /**
     * @notice Example 5: Market condition analysis for informed decisions
     * @dev Analyze current market conditions to make informed escrow decisions
     */
    function analyzeMarketConditions(
        address token,
        uint256 amount
    ) external view returns (
        IMarketOracle.MarketConditions memory conditions,
        bool isMarketFavorable,
        string memory recommendation,
        uint256 estimatedWaitTime
    ) {
        // Get current market conditions
        conditions = marketOracle.getMarketConditions(token);
        
        // Check if market is favorable
        isMarketFavorable = marketOracle.isMarketFavorable(token, amount);
        
        // Generate recommendation based on conditions
        if (!isMarketFavorable) {
            if (conditions.activeTakers < 2) {
                recommendation = "Wait for more takers to become active";
                estimatedWaitTime = 30 minutes;
            } else if (conditions.totalLiquidity < amount) {
                recommendation = "Consider splitting into smaller orders";
                estimatedWaitTime = 1 hours;
            } else if (conditions.networkCongestion > 80) {
                recommendation = "Wait for network congestion to decrease";
                estimatedWaitTime = 15 minutes;
            } else {
                recommendation = "Market conditions are suboptimal";
                estimatedWaitTime = 45 minutes;
            }
        } else {
            recommendation = "Market conditions are favorable for execution";
            estimatedWaitTime = 0;
        }
        
        return (conditions, isMarketFavorable, recommendation, estimatedWaitTime);
    }
    
    /**
     * @notice Example 6: Taker registration and management
     * @dev Example of how takers can register and manage their presence
     */
    function registerAsTaker(
        uint256 capacity,
        address[] calldata supportedTokens
    ) external {
        // Register as a taker
        takerRegistry.registerTaker(capacity, supportedTokens);
        
        // Takers should also implement proper order handling logic
        // This is just the registration part
    }
    
    /**
     * @notice Example 7: Monitor taker performance
     * @dev Check taker statistics and reputation
     */
    function getTakerAnalysis(
        address taker
    ) external view returns (
        ITakerRegistry.TakerInfo memory info,
        ITakerRegistry.TakerStats memory stats,
        string memory status,
        uint256 score
    ) {
        info = takerRegistry.getTakerInfo(taker);
        stats = takerRegistry.getTakerStats(taker);
        
        // Determine status
        if (!info.isActive) {
            status = "Inactive";
        } else if (block.timestamp - info.lastActivity > 1 hours) {
            status = "Stale";
        } else if (info.successRate < 7000) {
            status = "Low Success Rate";
        } else if (stats.reputation < 5000) {
            status = "Low Reputation";
        } else {
            status = "Active";
        }
        
        // Calculate composite score (0-100)
        score = (stats.reputation * 40 + info.successRate * 30 + (info.capacity * 30 / 10 ether)) / 100;
        if (score > 100) score = 100;
        
        return (info, stats, status, score);
    }
    
    /**
     * @notice Example 8: Real-time optimization for urgent orders
     * @dev Handle time-sensitive orders with dynamic optimization
     */
    function handleUrgentOrder(
        address token,
        uint256 amount,
        uint256 maxWaitTime
    ) external view returns (
        DynamicEscrowFactory.OptimizationMode mode,
        uint256 parts,
        uint256 estimatedExecutionTime,
        bool shouldProceed
    ) {
        // High urgency for time-sensitive orders
        uint256 urgency = maxWaitTime < 5 minutes ? 95 : 
                         maxWaitTime < 15 minutes ? 80 : 60;
        
        // Get recommendation
        (mode,) = dynamicFactory.getRecommendedMode(token, amount, urgency);
        
        // Calculate optimal parts for urgent execution
        IMarketOracle.OptimizationParams memory params = IMarketOracle.OptimizationParams({
            orderAmount: amount,
            minPartSize: amount / 50, // Larger minimum parts for speed
            maxParts: 20, // Limit parts for faster execution
            token: token,
            urgency: urgency
        });
        
        (parts,) = marketOracle.calculateOptimalParts(params);
        
        // Estimate execution time based on taker availability
        (address[] memory takers,) = takerRegistry.getAvailableTakers(token, amount / parts);
        
        if (takers.length >= parts) {
            estimatedExecutionTime = 2 minutes; // Fast execution
        } else if (takers.length >= parts / 2) {
            estimatedExecutionTime = 5 minutes; // Medium execution
        } else {
            estimatedExecutionTime = 15 minutes; // Slow execution
        }
        
        shouldProceed = estimatedExecutionTime <= maxWaitTime;
        
        return (mode, parts, estimatedExecutionTime, shouldProceed);
    }
}