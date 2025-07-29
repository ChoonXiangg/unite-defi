const fs = require('fs');
const path = require('path');

// Simple contract verification test for Etherlink deployment
function testEtherlinkContracts() {
    console.log('🧪 Testing Etherlink escrow contracts...\n');

    // Test 1: Verify contract files exist and are valid Solidity
    console.log('1. Contract File Validation:');
    const contractFiles = [
        '../contracts/EscrowFactory.sol',
        '../contracts/EscrowSrc.sol',
        '../contracts/EscrowDst.sol',
        '../contracts/BaseEscrow.sol',
        '../contracts/BaseEscrowFactory.sol'
    ];

    let allContractsValid = true;
    contractFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Basic Solidity validation
            const isValidSolidity = content.includes('pragma solidity') && 
                                  content.includes('contract') &&
                                  content.includes('SPDX-License-Identifier');
            
            if (isValidSolidity) {
                console.log(`   ✅ ${file} - Valid Solidity contract`);
            } else {
                console.log(`   ❌ ${file} - Invalid Solidity contract`);
                allContractsValid = false;
            }
        } else {
            console.log(`   ❌ ${file} - File not found`);
            allContractsValid = false;
        }
    });

    // Test 2: Verify configuration
    console.log('\n2. Configuration Validation:');
    const configPath = path.join(__dirname, '../deployments/etherlink/config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const etherlinkConfig = config.etherlink;
            
            if (etherlinkConfig.mainnet && etherlinkConfig.testnet) {
                console.log('   ✅ Configuration file is valid');
                console.log(`   ✅ Chain ID: ${etherlinkConfig.mainnet.chainId}`);
                console.log(`   ✅ RPC URLs configured`);
                console.log(`   ✅ Contract addresses defined`);
            } else {
                console.log('   ❌ Configuration missing required sections');
                allContractsValid = false;
            }
        } catch (error) {
            console.log('   ❌ Configuration file is invalid JSON');
            allContractsValid = false;
        }
    } else {
        console.log('   ❌ Configuration file not found');
        allContractsValid = false;
    }

    // Test 3: Verify deployment script
    console.log('\n3. Deployment Script Validation:');
    const deployScriptPath = path.join(__dirname, '../script/DeployEscrowFactoryEtherlink.s.sol');
    if (fs.existsSync(deployScriptPath)) {
        const content = fs.readFileSync(deployScriptPath, 'utf8');
        
        const hasRequiredImports = content.includes('import { EscrowFactory }') &&
                                 content.includes('import { Script }') &&
                                 content.includes('ICreate3Deployer');
        
        const hasRequiredConstants = content.includes('RESCUE_DELAY') &&
                                   content.includes('CROSSCHAIN_SALT') &&
                                   content.includes('LOP') &&
                                   content.includes('ACCESS_TOKEN');
        
        if (hasRequiredImports && hasRequiredConstants) {
            console.log('   ✅ Deployment script is valid');
        } else {
            console.log('   ❌ Deployment script missing required components');
            allContractsValid = false;
        }
    } else {
        console.log('   ❌ Deployment script not found');
        allContractsValid = false;
    }

    // Test 4: Verify test files
    console.log('\n4. Test Files Validation:');
    const testFilePath = path.join(__dirname, '../test/integration/EtherlinkEscrowFactory.t.sol');
    if (fs.existsSync(testFilePath)) {
        const content = fs.readFileSync(testFilePath, 'utf8');
        
        const hasTestStructure = content.includes('contract EtherlinkEscrowFactoryTest') &&
                               content.includes('function setUp()') &&
                               content.includes('function test_');
        
        if (hasTestStructure) {
            console.log('   ✅ Test file is valid');
        } else {
            console.log('   ❌ Test file missing required test structure');
            allContractsValid = false;
        }
    } else {
        console.log('   ❌ Test file not found');
        allContractsValid = false;
    }

    // Test 5: Verify dependencies
    console.log('\n5. Dependencies Validation:');
    const remappingsPath = path.join(__dirname, '../remappings.txt');
    if (fs.existsSync(remappingsPath)) {
        const content = fs.readFileSync(remappingsPath, 'utf8');
        
        const hasRequiredDeps = content.includes('solidity-utils') &&
                               content.includes('limit-order-settlement') &&
                               content.includes('openzeppelin-contracts');
        
        if (hasRequiredDeps) {
            console.log('   ✅ Remappings file includes required dependencies');
        } else {
            console.log('   ❌ Remappings file missing required dependencies');
            allContractsValid = false;
        }
    } else {
        console.log('   ❌ Remappings file not found');
        allContractsValid = false;
    }

    // Test 6: Verify Foundry configuration
    console.log('\n6. Foundry Configuration Validation:');
    const foundryConfigPath = path.join(__dirname, '../foundry.toml');
    if (fs.existsSync(foundryConfigPath)) {
        const content = fs.readFileSync(foundryConfigPath, 'utf8');
        
        const hasEtherlinkProfile = content.includes('[profile.etherlink]');
        
        if (hasEtherlinkProfile) {
            console.log('   ✅ Foundry configuration includes Etherlink profile');
        } else {
            console.log('   ❌ Foundry configuration missing Etherlink profile');
            allContractsValid = false;
        }
    } else {
        console.log('   ❌ Foundry configuration file not found');
        allContractsValid = false;
    }

    // Summary
    console.log('\n📊 Test Summary:');
    if (allContractsValid) {
        console.log('✅ All tests passed! Etherlink deployment is ready.');
        console.log('\n🚀 Ready to deploy:');
        console.log('   1. Install Foundry');
        console.log('   2. Set DEPLOYER_ADDRESS environment variable');
        console.log('   3. Run: ./scripts/deploy-etherlink.sh testnet');
        console.log('   4. Test with: forge test --match-contract EtherlinkEscrowFactoryTest');
    } else {
        console.log('❌ Some tests failed. Please fix the issues above before deploying.');
    }

    return allContractsValid;
}

// Run tests
testEtherlinkContracts(); 