// Simple test script for Fusion+ Relayer
const FusionPlusRelayer = require('./src/FusionPlusRelayer');

console.log('🧪 Testing Fusion+ Relayer...\n');

// Test configuration
const testConfig = {
    SEPOLIA_RPC_URL: 'https://rpc.sepolia.org',
    DEPLOYER_ADDRESS: '0x5e8c9f71b484f082df54bd6473dfbf74abba266d'
    // Note: No PRIVATE_KEY for read-only testing
};

async function runTests() {
    try {
        console.log('1️⃣  Initializing relayer...');
        const relayer = new FusionPlusRelayer(testConfig);
        
        console.log('\n2️⃣  Testing blockchain connections...');
        const connectionResult = await relayer.testConnection();
        
        if (connectionResult) {
            console.log('✅ Connection test passed!');
        } else {
            console.log('❌ Connection test failed!');
            return;
        }
        
        console.log('\n3️⃣  Getting system status...');
        const status = await relayer.getStatus();
        console.log('📊 System Status:', JSON.stringify(status, null, 2));
        
        console.log('\n4️⃣  Testing order announcement...');
        const testOrder = {
            maker: '0x5e8c9f71b484f082df54bd6473dfbf74abba266d',
            amount: '1000000000000000000',
            startPrice: '1.0',
            endPrice: '0.95',
            duration: 10000 // 10 seconds for quick test
        };
        
        const order = await relayer.announceOrder(testOrder);
        console.log('📝 Order created:', {
            id: order.id,
            status: order.status,
            hashlock: order.hashlock
        });
        
        console.log('\n5️⃣  Checking order list...');
        const orders = relayer.getAllOrders();
        console.log('📋 Total orders:', orders.length);
        
        // Wait a bit to see price changes
        console.log('\n6️⃣  Monitoring price changes...');
        for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentOrders = relayer.getAllOrders();
            if (currentOrders.length > 0) {
                console.log(`💰 Current price: ${currentOrders[0].currentPrice} ETH`);
            }
        }
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n🚀 Your relayer is ready to use!');
        console.log('📖 Read README.md for full usage instructions');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check your internet connection');
        console.log('2. Verify RPC endpoints are accessible');
        console.log('3. Make sure the contract addresses are correct');
    }
}

// Run the tests
runTests().then(() => {
    console.log('\n🏁 Test script completed');
}).catch(error => {
    console.error('💥 Test script error:', error);
}); 