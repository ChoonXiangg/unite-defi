// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { EscrowFactory } from "contracts/EscrowFactory.sol";
import { console } from "forge-std/console.sol";

contract DeployEscrowFactoryEtherlinkMinimal is Script {
    uint32 public constant RESCUE_DELAY = 691200; // 8 days

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        console.log("Deploying minimal version to Etherlink...");

        vm.startBroadcast();

        // Deploy EscrowFactory with deployer as all dependencies
        EscrowFactory escrowFactory = new EscrowFactory(
            deployer,      // LOP (mock - use deployer)
            address(0),    // Fee token (ETH)
            deployer,      // Access token (mock - use deployer)
            deployer,      // Fee bank owner
            RESCUE_DELAY,  // Src rescue delay
            RESCUE_DELAY,  // Dst rescue delay
            deployer       // Fee bank
        );

        vm.stopBroadcast();

        console.log("EscrowFactory deployed at:", address(escrowFactory));
        console.log("All dependencies set to deployer for testing");
    }
}
