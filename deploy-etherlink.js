require('dotenv').config();
const { ethers } = require('hardhat');

/**
 * 🏆 ETHGlobal Unite - Deploy on Etherlink
 * 
 * This script deploys your LimitOrderProtocol on Etherlink for the hackathon
 */

async function main() {
    console.log('🏆 ETHGlobal Unite - Deploying on Etherlink...\n');
    
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying with account:', deployer.address);
    
    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance < ethers.parseEther('0.01')) {
        console.log('⚠️  Low balance! Get Etherlink testnet ETH from faucet');
        console.log('🚰 Faucet: https://faucet.etherlink.com/');
    }

    // Your deployed EscrowFactory addresses
    const SEPOLIA_ESCROW_FACTORY = process.env.SEPOLIA_ESCROW_FACTORY_ADDRESS;
    const ETHERLINK_ESCROW_FACTORY = process.env.ETHERLINK_ESCROW_FACTORY_ADDRESS;
    
    console.log('\n🏭 Using your deployed EscrowFactory addresses:');
    console.log('   Sepolia:', SEPOLIA_ESCROW_FACTORY);
    console.log('   Etherlink:', ETHERLINK_ESCROW_FACTORY);

    // =============================================================================
    // DEPLOY LIMITORDERPROTOCOL ON ETHERLINK
    // =============================================================================
    console.log('\n📋 Deploying LimitOrderProtocol on Etherlink...');
    
    const LimitOrderProtocol = await ethers.getContractFactory('LimitOrderProtocol');
    const lop = await LimitOrderProtocol.deploy(
        deployer.address, // owner
        "EtherlinkLOP", // EIP712 name
        "1" // EIP712 version
    );
    await lop.waitForDeployment();
    
    const lopAddress = await lop.getAddress();
    console.log('✅ LimitOrderProtocol deployed to:', lopAddress);

    // =============================================================================
    // CONFIGURE FOR CROSS-CHAIN
    // =============================================================================
    console.log('\n⚙️  Configuring cross-chain support...');
    
    // Set EscrowFactory addresses for both chains
    if (SEPOLIA_ESCROW_FACTORY) {
        await (await lop.setEscrowFactory(11155111, SEPOLIA_ESCROW_FACTORY)).wait();
        console.log('✅ Sepolia EscrowFactory configured');
    }
    
    if (ETHERLINK_ESCROW_FACTORY) {
        await (await lop.setEscrowFactory(128123, ETHERLINK_ESCROW_FACTORY)).wait();
        console.log('✅ Etherlink EscrowFactory configured');
    }
    
    // Authorize deployer as resolver and price relayer
    await (await lop.setResolverAuthorization(deployer.address, true)).wait();
    console.log('✅ Resolver authorized');
    
    await (await lop.setPriceRelayerAuthorization(deployer.address, true)).wait();
    console.log('✅ Price relayer authorized');

    // =============================================================================
    // VERIFY DEPLOYMENT
    // =============================================================================
    console.log('\n🔍 Verifying deployment...');
    
    const network = await deployer.provider.getNetwork();
    const owner = await lop.owner();
    const sepoliaFactory = SEPOLIA_ESCROW_FACTORY ? await lop.escrowFactories(11155111) : 'Not set';
    const etherlinkFactory = ETHERLINK_ESCROW_FACTORY ? await lop.escrowFactories(128123) : 'Not set';
    const isResolverAuthorized = await lop.authorizedResolvers(deployer.address);
    
    console.log('📊 Deployment Summary:');
    console.log('   Network:', network.name, `(Chain ID: ${network.chainId})`);
    console.log('   Contract:', lopAddress);
    console.log('   Owner:', owner);
    console.log('   Sepolia Factory:', sepoliaFactory);
    console.log('   Etherlink Factory:', etherlinkFactory);
    console.log('   Resolver Authorized:', isResolverAuthorized);

    // =============================================================================
    // HACKATHON SUBMISSION INFO
    // =============================================================================
    console.log('\n🏆 HACKATHON SUBMISSION READY!');
    console.log('=' .repeat(60));
    console.log('📋 Contract Details:');
    console.log(`   Address: ${lopAddress}`);
    console.log(`   Network: Etherlink Ghostnet`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log('');
    console.log('🎯 1inch Fusion+ Extensions:');
    console.log('   ✅ Cross-chain atomic swaps');
    console.log('   ✅ EIP-712 compatible orders');
    console.log('   ✅ Resolver competition');
    console.log('   ✅ Secret hash locks');
    console.log('   ✅ EscrowFactory integration');
    console.log('');
    console.log('📝 Add to your .env:');
    console.log(`ETHERLINK_HYBRID_LOP_ADDRESS=${lopAddress}`);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Update .env with LOP address');
    console.log('2. Start relayer: cd Relayer && npm start');
    console.log('3. Run demo: node demo-cli.js');
    console.log('4. Present to judges! 🎉');

    // =============================================================================
    // SAVE DEPLOYMENT INFO
    // =============================================================================
    const deploymentInfo = {
        hackathon: 'ETHGlobal Unite',
        timestamp: new Date().toISOString(),
        network: {
            name: network.name,
            chainId: Number(network.chainId)
        },
        contracts: {
            limitOrderProtocol: lopAddress,
            sepoliaEscrowFactory: SEPOLIA_ESCROW_FACTORY,
            etherlinkEscrowFactory: ETHERLINK_ESCROW_FACTORY
        },
        deployer: deployer.address,
        features: [
            '1inch Fusion+ Extension',
            'Cross-chain Atomic Swaps',
            'EIP-712 Compatible Orders',
            'Resolver Competition',
            'Secret Hash Locks'
        ]
    };

    // Write deployment info
    const fs = require('fs');
    const path = require('path');
    
    const deploymentFile = path.join(__dirname, 'hackathon-deployment.json');
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`💾 Deployment info saved to: hackathon-deployment.json`);

    return deploymentInfo;
}

// Execute deployment
main()
    .then((deploymentInfo) => {
        console.log('\n🎉 Ready for ETHGlobal Unite judging! 🏆');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Deployment failed:', error);
        process.exit(1);
    });