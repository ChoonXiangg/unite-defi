const { ethers } = require('hardhat');

async function main() {
    console.log('🔍 Debugging EIP-712 signature validation...\n');
    
    const contractAddress = '0xeE615abF49135BEB549c158d22245951FA12ED2d';
    const userAddress = '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce';
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider('https://arbitrum-one.publicnode.com');
    
    try {
        // Get contract domain separator
        const contract = new ethers.Contract(contractAddress, [
            'function getDomainSeparator() view returns (bytes32)',
            'function version() view returns (string)',
            'function userNonces(address user) view returns (uint256)'
        ], provider);
        
        const contractDomainSeparator = await contract.getDomainSeparator();
        const contractVersion = await contract.version();
        const currentNonce = await contract.userNonces(userAddress);
        
        console.log('📋 Contract Information:');
        console.log('  Domain Separator:', contractDomainSeparator);
        console.log('  Version:', contractVersion);
        console.log('  Current Nonce:', currentNonce.toString());
        
        // Calculate expected domain separator for comparison
        const frontendDomain = {
            name: 'GaslessSwapStation',
            version: '1',
            chainId: 42161,
            verifyingContract: contractAddress
        };
        
        // Calculate domain separator hash
        const domainTypeHash = ethers.keccak256(
            ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        );
        
        const nameHash = ethers.keccak256(ethers.toUtf8Bytes(frontendDomain.name));
        const versionHash = ethers.keccak256(ethers.toUtf8Bytes(frontendDomain.version));
        
        const calculatedDomainSeparator = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                [domainTypeHash, nameHash, versionHash, frontendDomain.chainId, frontendDomain.verifyingContract]
            )
        );
        
        console.log('\n🔍 Frontend Domain Calculation:');
        console.log('  Name:', frontendDomain.name);
        console.log('  Version:', frontendDomain.version);
        console.log('  Chain ID:', frontendDomain.chainId);
        console.log('  Contract:', frontendDomain.verifyingContract);
        console.log('  Calculated Domain Separator:', calculatedDomainSeparator);
        
        console.log('\n🆚 Comparison:');
        if (contractDomainSeparator === calculatedDomainSeparator) {
            console.log('  ✅ Domain separators match!');
        } else {
            console.log('  ❌ Domain separators DO NOT match!');
            console.log('  💡 This could be why signature verification is failing');
            
            // Try with contract version
            if (contractVersion !== '1') {
                console.log(`\n🔧 Trying with contract version: "${contractVersion}"`);
                const correctedVersionHash = ethers.keccak256(ethers.toUtf8Bytes(contractVersion));
                const correctedDomainSeparator = ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [domainTypeHash, nameHash, correctedVersionHash, frontendDomain.chainId, frontendDomain.verifyingContract]
                    )
                );
                
                console.log('  Corrected Domain Separator:', correctedDomainSeparator);
                if (contractDomainSeparator === correctedDomainSeparator) {
                    console.log('  ✅ Found the issue! Version should be:', contractVersion);
                }
            }
        }
        
        // Check message structure
        console.log('\n📝 Message Structure Check:');
        const swapMessage = {
            user: userAddress,
            fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            toToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            fromAmount: '1000000',
            minToAmount: '261000000000000',
            deadline: 1753974704,
            nonce: 0
        };
        
        console.log('  Swap Message:', JSON.stringify(swapMessage, null, 2));
        
        // Check if nonce is correct
        if (currentNonce.toString() !== swapMessage.nonce.toString()) {
            console.log('  ⚠️  Nonce mismatch!');
            console.log('    Contract nonce:', currentNonce.toString());
            console.log('    Message nonce:', swapMessage.nonce.toString());
        } else {
            console.log('  ✅ Nonce matches');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main()
    .then(() => {
        console.log('\n✅ Signature validation check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });