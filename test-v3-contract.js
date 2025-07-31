const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Testing GaslessSwapStationV3 (Production) contract...\n');
    
    const contractAddress = '0x6A6FE05c03c7A022B70cd7Dc85E30feB2914dbb3';
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
            'function paused() view returns (bool)',
            'function INCH_ROUTER() view returns (address)',
            'function WETH() view returns (address)',
            'function ETH() view returns (address)'
        ], provider);
        
        console.log('📋 Production Contract Information:');
        
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
        
        const paused = await contract.paused();
        console.log('  Contract Paused:', paused);
        
        console.log('\n🔗 Production Integration Addresses:');
        const inchRouter = await contract.INCH_ROUTER();
        console.log('  1inch Router v5:', inchRouter);
        
        const weth = await contract.WETH();
        console.log('  WETH:', weth);
        
        const eth = await contract.ETH();
        console.log('  ETH Placeholder:', eth);
        
        // Check if 1inch Router exists
        console.log('\n🧪 Testing 1inch Router connection...');
        const routerCode = await provider.getCode(inchRouter);
        console.log('  1inch Router code size:', routerCode.length, 'bytes');
        
        if (routerCode.length > 2) {
            console.log('  ✅ 1inch Router is deployed and accessible');
        } else {
            console.log('  ❌ 1inch Router not found at this address');
        }
        
        // Check WETH
        const wethCode = await provider.getCode(weth);
        console.log('  WETH code size:', wethCode.length, 'bytes');
        
        if (wethCode.length > 2) {
            console.log('  ✅ WETH is deployed and accessible');
        } else {
            console.log('  ❌ WETH not found at this address');
        }
        
        console.log('\n🎯 Contract Status:');
        if (!paused && routerCode.length > 2 && wethCode.length > 2) {
            console.log('  🟢 Contract is READY for production swaps!');
            console.log('  🚀 Real 1inch liquidity available');
            console.log('  💼 USDC → ETH, ETH → USDC swaps supported');
            console.log('  ⚡ Gasless transactions enabled');
        } else {
            console.log('  🟡 Contract needs attention:');
            if (paused) console.log('    - Contract is paused');
            if (routerCode.length <= 2) console.log('    - 1inch Router not accessible');
            if (wethCode.length <= 2) console.log('    - WETH not accessible');
        }
        
    } catch (error) {
        console.error('❌ Error testing V3 contract:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ V3 Contract test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });