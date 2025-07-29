const fs = require('fs');
const path = require('path');

// Check Etherlink deployment status
async function checkEtherlinkDeployment() {
    console.log('🔍 Checking Etherlink deployment status...\n');

    // Check if deployment artifacts exist
    const broadcastPath = path.join(__dirname, '../broadcast');
    const deploymentsPath = path.join(__dirname, '../deployments/etherlink');
    
    console.log('1. Checking for deployment artifacts:');
    
    if (fs.existsSync(broadcastPath)) {
        console.log('   ✅ Broadcast folder exists');
        
        // Look for deployment files
        const broadcastFiles = fs.readdirSync(broadcastPath, { withFileTypes: true });
        const deploymentFiles = broadcastFiles.filter(file => 
            file.isDirectory() && (file.name.includes('etherlink') || file.name.includes('128123'))
        );
        
        if (deploymentFiles.length > 0) {
            console.log(`   ✅ Found ${deploymentFiles.length} deployment directories`);
            deploymentFiles.forEach(dir => {
                console.log(`      📁 ${dir.name}`);
            });
        } else {
            console.log('   ⚠️  No Etherlink deployment directories found');
        }
    } else {
        console.log('   ❌ Broadcast folder not found - no deployments yet');
    }

    // Check for deployment JSON files
    console.log('\n2. Checking deployment JSON files:');
    const deploymentJsonPath = path.join(deploymentsPath, 'EscrowFactory.json');
    
    if (fs.existsSync(deploymentJsonPath)) {
        try {
            const deploymentData = JSON.parse(fs.readFileSync(deploymentJsonPath, 'utf8'));
            console.log('   ✅ EscrowFactory deployment file found');
            console.log(`   📍 Contract Address: ${deploymentData.address || 'Not specified'}`);
            console.log(`   📅 Deployed: ${deploymentData.deployedAt || 'Unknown'}`);
        } catch (error) {
            console.log('   ❌ Invalid deployment JSON file');
        }
    } else {
        console.log('   ❌ No deployment JSON file found');
    }

    // Check network connectivity
    console.log('\n3. Checking Etherlink network connectivity:');
    
    const https = require('https');
    
    async function checkRPC(url, name) {
        return new Promise((resolve) => {
            const req = https.request(url, { method: 'POST', timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`   ✅ ${name} RPC is accessible`);
                        resolve(true);
                    } else {
                        console.log(`   ❌ ${name} RPC returned status ${res.statusCode}`);
                        resolve(false);
                    }
                });
            });
            
            req.on('error', () => {
                console.log(`   ❌ ${name} RPC is not accessible`);
                resolve(false);
            });
            
            req.on('timeout', () => {
                console.log(`   ⏰ ${name} RPC timeout`);
                resolve(false);
            });
            
            req.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1
            }));
            req.end();
        });
    }

    await checkRPC('https://node.etherlink-testnet.com', 'Etherlink Testnet');
    await checkRPC('https://node.etherlink.com', 'Etherlink Mainnet');

    // Check explorer accessibility
    console.log('\n4. Checking Etherlink explorer:');
    
    async function checkExplorer(url, name) {
        return new Promise((resolve) => {
            const req = https.request(url, { method: 'GET', timeout: 5000 }, (res) => {
                if (res.statusCode === 200) {
                    console.log(`   ✅ ${name} explorer is accessible`);
                    resolve(true);
                } else {
                    console.log(`   ❌ ${name} explorer returned status ${res.statusCode}`);
                    resolve(false);
                }
            });
            
            req.on('error', () => {
                console.log(`   ❌ ${name} explorer is not accessible`);
                resolve(false);
            });
            
            req.on('timeout', () => {
                console.log(`   ⏰ ${name} explorer timeout`);
                resolve(false);
            });
            
            req.end();
        });
    }

    await checkExplorer('https://explorer.etherlink-testnet.com', 'Etherlink Testnet Explorer');
    await checkExplorer('https://explorer.etherlink.com', 'Etherlink Mainnet Explorer');

    // Instructions for deployment
    console.log('\n📋 To deploy and verify on Etherlink testnet:');
    console.log('\n1. Install Foundry:');
    console.log('   curl -L https://foundry.paradigm.xyz | bash');
    console.log('   foundryup');
    
    console.log('\n2. Set environment variables:');
    console.log('   export DEPLOYER_ADDRESS="0xYourDeployerAddress"');
    console.log('   export PRIVATE_KEY="YourPrivateKey"');
    
    console.log('\n3. Deploy to testnet:');
    console.log('   ./scripts/deploy-etherlink.sh testnet');
    
    console.log('\n4. Check deployment on explorer:');
    console.log('   https://explorer.etherlink-testnet.com/address/[DEPLOYED_ADDRESS]');
    
    console.log('\n5. Test the deployed contract:');
    console.log('   forge test --match-contract EtherlinkEscrowFactoryTest --fork-url https://node.etherlink-testnet.com');
    
    console.log('\n6. Verify contract interaction:');
    console.log('   - Check if EscrowFactory can create escrow contracts');
    console.log('   - Test withdrawal and cancellation functions');
    console.log('   - Verify timelock enforcement');
    
    console.log('\n🔍 After deployment, you can verify by:');
    console.log('   - Checking the contract on Etherlink explorer');
    console.log('   - Running integration tests against the deployed contract');
    console.log('   - Testing with 1inch Fusion+ integration');
    console.log('   - Monitoring contract events and transactions');
}

// Run the check
checkEtherlinkDeployment().catch(console.error); 