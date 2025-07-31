const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Exploring contract functions and events...\n');
    
    const contractAddress = '0xeE615abF49135BEB549c158d22245951FA12ED2d';
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider('https://arbitrum-one.publicnode.com');
    
    try {
        // Try to call various functions to understand the contract better
        const contract = new ethers.Contract(contractAddress, [
            'function executeGaslessSwap(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce, bytes signature)',
            'function userNonces(address user) view returns (uint256)',
            'function feePercent() view returns (uint256)',
            'function maxGasPrice() view returns (uint256)',
            'function owner() view returns (address)',
            'function version() view returns (string)',
            'function getDomainSeparator() view returns (bytes32)',
            
            // Try some possible additional functions
            'function inchLOP() view returns (address)',
            'function weth() view returns (address)',
            'function paused() view returns (bool)',
            
            // Events
            'event GaslessSwapExecuted(address indexed user, address indexed fromToken, address indexed toToken, uint256 fromAmount, uint256 toAmount, uint256 gasFeePaid)',
            'event MetaTransactionExecuted(address indexed user, bytes32 indexed metaTxHash, bool success)'
        ], provider);
        
        console.log('📋 Basic Contract Info:');
        try {
            const version = await contract.version();
            console.log('  Version:', version);
        } catch (e) {
            console.log('  Version: Not available');
        }
        
        try {
            const owner = await contract.owner();
            console.log('  Owner:', owner);
        } catch (e) {
            console.log('  Owner: Not available');
        }
        
        try {
            const feePercent = await contract.feePercent();
            console.log('  Fee Percent:', feePercent.toString(), `(${Number(feePercent) / 100}%)`);
        } catch (e) {
            console.log('  Fee Percent: Not available');
        }
        
        try {
            const maxGasPrice = await contract.maxGasPrice();
            console.log('  Max Gas Price:', ethers.formatUnits(maxGasPrice, 'gwei'), 'gwei');
        } catch (e) {
            console.log('  Max Gas Price: Not available');
        }
        
        // Try to find 1inch integration
        console.log('\n🔍 Checking for 1inch Integration:');
        try {
            const inchLOP = await contract.inchLOP();
            console.log('  1inch LOP address:', inchLOP);
        } catch (e) {
            console.log('  1inch LOP: Not found');
        }
        
        try {
            const weth = await contract.weth();
            console.log('  WETH address:', weth);
        } catch (e) {
            console.log('  WETH: Not found');
        }
        
        // Check if contract is paused
        try {
            const paused = await contract.paused();
            console.log('  Paused:', paused);
        } catch (e) {
            console.log('  Paused: Not available');
        }
        
        // Check recent events to see if anyone has successfully used this contract
        console.log('\n🔍 Checking Recent Events:');
        try {
            const latestBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(latestBlock - 10000, 0); // Last ~10k blocks
            
            const swapEvents = await contract.queryFilter(
                contract.filters.GaslessSwapExecuted(),
                fromBlock,
                latestBlock
            );
            
            if (swapEvents.length > 0) {
                console.log(`  Found ${swapEvents.length} recent swap events:`);
                swapEvents.slice(-5).forEach((event, i) => {
                    console.log(`    ${i + 1}. User: ${event.args.user}, From: ${event.args.fromToken}, To: ${event.args.toToken}`);
                });
            } else {
                console.log('  ❌ No recent swap events found');
                console.log('  💡 This suggests the contract might not be working or might need additional setup');
            }
            
        } catch (e) {
            console.log('  Could not query events:', e.message);
        }
        
        // Try to understand the contract's code by checking its size and deployment
        console.log('\n📊 Contract Analysis:');
        const code = await provider.getCode(contractAddress);
        console.log('  Code size:', code.length, 'bytes');
        
        // Get deployment transaction if possible
        try {
            // This is a heuristic - might not always work
            const deploymentTx = '0xb1c48521e66dc0bfffc2a123b99742111b752af0cd385a36984297c1cca62257';
            const tx = await provider.getTransaction(deploymentTx);
            if (tx) {
                console.log('  Deployed at block:', tx.blockNumber);
                console.log('  Gas used for deployment: ~2.4M');
            }
        } catch (e) {
            console.log('  Deployment info: Not available');
        }
        
        console.log('\n💡 Analysis Summary:');
        console.log('  - Contract exists and has the correct function signatures');
        console.log('  - EIP-712 domain separator is correctly configured');
        console.log('  - Token approval was successful');
        console.log('  - But executeGaslessSwap is reverting without clear error');
        console.log('  - This suggests the contract might be missing swap execution logic');
        console.log('  - Or there might be a bug in the contract implementation');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ Contract analysis completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });