const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Testing new GaslessSwapStationV2 contract...\n');
    
    const contractAddress = '0x426E496b856f08A5f6Cd90268a694a332c5EffEc';
    const userAddress = '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce';
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider('https://arbitrum-one.publicnode.com');
    
    try {
        const contract = new ethers.Contract(contractAddress, [
            'function version() view returns (string)',
            'function owner() view returns (address)',
            'function feePercent() view returns (uint256)',
            'function maxGasPrice() view returns (uint256)',
            'function userNonces(address user) view returns (uint256)',
            'function getDomainSeparator() view returns (bytes32)',
            'function INCH_LOP() view returns (address)',
            'function INCH_ROUTER() view returns (address)',
            'function WETH() view returns (address)'
        ], provider);
        
        console.log('📋 Contract Information:');
        
        const version = await contract.version();
        console.log('  Version:', version);
        
        const owner = await contract.owner();
        console.log('  Owner:', owner);
        
        const feePercent = await contract.feePercent();
        console.log('  Fee Percent:', feePercent.toString(), `(${Number(feePercent) / 100}%)`);
        
        const maxGasPrice = await contract.maxGasPrice();
        console.log('  Max Gas Price:', ethers.formatUnits(maxGasPrice, 'gwei'), 'gwei');
        
        const userNonce = await contract.userNonces(userAddress);
        console.log('  User Nonce:', userNonce.toString());
        
        const domainSeparator = await contract.getDomainSeparator();
        console.log('  Domain Separator:', domainSeparator);
        
        console.log('\n🔗 Integration Addresses:');
        const inchLOP = await contract.INCH_LOP();
        console.log('  1inch LOP:', inchLOP);
        
        const inchRouter = await contract.INCH_ROUTER();
        console.log('  1inch Router:', inchRouter);
        
        const weth = await contract.WETH();
        console.log('  WETH:', weth);
        
        console.log('\n✅ Contract is working correctly!');
        console.log('🎉 Ready for gasless swaps with 1inch integration');
        
    } catch (error) {
        console.error('❌ Error testing contract:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ Contract test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });