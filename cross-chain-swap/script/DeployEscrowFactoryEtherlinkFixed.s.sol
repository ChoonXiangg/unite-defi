// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { EscrowFactory } from "contracts/EscrowFactory.sol";
import { console } from "forge-std/console.sol";

// Use your existing mocks
import { ERC20MintableMock } from "contracts/mocks/ERC20MintableMock.sol";
import { FeeBankMock } from "contracts/mocks/FeeBankMock.sol";

contract DeployEscrowFactoryEtherlinkFixed is Script {
    uint32 public constant RESCUE_DELAY = 691200; // 8 days

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        console.log("Deploying to Etherlink with proper interfaces...");
        console.log("Deployer address:", deployer);

        vm.startBroadcast();

        // Step 1: Deploy Fee Token (ERC20)
        ERC20MintableMock feeToken = new ERC20MintableMock();
        console.log("Fee Token deployed at:", address(feeToken));

        // Step 2: Deploy Access Token (ERC20)
        ERC20MintableMock accessToken = new ERC20MintableMock();
        console.log("Access Token deployed at:", address(accessToken));

        // Step 3: Deploy Fee Bank
        FeeBankMock feeBank = new FeeBankMock();
        console.log("Fee Bank deployed at:", address(feeBank));

        // Step 4: Deploy minimal LOP mock (just use fee token as placeholder)
        console.log("Using Fee Token as LOP placeholder:", address(feeToken));

        // Step 5: Deploy EscrowFactory with proper contract instances
        EscrowFactory escrowFactory = new EscrowFactory(
            address(feeToken),     // LOP (use fee token as placeholder)
            feeToken,              // Fee token (proper IERC20)
            accessToken,           // Access token (proper IERC20)
            deployer,              // Fee bank owner
            RESCUE_DELAY,          // Src rescue delay
            RESCUE_DELAY,          // Dst rescue delay
            feeBank                // Fee bank (proper IFeeBank)
        );

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("FeeToken:", address(feeToken));
        console.log("AccessToken:", address(accessToken));
        console.log("FeeBank:", address(feeBank));
        console.log("EscrowFactory:", address(escrowFactory));
        console.log("Deployment successful!");
    }
}
