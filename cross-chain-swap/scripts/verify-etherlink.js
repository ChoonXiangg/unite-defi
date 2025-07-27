const fs = require('fs');
const path = require('path');

// Etherlink configuration verification script
function verifyEtherlinkConfig() {
    console.log('🔍 Verifying Etherlink deployment configuration...\n');

    // Check if config file exists
    const configPath = path.join(__dirname, '../deployments/etherlink/config.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ Config file not found:', configPath);
        return false;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const etherlinkConfig = config.etherlink;

    console.log('✅ Configuration file found');
    console.log('📋 Network configurations:');

    // Verify mainnet config
    if (etherlinkConfig.mainnet) {
        console.log('\n🌐 Mainnet:');
        console.log(`   Chain ID: ${etherlinkConfig.mainnet.chainId}`);
        console.log(`   RPC URL: ${etherlinkConfig.mainnet.rpcUrl}`);
        console.log(`   Explorer: ${etherlinkConfig.mainnet.explorer}`);
        console.log(`   LOP: ${etherlinkConfig.mainnet.contracts.limitOrderProtocol}`);
        console.log(`   Access Token: ${etherlinkConfig.mainnet.contracts.accessToken}`);
        console.log(`   Create3 Deployer: ${etherlinkConfig.mainnet.contracts.create3Deployer}`);
        console.log(`   Fee Token: ${etherlinkConfig.mainnet.contracts.feeToken}`);
        console.log(`   Rescue Delay Src: ${etherlinkConfig.mainnet.timelocks.rescueDelaySrc}`);
        console.log(`   Rescue Delay Dst: ${etherlinkConfig.mainnet.timelocks.rescueDelayDst}`);
    }

    // Verify testnet config
    if (etherlinkConfig.testnet) {
        console.log('\n🧪 Testnet:');
        console.log(`   Chain ID: ${etherlinkConfig.testnet.chainId}`);
        console.log(`   RPC URL: ${etherlinkConfig.testnet.rpcUrl}`);
        console.log(`   Explorer: ${etherlinkConfig.testnet.explorer}`);
        console.log(`   LOP: ${etherlinkConfig.testnet.contracts.limitOrderProtocol}`);
        console.log(`   Access Token: ${etherlinkConfig.testnet.contracts.accessToken}`);
        console.log(`   Create3 Deployer: ${etherlinkConfig.testnet.contracts.create3Deployer}`);
        console.log(`   Fee Token: ${etherlinkConfig.testnet.contracts.feeToken}`);
        console.log(`   Rescue Delay Src: ${etherlinkConfig.testnet.timelocks.rescueDelaySrc}`);
        console.log(`   Rescue Delay Dst: ${etherlinkConfig.testnet.timelocks.rescueDelayDst}`);
    }

    // Verify contract files exist
    console.log('\n📄 Contract files:');
    const contractFiles = [
        '../contracts/EscrowFactory.sol',
        '../contracts/EscrowSrc.sol',
        '../contracts/EscrowDst.sol',
        '../contracts/BaseEscrow.sol',
        '../contracts/BaseEscrowFactory.sol'
    ];

    contractFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - NOT FOUND`);
        }
    });

    // Verify deployment scripts
    console.log('\n🚀 Deployment scripts:');
    const scriptFiles = [
        '../script/DeployEscrowFactoryEtherlink.s.sol',
        '../scripts/deploy-etherlink.sh'
    ];

    scriptFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - NOT FOUND`);
        }
    });

    // Verify test files
    console.log('\n🧪 Test files:');
    const testFiles = [
        '../test/integration/EtherlinkEscrowFactory.t.sol'
    ];

    testFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - NOT FOUND`);
        }
    });

    console.log('\n✅ Etherlink configuration verification completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Install Foundry: https://book.getfoundry.sh/getting-started/installation');
    console.log('   2. Set DEPLOYER_ADDRESS environment variable');
    console.log('   3. Run: ./scripts/deploy-etherlink.sh testnet');
    console.log('   4. Test the deployment with: forge test --match-contract EtherlinkEscrowFactoryTest');

    return true;
}

// Run verification
verifyEtherlinkConfig(); 