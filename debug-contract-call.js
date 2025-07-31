const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Testing contract call directly to identify revert reason...\n');
    
    const contractAddress = '0xeE615abF49135BEB549c158d22245951FA12ED2d';
    const userAddress = '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce';
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider('https://arbitrum-one.publicnode.com');
    
    try {
        // Test the exact transaction that's failing
        const contract = new ethers.Contract(contractAddress, [
            'function executeGaslessSwap(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce, bytes signature)',
            'function userNonces(address user) view returns (uint256)',
            'function feePercent() view returns (uint256)',
            'function owner() view returns (address)'
        ], provider);
        
        // Parameters from the failing transaction
        const swapParams = {
            user: '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce',
            fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            toToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            fromAmount: '1000000',
            minToAmount: '261000000000000',
            deadline: 1753974704,
            nonce: 0,
            signature: '0x28eb53615ba07a5b74bff8c382a45787333092f14a5f8f33dc9c25d0cb5ddfff5153fbca636e9bfa91a93e423837b5c9c16de970122d4cf3660ecd5f218dd2b11b'
        };
        
        console.log('📋 Transaction Parameters:');
        console.log('  User:', swapParams.user);
        console.log('  From Token (USDC):', swapParams.fromToken);
        console.log('  To Token (ETH):', swapParams.toToken);
        console.log('  From Amount:', swapParams.fromAmount, '(1.0 USDC)');
        console.log('  Min To Amount:', swapParams.minToAmount, '(0.000261 ETH)');
        console.log('  Deadline:', new Date(swapParams.deadline * 1000).toLocaleString());
        console.log('  Nonce:', swapParams.nonce);
        console.log('  Signature:', swapParams.signature);
        
        // Try to call the function and catch specific revert reasons
        try {
            console.log('\n🧪 Testing contract call...');
            
            // Try static call first to see if it would succeed
            const result = await contract.executeGaslessSwap.staticCall(
                swapParams.user,
                swapParams.fromToken,
                swapParams.toToken,
                swapParams.fromAmount,
                swapParams.minToAmount,
                swapParams.deadline,
                swapParams.nonce,
                swapParams.signature
            );
            
            console.log('✅ Static call succeeded:', result);
            
        } catch (error) {
            console.log('❌ Static call failed:', error.message);
            
            // Try to decode the error if possible
            if (error.data) {
                console.log('Error data:', error.data);
                
                // Common error signatures
                const errorSignatures = {
                    '0x08c379a0': 'Error(string)', // Standard revert with message
                    '0x4e487b71': 'Panic(uint256)', // Panic codes
                };
                
                const errorSig = error.data.slice(0, 10);
                if (errorSignatures[errorSig]) {
                    console.log('Error type:', errorSignatures[errorSig]);
                    
                    if (errorSig === '0x08c379a0') {
                        try {
                            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + error.data.slice(10));
                            console.log('Revert reason:', decoded[0]);
                        } catch (e) {
                            console.log('Could not decode error message');
                        }
                    }
                }
            }
        }
        
        // Check if the issue might be with the signature itself
        console.log('\n🔍 Analyzing potential issues:');
        
        // Check current nonce
        const currentNonce = await contract.userNonces(userAddress);
        if (currentNonce.toString() !== swapParams.nonce.toString()) {
            console.log('❌ Nonce mismatch:');
            console.log('  Contract nonce:', currentNonce.toString());
            console.log('  Transaction nonce:', swapParams.nonce);
        } else {
            console.log('✅ Nonce is correct');
        }
        
        // Check deadline
        const now = Math.floor(Date.now() / 1000);
        if (swapParams.deadline < now) {
            console.log('❌ Deadline expired:');
            console.log('  Current time:', now);
            console.log('  Deadline:', swapParams.deadline);
        } else {
            console.log('✅ Deadline is valid');
        }
        
        // Check amounts
        if (BigInt(swapParams.fromAmount) === 0n) {
            console.log('❌ From amount is zero');
        } else {
            console.log('✅ From amount is valid');
        }
        
        if (BigInt(swapParams.minToAmount) === 0n) {
            console.log('❌ Min to amount is zero');
        } else {
            console.log('✅ Min to amount is valid');
        }
        
        // Check signature length
        if (swapParams.signature.length !== 132) { // 0x + 130 chars = 132
            console.log('❌ Invalid signature length:', swapParams.signature.length);
        } else {
            console.log('✅ Signature length is correct');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ Contract call test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });