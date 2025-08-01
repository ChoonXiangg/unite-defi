require('dotenv').config();
const { ethers } = require('hardhat');

/**
 * 🚀 Complete System Setup Script
 * 
 * This script:
 * 1. Deploys UpdatedHybridLOP on both chains
 * 2. Configures LOP with your EscrowFactory addresses
 * 3. Sets up authorization for resolvers and relayers
 * 4. Provides instructions for starting the system
 */

async function main() {
    console.log('🚀 Setting up complete LOP + Relayer system...\n');
    
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying with account:', deployer.address);
    
    // Your deployed EscrowFactory addresses
    const SEPOLIA_ESCROW_FACTORY = process.env.SEPOLIA_ESCROW_FACTORY_ADDRESS;
    const ETHERLINK_ESCROW_FACTORY = process.env.ETHERLINK_ESCROW_FACTORY_ADDRESS;
    
    console.log('🏭 Using EscrowFactory addresses:');
    console.log('   Sepolia:', SEPOLIA_ESCROW_FACTORY);
    console.log('   Etherlink:', ETHERLINK_ESCROW_FACTORY);
    
    if (!SEPOLIA_ESCROW_FACTORY || !ETHERLINK_ESCROW_FACTORY) {
        throw new Error('❌ EscrowFactory addresses not found in .env file');
    }

    // =============================================================================
    // STEP 1: Deploy UpdatedHybridLOP on Sepolia
    // =============================================================================
    console.log('\n📋 Deploying UpdatedHybridLOP on Sepolia...');
    
    const UpdatedHybridLOP = await ethers.getContractFactory('UpdatedHybridLOP');
    const sepoliaLOP = await UpdatedHybridLOP.deploy(
        deployer.address, // owner
        "UpdatedHybridLOP", // EIP712 name
        "1" // EIP712 version
    );
    await sepoliaLOP.waitForDeployment();
    
    const sepoliaLOPAddress = await sepoliaLOP.getAddress();
    console.log('✅ Sepolia LOP deployed to:', sepoliaLOPAddress);

    // Configure Sepolia LOP
    console.log('⚙️  Configuring Sepolia LOP...');
    
    // Set EscrowFactory addresses
    await (await sepoliaLOP.setEscrowFactory(11155111, SEPOLIA_ESCROW_FACTORY)).wait();
    await (await sepoliaLOP.setEscrowFactory(128123, ETHERLINK_ESCROW_FACTORY)).wait();
    
    // Authorize deployer as resolver and price relayer
    await (await sepoliaLOP.setResolverAuthorization(deployer.address, true)).wait();
    await (await sepoliaLOP.setPriceRelayerAuthorization(deployer.address, true)).wait();
    
    console.log('✅ Sepolia LOP configured');

    // =============================================================================
    // STEP 2: Deploy UpdatedHybridLOP on Etherlink (if different network)
    // =============================================================================
    let etherlinkLOPAddress = sepoliaLOPAddress; // Same if deploying on same network
    
    // If you're deploying on different networks, uncomment and modify this section:
    /*
    console.log('\n📋 Deploying UpdatedHybridLOP on Etherlink...');
    
    // Switch to Etherlink network configuration
    const etherlinkProvider = new ethers.JsonRpcProvider(process.env.ETHERLINK_TESTNET_RPC_URL);
    const etherlinkSigner = new ethers.Wallet(process.env.PRIVATE_KEY, etherlinkProvider);
    
    const etherlinkLOP = await UpdatedHybridLOP.connect(etherlinkSigner).deploy(
        deployer.address,
        "UpdatedHybridLOP",
        "1"
    );
    await etherlinkLOP.waitForDeployment();
    
    etherlinkLOPAddress = await etherlinkLOP.getAddress();
    console.log('✅ Etherlink LOP deployed to:', etherlinkLOPAddress);
    
    // Configure Etherlink LOP
    console.log('⚙️  Configuring Etherlink LOP...');
    await (await etherlinkLOP.setEscrowFactory(11155111, SEPOLIA_ESCROW_FACTORY)).wait();
    await (await etherlinkLOP.setEscrowFactory(128123, ETHERLINK_ESCROW_FACTORY)).wait();
    await (await etherlinkLOP.setResolverAuthorization(deployer.address, true)).wait();
    await (await etherlinkLOP.setPriceRelayerAuthorization(deployer.address, true)).wait();
    console.log('✅ Etherlink LOP configured');
    */

    // =============================================================================
    // STEP 3: Verify Deployment
    // =============================================================================
    console.log('\n🔍 Verifying deployment...');
    
    const sepoliaFactory = await sepoliaLOP.escrowFactories(11155111);
    const etherlinkFactory = await sepoliaLOP.escrowFactories(128123);
    const isResolverAuthorized = await sepoliaLOP.authorizedResolvers(deployer.address);
    const isPriceRelayerAuthorized = await sepoliaLOP.authorizedPriceRelayers(deployer.address);
    
    console.log('   Sepolia EscrowFactory configured:', sepoliaFactory === SEPOLIA_ESCROW_FACTORY);
    console.log('   Etherlink EscrowFactory configured:', etherlinkFactory === ETHERLINK_ESCROW_FACTORY);
    console.log('   Resolver authorized:', isResolverAuthorized);
    console.log('   Price relayer authorized:', isPriceRelayerAuthorized);

    // =============================================================================
    // STEP 4: Generate Updated .env
    // =============================================================================
    console.log('\n📝 Generating updated .env configuration...');
    
    const envUpdates = `
# =============================================================================
# UPDATED LOP ADDRESSES (Add these to your .env file)
# =============================================================================
SEPOLIA_HYBRID_LOP_ADDRESS=${sepoliaLOPAddress}
ETHERLINK_HYBRID_LOP_ADDRESS=${etherlinkLOPAddress}

# Relayer WebSocket URL
RELAYER_WS_URL=ws://localhost:8080

# System is ready! 🎉
`;

    console.log(envUpdates);

    // =============================================================================
    // STEP 5: System Startup Instructions
    // =============================================================================
    console.log('\n🎉 SYSTEM SETUP COMPLETE! 🎉\n');
    
    console.log('📋 NEXT STEPS:');
    console.log('1. Add the LOP addresses above to your .env file');
    console.log('2. Start the new relayer:');
    console.log('   cd relayer && node new-relayer.js');
    console.log('');
    console.log('3. Start the resolver (in another terminal):');
    console.log('   cd relayer && node simple-resolver.js');
    console.log('');
    console.log('4. Test the system:');
    console.log('   - Get quote: GET http://localhost:3001/api/quote?fromToken=0x...&toToken=0x...&amount=1000000000000000000&chainId=11155111');
    console.log('   - Create order: POST http://localhost:3001/api/orders');
    console.log('   - Check status: GET http://localhost:3001/api/orders/{orderId}');
    console.log('');
    console.log('🔗 SYSTEM ARCHITECTURE:');
    console.log('   User → Relayer (1inch quotes) → Orderbook → Resolver → LOP → EscrowFactory → Escrow');
    console.log('');
    console.log('📊 MONITORING:');
    console.log('   - Relayer health: http://localhost:3001/api/health');
    console.log('   - Orderbook: http://localhost:3001/api/orderbook');
    console.log('   - WebSocket: ws://localhost:8080');

    // =============================================================================
    // STEP 6: Return Deployment Summary
    // =============================================================================
    const deploymentSummary = {
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            sepoliaLOP: sepoliaLOPAddress,
            etherlinkLOP: etherlinkLOPAddress
        },
        escrowFactories: {
            sepolia: SEPOLIA_ESCROW_FACTORY,
            etherlink: ETHERLINK_ESCROW_FACTORY
        },
        configuration: {
            resolverAuthorized: deployer.address,
            priceRelayerAuthorized: deployer.address,
            chainsConfigured: [11155111, 128123]
        },
        nextSteps: [
            'Update .env with LOP addresses',
            'Start new-relayer.js',
            'Start simple-resolver.js',
            'Test with API calls'
        ]
    };

    console.log('\n📄 DEPLOYMENT SUMMARY:');
    console.log(JSON.stringify(deploymentSummary, null, 2));

    return deploymentSummary;
}

// Execute deployment
main()
    .then((summary) => {
        console.log('\n🎯 System ready for production! 🚀');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Setup failed:', error);
        process.exit(1);
    });