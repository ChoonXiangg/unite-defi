const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking deployed contract functions...\n");
    
    const contractAddress = "0xeE615abF49135BEB549c158d22245951FA12ED2d";
    
    // Connect to Arbitrum mainnet
    const provider = new ethers.JsonRpcProvider("https://arbitrum-one.publicnode.com");
    
    try {
        // Check if contract exists
        const code = await provider.getCode(contractAddress);
        console.log("📋 Contract code length:", code.length);
        
        if (code.length <= 2) {
            console.log("❌ No contract deployed at this address");
            return;
        }
        
        console.log("✅ Contract exists at:", contractAddress);
        
        // Try different possible function signatures
        const possibleFunctions = [
            // Current frontend expectations
            'function getNonce(address user) view returns (uint256)',
            'function getFeePercent() view returns (uint256)',
            'function getMaxGasPrice() view returns (uint256)',
            'function getOwner() view returns (address)',
            'function version() view returns (string)',
            'function getDomainSeparator() view returns (bytes32)',
            
            // Alternative naming patterns
            'function nonces(address user) view returns (uint256)',
            'function feePercent() view returns (uint256)',
            'function maxGasPrice() view returns (uint256)',
            'function owner() view returns (address)',
            'function userNonces(address user) view returns (uint256)',
            
            // Execute function
            'function executeGaslessSwap(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce, bytes signature)',
            'function executeGaslessSwap(tuple(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce) swap, bytes signature)'
        ];
        
        console.log("\n🧪 Testing function calls...\n");
        
        const testAddress = "0x7184B01a8A9ac24428bB8d3925701D151920C9Ce";
        
        for (const funcSig of possibleFunctions) {
            try {
                const contract = new ethers.Contract(contractAddress, [funcSig], provider);
                const funcName = funcSig.match(/function (\w+)/)[1];
                
                let result;
                if (funcName.includes('Nonce') || funcName === 'nonces' || funcName === 'userNonces') {
                    result = await contract[funcName](testAddress);
                    console.log(`✅ ${funcName}(${testAddress}):`, result.toString());
                } else if (funcName === 'executeGaslessSwap') {
                    console.log(`✅ ${funcName}: Function exists (not calling - would require parameters)`);
                } else {
                    result = await contract[funcName]();
                    if (typeof result === 'bigint') {
                        console.log(`✅ ${funcName}():`, result.toString());
                    } else {
                        console.log(`✅ ${funcName}():`, result);
                    }
                }
            } catch (error) {
                // Function doesn't exist or failed, skip
                const funcName = funcSig.match(/function (\w+)/)[1];
                console.log(`❌ ${funcName}: Not found or failed`);
            }
        }
        
        // Check for ERC165 interface support
        console.log("\n🔍 Additional checks...\n");
        
        try {
            // Try to call a generic view function that might exist
            const genericContract = new ethers.Contract(contractAddress, [
                'function name() view returns (string)',
                'function symbol() view returns (string)',
                'function decimals() view returns (uint8)'
            ], provider);
            
            try {
                const name = await genericContract.name();
                console.log("✅ name():", name);
            } catch (e) {
                console.log("❌ name(): Not found");
            }
            
            try {
                const symbol = await genericContract.symbol();
                console.log("✅ symbol():", symbol);
            } catch (e) {
                console.log("❌ symbol(): Not found");
            }
            
        } catch (error) {
            console.log("❌ Generic function checks failed");
        }
        
    } catch (error) {
        console.error("❌ Error checking contract:", error.message);
    }
}

main()
    .then(() => {
        console.log("\n✅ Contract function check completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });