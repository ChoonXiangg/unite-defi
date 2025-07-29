// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import { DynamicEscrowFactory } from "../contracts/DynamicEscrowFactory.sol";
import { MarketOracle } from "../contracts/MarketOracle.sol";
import { TakerRegistry } from "../contracts/TakerRegistry.sol";
import { IFeeBank } from "limit-order-settlement/contracts/interfaces/IFeeBank.sol";

/**
 * @title Deploy Dynamic Escrow Factory Script
 * @notice Deployment script for production-ready dynamic escrow factory system
 * @dev Deploys all components: TakerRegistry, MarketOracle, and DynamicEscrowFactory
 */
contract DeployDynamicEscrowFactory is Script {
    
    // Configuration
    struct DeploymentConfig {
        address limitOrderProtocol;
        address feeToken;           // 1INCH token
        address accessToken;        // Access control token
        address owner;              // Contract owner
        address feeBank;            // Fee bank contract
        uint32 rescueDelaySrc;      // Rescue delay for source chain
        uint32 rescueDelayDst;      // Rescue delay for destination chain
    }
    
    // Deployed contracts
    TakerRegistry public takerRegistry;
    MarketOracle public marketOracle;
    DynamicEscrowFactory public dynamicFactory;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying Dynamic Escrow Factory System...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        
        // Get deployment configuration
        DeploymentConfig memory config = getDeploymentConfig();
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy TakerRegistry
        console.log("Deploying TakerRegistry...");
        takerRegistry = new TakerRegistry(config.owner);
        console.log("TakerRegistry deployed at:", address(takerRegistry));
        
        // Deploy MarketOracle
        console.log("Deploying MarketOracle...");
        marketOracle = new MarketOracle(takerRegistry, config.owner);
        console.log("MarketOracle deployed at:", address(marketOracle));
        
        // Deploy DynamicEscrowFactory
        console.log("Deploying DynamicEscrowFactory...");
        dynamicFactory = new DynamicEscrowFactory(
            config.limitOrderProtocol,
            IERC20(config.feeToken),
            IERC20(config.accessToken),
            config.owner,
            config.rescueDelaySrc,
            config.rescueDelayDst,
            IFeeBank(config.feeBank),
            marketOracle,
            takerRegistry
        );
        console.log("DynamicEscrowFactory deployed at:", address(dynamicFactory));
        
        // Initial configuration
        console.log("Setting up initial configuration...");
        setupInitialConfiguration();
        
        vm.stopBroadcast();
        
        // Log deployment summary
        logDeploymentSummary(config);
        
        // Save deployment addresses
        saveDeploymentAddresses();
    }
    
    function getDeploymentConfig() internal view returns (DeploymentConfig memory config) {
        uint256 chainId = block.chainid;
        
        if (chainId == 1) {
            // Ethereum Mainnet
            config = DeploymentConfig({
                limitOrderProtocol: 0x111111125421cA6dc452d289314280a0f8842A65, // 1inch LOP
                feeToken: 0x111111111117dC0aa78b770fA6A738034120C302,           // 1INCH
                accessToken: vm.envAddress("ACCESS_TOKEN"),
                owner: vm.envAddress("OWNER_ADDRESS"),
                feeBank: vm.envAddress("FEE_BANK"),
                rescueDelaySrc: 7 days,
                rescueDelayDst: 7 days
            });
        } else if (chainId == 137) {
            // Polygon
            config = DeploymentConfig({
                limitOrderProtocol: 0x111111125421cA6dc452d289314280a0f8842A65, // 1inch LOP
                feeToken: 0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f,           // 1INCH on Polygon
                accessToken: vm.envAddress("ACCESS_TOKEN"),
                owner: vm.envAddress("OWNER_ADDRESS"),
                feeBank: vm.envAddress("FEE_BANK"),
                rescueDelaySrc: 7 days,
                rescueDelayDst: 7 days
            });
        } else if (chainId == 42161) {
            // Arbitrum
            config = DeploymentConfig({
                limitOrderProtocol: 0x111111125421cA6dc452d289314280a0f8842A65, // 1inch LOP
                feeToken: 0x6314C31A7a1652cE482cffe247E9CB7c3f4BB9aF,           // 1INCH on Arbitrum
                accessToken: vm.envAddress("ACCESS_TOKEN"),
                owner: vm.envAddress("OWNER_ADDRESS"),
                feeBank: vm.envAddress("FEE_BANK"),
                rescueDelaySrc: 7 days,
                rescueDelayDst: 7 days
            });
        } else {
            // Testnet or local development
            config = DeploymentConfig({
                limitOrderProtocol: vm.envOr("LIMIT_ORDER_PROTOCOL", address(0)),
                feeToken: vm.envOr("FEE_TOKEN", address(0)),
                accessToken: vm.envOr("ACCESS_TOKEN", address(0)),
                owner: vm.envOr("OWNER_ADDRESS", msg.sender),
                feeBank: vm.envOr("FEE_BANK", address(0)),
                rescueDelaySrc: 1 hours, // Shorter for testing
                rescueDelayDst: 1 hours
            });
        }
        
        // Validate configuration
        require(config.limitOrderProtocol != address(0), "Invalid LimitOrderProtocol address");
        require(config.feeToken != address(0), "Invalid fee token address");
        require(config.owner != address(0), "Invalid owner address");
    }
    
    function setupInitialConfiguration() internal {
        // Set optimal weights for market oracle
        marketOracle.setWeights(40, 35, 25); // 40% liquidity, 35% takers, 25% gas
        
        // Set gas parameters
        marketOracle.setGasParameters(21000, 15000, 120);
        
        // Enable dynamic optimization
        dynamicFactory.setDynamicOptimization(true);
        
        // Set reasonable gas cost limits
        dynamicFactory.setMaxGasCostPerPart(50000);
        
        // Set confidence threshold
        dynamicFactory.setMinConfidenceLevel(7000); // 70%
        
        console.log("Initial configuration completed");
    }
    
    function logDeploymentSummary(DeploymentConfig memory config) internal view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Chain ID:", block.chainid);
        console.log("Owner:", config.owner);
        console.log("Limit Order Protocol:", config.limitOrderProtocol);
        console.log("Fee Token:", config.feeToken);
        console.log("Access Token:", config.accessToken);
        console.log("Fee Bank:", config.feeBank);
        console.log("\n=== DEPLOYED CONTRACTS ===");
        console.log("TakerRegistry:", address(takerRegistry));
        console.log("MarketOracle:", address(marketOracle));
        console.log("DynamicEscrowFactory:", address(dynamicFactory));
        console.log("\n=== CONFIGURATION ===");
        console.log("Rescue Delay Src:", config.rescueDelaySrc);
        console.log("Rescue Delay Dst:", config.rescueDelayDst);
        console.log("Dynamic Optimization: Enabled");
        console.log("Max Gas Cost Per Part: 50,000");
        console.log("Min Confidence Level: 70%");
        console.log("Oracle Weights: 40% Liquidity, 35% Takers, 25% Gas");
    }
    
    function saveDeploymentAddresses() internal {
        string memory chainId = vm.toString(block.chainid);
        string memory deploymentFile = string.concat("deployments/", chainId, "/DynamicEscrowFactory.json");
        
        string memory json = string.concat(
            '{\n',
            '  "takerRegistry": "', vm.toString(address(takerRegistry)), '",\n',
            '  "marketOracle": "', vm.toString(address(marketOracle)), '",\n',
            '  "dynamicEscrowFactory": "', vm.toString(address(dynamicFactory)), '",\n',
            '  "deployedAt": ', vm.toString(block.timestamp), ',\n',
            '  "chainId": ', chainId, '\n',
            '}'
        );
        
        vm.writeFile(deploymentFile, json);
        console.log("Deployment addresses saved to:", deploymentFile);
    }
    
    // Helper function to register initial takers (call separately after deployment)
    function registerInitialTakers() external {
        require(address(takerRegistry) != address(0), "TakerRegistry not deployed");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Example: Register some initial takers
        address[] memory supportedTokens = new address[](2);
        supportedTokens[0] = address(0); // Placeholder address
        supportedTokens[1] = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // Example DAI
        
        // This would be called by actual takers
        // takerRegistry.registerTaker(10 ether, supportedTokens);
        
        vm.stopBroadcast();
        
        console.log("Initial taker registration template created");
        console.log("Takers should call registerTaker() with their capacity and supported tokens");
    }
    
    // Helper function to setup initial market data (call separately after deployment)
    function setupInitialMarketData() external {
        require(address(marketOracle) != address(0), "MarketOracle not deployed");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Setup initial market data for major tokens
        address[] memory tokens = new address[](3);
        tokens[0] = address(0); // Placeholder USDC
        tokens[1] = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // DAI  
        tokens[2] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH
        
        for (uint256 i = 0; i < tokens.length; i++) {
            marketOracle.emergencyUpdateMarketData(
                tokens[i],
                1000 ether, // Initial liquidity estimate
                5           // Initial taker count estimate
            );
        }
        
        vm.stopBroadcast();
        
        console.log("Initial market data setup completed");
    }
}