// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";

import { ICreate3Deployer } from "solidity-utils/contracts/interfaces/ICreate3Deployer.sol";

import { EscrowFactory } from "contracts/EscrowFactory.sol";

// solhint-disable no-console
import { console } from "forge-std/console.sol";

contract DeployEscrowFactoryEtherlink is Script {
    uint32 public constant RESCUE_DELAY = 691200; // 8 days
    bytes32 public constant CROSSCHAIN_SALT = keccak256("1inch EscrowFactory");
    
    // Etherlink specific addresses
    address public constant LOP = 0x111111125421cA6dc452d289314280a0f8842A65; // 1inch Limit Order Protocol
    address public constant ACCESS_TOKEN = 0xACCe550000159e70908C0499a1119D04e7039C28; // 1inch Access Token
    ICreate3Deployer public constant CREATE3_DEPLOYER = ICreate3Deployer(0x65B3Db8bAeF0215A1F9B14c506D2a3078b2C84AE); // Create3 Deployer
    
    // Etherlink fee token (using USDC as it's commonly available on Etherlink)
    address public constant FEE_TOKEN = address(0); // TODO: set actual USDC address on Etherlink

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address feeBankOwner = deployer;
        address feeToken = FEE_TOKEN;

        console.log("Deploying EscrowFactory to Etherlink...");
        console.log("Deployer address:", deployer);
        console.log("Fee token address:", feeToken);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast();
        address escrowFactory = CREATE3_DEPLOYER.deploy(
            CROSSCHAIN_SALT,
            abi.encodePacked(
                type(EscrowFactory).creationCode,
                abi.encode(LOP, feeToken, ACCESS_TOKEN, feeBankOwner, RESCUE_DELAY, RESCUE_DELAY)
            )
        );
        vm.stopBroadcast();

        console.log("Escrow Factory deployed at:", escrowFactory);
        console.log("Deployment successful!");
    }
}
// solhint-enable no-console 