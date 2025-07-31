const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Checking contract state and user balances...\n');
    
    const userAddress = '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce';
    const contractAddress = '0xeE615abF49135BEB549c158d22245951FA12ED2d';
    const usdcAddress = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider('https://arbitrum-one.publicnode.com');
    
    try {
        // Check ETH balance
        const ethBalance = await provider.getBalance(userAddress);
        console.log(`💰 ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
        
        // Check USDC balance
        const usdcContract = new ethers.Contract(usdcAddress, [
            'function balanceOf(address) view returns (uint256)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ], provider);
        
        const usdcBalance = await usdcContract.balanceOf(userAddress);
        const usdcDecimals = await usdcContract.decimals();
        const usdcAllowance = await usdcContract.allowance(userAddress, contractAddress);
        
        console.log(`💵 USDC Balance: ${ethers.formatUnits(usdcBalance, usdcDecimals)} USDC`);
        console.log(`🔓 USDC Allowance to contract: ${ethers.formatUnits(usdcAllowance, usdcDecimals)} USDC`);
        
        // Check contract state
        const gaslessContract = new ethers.Contract(contractAddress, [
            'function userNonces(address user) view returns (uint256)',
            'function feePercent() view returns (uint256)',
            'function maxGasPrice() view returns (uint256)',
            'function owner() view returns (address)'
        ], provider);
        
        const userNonce = await gaslessContract.userNonces(userAddress);
        const feePercent = await gaslessContract.feePercent();
        const maxGasPrice = await gaslessContract.maxGasPrice();
        const owner = await gaslessContract.owner();
        
        console.log(`\n📋 Contract State:`);
        console.log(`  User Nonce: ${userNonce}`);
        console.log(`  Fee Percent: ${feePercent} (${Number(feePercent) / 100}%)`);
        console.log(`  Max Gas Price: ${ethers.formatUnits(maxGasPrice, 'gwei')} gwei`);
        console.log(`  Owner: ${owner}`);
        
        // Check current gas price
        const feeData = await provider.getFeeData();
        console.log(`\n⛽ Current Network State:`);
        console.log(`  Gas Price: ${ethers.formatUnits(feeData.gasPrice || '0', 'gwei')} gwei`);
        console.log(`  Max Fee: ${ethers.formatUnits(feeData.maxFeePerGas || '0', 'gwei')} gwei`);
        console.log(`  Priority Fee: ${ethers.formatUnits(feeData.maxPriorityFeePerGas || '0', 'gwei')} gwei`);
        
        // Analyze potential issues
        console.log(`\n🚨 Potential Issues:`);
        
        if (usdcBalance === 0n) {
            console.log(`  ❌ No USDC balance - user needs USDC to swap`);
        } else {
            console.log(`  ✅ USDC balance sufficient`);
        }
        
        if (usdcAllowance === 0n) {
            console.log(`  ❌ No USDC allowance - need to approve contract first`);
            console.log(`  💡 User needs to call: USDC.approve("${contractAddress}", amount)`);
        } else {
            console.log(`  ✅ USDC allowance exists`);
        }
        
        if (ethBalance < ethers.parseEther('0.001')) {
            console.log(`  ⚠️  Low ETH balance for gas fees`);
        } else {
            console.log(`  ✅ ETH balance sufficient for gas`);
        }
        
        if (feeData.gasPrice && feeData.gasPrice > maxGasPrice) {
            console.log(`  ⚠️  Current gas price (${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei) exceeds contract max (${ethers.formatUnits(maxGasPrice, 'gwei')} gwei)`);
        } else {
            console.log(`  ✅ Gas price within contract limits`);
        }
        
    } catch (error) {
        console.error('❌ Error checking contract state:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ Contract state check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });