// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IOrderMixin } from "limit-order-protocol/contracts/interfaces/IOrderMixin.sol";

import { DynamicEscrowFactory } from "../../contracts/DynamicEscrowFactory.sol";
import { MarketOracle } from "../../contracts/MarketOracle.sol";
import { TakerRegistry } from "../../contracts/TakerRegistry.sol";
import { IMarketOracle } from "../../contracts/interfaces/IMarketOracle.sol";
import { ITakerRegistry } from "../../contracts/interfaces/ITakerRegistry.sol";
import { BaseSetup } from "../utils/BaseSetup.sol";

contract DynamicEscrowFactoryTest is BaseSetup {
    
    DynamicEscrowFactory public dynamicFactory;
    MarketOracle public marketOracle;
    TakerRegistry public takerRegistry;
    
    // Test addresses
    address public taker1 = makeAddr("taker1");
    address public taker2 = makeAddr("taker2");
    address public taker3 = makeAddr("taker3");
    
    function setUp() public override {
        BaseSetup.setUp();
        
        // Deploy production contracts
        takerRegistry = new TakerRegistry(charlie.addr);
        marketOracle = new MarketOracle(takerRegistry, charlie.addr);
        
        dynamicFactory = new DynamicEscrowFactory(
            address(limitOrderProtocol),
            inch,
            accessToken,
            charlie.addr,
            RESCUE_DELAY,
            RESCUE_DELAY,
            feeBank,
            marketOracle,
            takerRegistry
        );
        
        // Setup test takers
        _setupTestTakers();
        _setupMarketConditions();
    }
    
    function _setupTestTakers() internal {
        // Register taker1 with high capacity
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(dai);
        
        vm.prank(taker1);
        takerRegistry.registerTaker(10 ether, tokens);
        
        // Register taker2 with medium capacity
        vm.prank(taker2);
        takerRegistry.registerTaker(5 ether, tokens);
        
        // Register taker3 with low capacity
        vm.prank(taker3);
        takerRegistry.registerTaker(1 ether, tokens);
        
        // Record some successful fills to build reputation
        takerRegistry.recordFill(taker1, 5 ether, 150000);
        takerRegistry.recordFill(taker2, 2 ether, 140000);
        takerRegistry.recordFill(taker3, 0.5 ether, 130000);
    }
    
    function _setupMarketConditions() internal {
        // ROOT CAUSE FIX: Ensure timestamp is current to avoid stale data issues
        uint256 currentTime = block.timestamp;
        
        // Setup market conditions for USDC
        IMarketOracle.MarketConditions memory conditions = IMarketOracle.MarketConditions({
            activeTakers: 3,
            averageTakerCapacity: 5.33 ether, // (10+5+1)/3
            totalLiquidity: 50 ether,
            networkCongestion: 30,
            gasPrice: 20 gwei,
            timestamp: currentTime // Use current timestamp explicitly
        });
        
        vm.prank(charlie.addr);
        marketOracle.updateMarketConditions(address(usdc), conditions);
        
        // Ensure the update is recorded with current timestamp
        vm.warp(currentTime + 1); // Advance time slightly to ensure freshness
    }
    
    /* solhint-disable func-name-mixedcase */
    
    function test_GetRecommendedMode_HighUrgency() public {
        (DynamicEscrowFactory.OptimizationMode mode, string memory reason) = 
            dynamicFactory.getRecommendedMode(address(usdc), 1 ether, 90);
        
        assertEq(uint256(mode), uint256(DynamicEscrowFactory.OptimizationMode.GAS_OPTIMIZED));
        assertEq(reason, "High urgency requires fast execution");
    }
    
    function test_GetRecommendedMode_LowLiquidity() public {
        // Update market conditions to have low liquidity
        IMarketOracle.MarketConditions memory lowLiquidityConditions = IMarketOracle.MarketConditions({
            activeTakers: 3,
            averageTakerCapacity: 5.33 ether,
            totalLiquidity: 1 ether, // Very low liquidity
            networkCongestion: 30,
            gasPrice: 20 gwei,
            timestamp: block.timestamp
        });
        
        // ROOT CAUSE FIX: Update conditions with proper timestamp and ensure freshness
        lowLiquidityConditions.timestamp = block.timestamp;
        
        vm.prank(charlie.addr);
        marketOracle.updateMarketConditions(address(usdc), lowLiquidityConditions);
        
        // Advance time slightly but stay within freshness threshold (300 seconds)
        vm.warp(block.timestamp + 10); // 10 seconds forward, well within 300s threshold
        
        (DynamicEscrowFactory.OptimizationMode mode, string memory reason) = 
            dynamicFactory.getRecommendedMode(address(usdc), 5 ether, 50);
        
        assertEq(uint256(mode), uint256(DynamicEscrowFactory.OptimizationMode.LIQUIDITY_OPTIMIZED));
        assertEq(reason, "Low liquidity requires optimization");
    }
    
    function test_GetRecommendedMode_HighCongestion() public {
        // Update market conditions to have high network congestion
        IMarketOracle.MarketConditions memory highCongestionConditions = IMarketOracle.MarketConditions({
            activeTakers: 3,
            averageTakerCapacity: 5.33 ether,
            totalLiquidity: 50 ether,
            networkCongestion: 80, // High congestion
            gasPrice: 100 gwei,
            timestamp: block.timestamp
        });
        
        // ROOT CAUSE FIX: Update conditions with proper timestamp and ensure freshness
        highCongestionConditions.timestamp = block.timestamp;
        
        vm.prank(charlie.addr);
        marketOracle.updateMarketConditions(address(usdc), highCongestionConditions);
        
        // Advance time slightly but stay within freshness threshold (300 seconds)
        vm.warp(block.timestamp + 10); // 10 seconds forward, well within 300s threshold
        
        (DynamicEscrowFactory.OptimizationMode mode, string memory reason) = 
            dynamicFactory.getRecommendedMode(address(usdc), 1 ether, 50);
        
        assertEq(uint256(mode), uint256(DynamicEscrowFactory.OptimizationMode.STATIC));
        assertEq(reason, "High network congestion");
    }
    
    function test_GetRecommendedMode_NormalConditions() public {
        (DynamicEscrowFactory.OptimizationMode mode, string memory reason) = 
            dynamicFactory.getRecommendedMode(address(usdc), 1 ether, 50);
        
        assertEq(uint256(mode), uint256(DynamicEscrowFactory.OptimizationMode.DYNAMIC));
        assertEq(reason, "Normal market conditions");
    }
    
    function testFuzz_DynamicOptimization_VariousAmounts(uint256 amount) public {
        vm.assume(amount >= 0.1 ether && amount <= 100 ether);
        
        // Test that the system can handle various order amounts
        (DynamicEscrowFactory.OptimizationMode mode,) = 
            dynamicFactory.getRecommendedMode(address(usdc), amount, 50);
        
        // Should always return a valid mode
        assertTrue(uint256(mode) <= uint256(DynamicEscrowFactory.OptimizationMode.LIQUIDITY_OPTIMIZED));
    }
    
    function testFuzz_DynamicOptimization_VariousUrgency(uint256 urgency) public {
        vm.assume(urgency <= 100);
        
        (DynamicEscrowFactory.OptimizationMode mode,) = 
            dynamicFactory.getRecommendedMode(address(usdc), 1 ether, urgency);
        
        if (urgency > 80) {
            assertEq(uint256(mode), uint256(DynamicEscrowFactory.OptimizationMode.GAS_OPTIMIZED));
        } else {
            // Should be one of the other modes
            assertTrue(uint256(mode) != uint256(DynamicEscrowFactory.OptimizationMode.GAS_OPTIMIZED) || urgency > 80);
        }
    }
    
    function test_MarketOracle_CalculateOptimalParts() public {
        IMarketOracle.OptimizationParams memory params = IMarketOracle.OptimizationParams({
            orderAmount: 10 ether,
            minPartSize: 0.1 ether,
            maxParts: 100,
            token: address(usdc),
            urgency: 50
        });
        
        (uint256 optimalParts, uint256 confidence) = marketOracle.calculateOptimalParts(params);
        
        // Should return reasonable values
        assertGt(optimalParts, 0);
        assertLe(optimalParts, 100);
        assertGt(confidence, 0);
        assertLe(confidence, 10000);
    }
    
    function test_MarketOracle_EstimateGasCost() public {
        uint256 gasCost1Part = marketOracle.estimateGasCost(1 ether, 1);
        uint256 gasCost10Parts = marketOracle.estimateGasCost(1 ether, 10);
        
        // More parts should cost more gas
        assertGt(gasCost10Parts, gasCost1Part);
        
        // Should be reasonable gas costs
        assertGt(gasCost1Part, 21000); // At least base transaction cost
        assertLt(gasCost10Parts, 1000000); // Less than 1M gas
    }
    
    function test_MarketOracle_IsMarketFavorable() public {
        // Should be favorable with good conditions
        assertTrue(marketOracle.isMarketFavorable(address(usdc), 1 ether));
        
        // Update to unfavorable conditions
        IMarketOracle.MarketConditions memory badConditions = IMarketOracle.MarketConditions({
            activeTakers: 0, // No takers
            averageTakerCapacity: 0,
            totalLiquidity: 0.1 ether, // Very low liquidity
            networkCongestion: 90, // High congestion
            gasPrice: 200 gwei,
            timestamp: block.timestamp
        });
        
        // ROOT CAUSE FIX: Update conditions with proper timestamp and ensure freshness
        badConditions.timestamp = block.timestamp;
        
        vm.prank(charlie.addr);
        marketOracle.updateMarketConditions(address(usdc), badConditions);
        
        // Advance time slightly but stay within freshness threshold (300 seconds)
        vm.warp(block.timestamp + 10); // 10 seconds forward, well within 300s threshold
        
        // Should not be favorable now
        assertFalse(marketOracle.isMarketFavorable(address(usdc), 1 ether));
    }
    
    function test_TakerRegistry_GetAvailableTakers() public {
        (address[] memory takers, uint256 totalCapacity) = 
            takerRegistry.getAvailableTakers(address(usdc), 1 ether);
        
        // Should return all 3 registered takers
        assertEq(takers.length, 3);
        assertEq(totalCapacity, 16 ether); // 10 + 5 + 1
        
        // Check that returned takers are correct
        bool foundTaker1 = false;
        bool foundTaker2 = false;
        bool foundTaker3 = false;
        
        for (uint256 i = 0; i < takers.length; i++) {
            if (takers[i] == taker1) foundTaker1 = true;
            if (takers[i] == taker2) foundTaker2 = true;
            if (takers[i] == taker3) foundTaker3 = true;
        }
        
        assertTrue(foundTaker1);
        assertTrue(foundTaker2);
        assertTrue(foundTaker3);
    }
    
    function test_TakerRegistry_GetOptimalDistribution() public {
        (address[] memory takers, uint256[] memory amounts) = 
            takerRegistry.getOptimalDistribution(address(usdc), 8 ether);
        
        // Should distribute among available takers
        assertGt(takers.length, 0);
        assertEq(takers.length, amounts.length);
        
        // Total amounts should equal requested amount
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        assertEq(totalAmount, 8 ether);
    }
    
    function test_TakerRegistry_RecordFill() public {
        ITakerRegistry.TakerStats memory statsBefore = takerRegistry.getTakerStats(taker1);
        
        // Record a fill
        takerRegistry.recordFill(taker1, 2 ether, 160000);
        
        ITakerRegistry.TakerStats memory statsAfter = takerRegistry.getTakerStats(taker1);
        
        // Stats should be updated
        assertEq(statsAfter.totalFills, statsBefore.totalFills + 1);
        assertEq(statsAfter.totalVolume, statsBefore.totalVolume + 2 ether);
        assertGt(statsAfter.reputation, statsBefore.reputation); // Should increase
    }
    
    function testFuzz_TakerRegistry_VariousAmounts(uint256 amount) public {
        vm.assume(amount >= 0.01 ether && amount <= 100 ether);
        
        (address[] memory takers, uint256 totalCapacity) = 
            takerRegistry.getAvailableTakers(address(usdc), amount);
        
        // Should always return valid data
        if (takers.length > 0) {
            assertGt(totalCapacity, 0);
        }
        
        // If amount is small enough, should find takers
        if (amount <= 1 ether) {
            assertGt(takers.length, 0); // taker3 can handle 1 ether
        }
    }
    
    function test_DynamicFactory_AdminFunctions() public {
        // Test setting dynamic optimization
        vm.prank(charlie.addr);
        dynamicFactory.setDynamicOptimization(false);
        
        // Test setting gas cost parameters
        vm.prank(charlie.addr);
        dynamicFactory.setMaxGasCostPerPart(75000);
        
        // Test setting confidence level
        vm.prank(charlie.addr);
        dynamicFactory.setMinConfidenceLevel(8000);
        
        // Non-owner should not be able to call admin functions
        vm.prank(alice.addr);
        vm.expectRevert("Only owner");
        dynamicFactory.setDynamicOptimization(true);
    }
    
    function test_MarketOracle_AdminFunctions() public {
        // Test setting weights
        vm.prank(charlie.addr);
        marketOracle.setWeights(50, 30, 20);
        
        // Test setting gas parameters
        vm.prank(charlie.addr);
        marketOracle.setGasParameters(25000, 20000, 130);
        
        // Test emergency update
        vm.prank(charlie.addr);
        marketOracle.emergencyUpdateMarketData(address(dai), 100 ether, 5);
        
        // Non-owner should not be able to call admin functions
        vm.prank(alice.addr);
        vm.expectRevert();
        marketOracle.setWeights(60, 25, 15);
    }
    
    function test_TakerRegistry_AdminFunctions() public {
        // Test deactivating a taker
        vm.prank(charlie.addr);
        takerRegistry.deactivateTaker(taker1, "Test deactivation");
        
        ITakerRegistry.TakerInfo memory info = takerRegistry.getTakerInfo(taker1);
        assertFalse(info.isActive);
        
        // Test updating reputation
        vm.prank(charlie.addr);
        takerRegistry.updateTakerReputation(taker2, 9000);
        
        ITakerRegistry.TakerStats memory stats = takerRegistry.getTakerStats(taker2);
        assertEq(stats.reputation, 9000);
        
        // Test emergency pause
        vm.prank(charlie.addr);
        takerRegistry.emergencyPause(taker3);
        
        ITakerRegistry.TakerInfo memory info3 = takerRegistry.getTakerInfo(taker3);
        assertFalse(info3.isActive);
    }
    
    /* solhint-enable func-name-mixedcase */
}