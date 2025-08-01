// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../LimitOrderProtocol/LimitOrderProtocol.sol";

/**
 * @title Deploy LimitOrderProtocol
 * @dev Foundry deployment script for ETHGlobal Unite hackathon
 */
contract DeployLOP is Script {
    // Your deployed EscrowFactory addresses
    address constant SEPOLIA_ESCROW_FACTORY = 0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312;
    address constant ETHERLINK_ESCROW_FACTORY = 0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("ETHGlobal Unite - Deploying LimitOrderProtocol");
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance / 1e18, "ETH");
        
        // Check which network we're deploying to
        uint256 chainId = block.chainid;
        console.log("Chain ID:", chainId);
        
        string memory networkName;
        if (chainId == 128123) {
            networkName = "Etherlink Testnet";
        } else if (chainId == 11155111) {
            networkName = "Sepolia";
        } else {
            networkName = "Unknown";
        }
        console.log("Network:", networkName);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy LimitOrderProtocol
        console.log("Deploying LimitOrderProtocol...");
        LimitOrderProtocol lop = new LimitOrderProtocol(
            deployer,           // owner
            "EtherlinkLOP",    // EIP712 name
            "1"                // EIP712 version
        );
        
        console.log("LimitOrderProtocol deployed to:", address(lop));

        // Configure EscrowFactory addresses for cross-chain support
        console.log("Configuring cross-chain support...");
        
        // Set Sepolia EscrowFactory (chain ID 11155111)
        lop.setEscrowFactory(11155111, SEPOLIA_ESCROW_FACTORY);
        console.log("Sepolia EscrowFactory configured:", SEPOLIA_ESCROW_FACTORY);
        
        // Set Etherlink EscrowFactory (chain ID 128123)
        lop.setEscrowFactory(128123, ETHERLINK_ESCROW_FACTORY);
        console.log("Etherlink EscrowFactory configured:", ETHERLINK_ESCROW_FACTORY);

        // Authorize deployer as resolver and price relayer
        console.log("Setting up authorizations...");
        lop.setResolverAuthorization(deployer, true);
        console.log("Resolver authorized:", deployer);
        
        lop.setPriceRelayerAuthorization(deployer, true);
        console.log("Price relayer authorized:", deployer);

        // Stop broadcasting
        vm.stopBroadcast();

        // Verification and summary
        console.log("Verifying deployment...");
        console.log("   Contract Address:", address(lop));
        console.log("   Owner:", lop.owner());
        console.log("   Sepolia Factory:", lop.escrowFactories(11155111));
        console.log("   Etherlink Factory:", lop.escrowFactories(128123));
        console.log("   Resolver Authorized:", lop.authorizedResolvers(deployer));

        // Hackathon submission info
        console.log("HACKATHON SUBMISSION READY!");
        console.log("Contract Details:");
        console.log("   Address:", address(lop));
        console.log("   Network:", networkName);
        console.log("   Chain ID:", chainId);
        console.log("   Deployer:", deployer);
        console.log("");
        console.log("1inch Fusion+ Extensions:");
        console.log("   Cross-chain atomic swaps");
        console.log("   EIP-712 compatible orders");
        console.log("   Resolver competition");
        console.log("   Secret hash locks");
        console.log("   EscrowFactory integration");
        console.log("");
        console.log("Add to your .env:");
        if (chainId == 128123) {
            console.log("ETHERLINK_HYBRID_LOP_ADDRESS=", address(lop));
        } else if (chainId == 11155111) {
            console.log("SEPOLIA_HYBRID_LOP_ADDRESS=", address(lop));
        }
        console.log("");
        console.log("Next Steps:");
        console.log("1. Update .env with LOP address");
        console.log("2. Start relayer: cd Relayer && npm start");
        console.log("3. Run demo: node demo-cli.js");
        console.log("4. Present to judges!");
    }
}