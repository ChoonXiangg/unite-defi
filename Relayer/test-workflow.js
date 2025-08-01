require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

/**
 * 🧪 Test Your Exact Workflow
 * 
 * This script tests the complete workflow:
 * 1. Get quote from relayer (1inch API + fallbacks)
 * 2. Create and submit order
 * 3. Monitor for resolver pickup
 * 4. Provide secret when escrow is locked
 */
class WorkflowTester {
    constructor() {
        this.relayerUrl = 'http://localhost:3001';
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey);
        
        console.log('🧪 Workflow Tester initialized');
        console.log('👤 Test wallet:', this.wallet.address);
    }

    async testCompleteWorkflow() {
        try {
            console.log('\n🚀 TESTING YOUR EXACT WORKFLOW\n');
            
            // Step 1: Get price quote
            console.log('='.repeat(60));
            console.log('STEP 1: GET PRICE QUOTE (1inch API + fallbacks)');
            console.log('='.repeat(60));
            
            const quote = await this.getQuote();
            console.log('✅ Quote received:', quote);
            
            // Step 2: Create and submit order
            console.log('\n' + '='.repeat(60));
            console.log('STEP 2: CREATE & SUBMIT ORDER');
            console.log('='.repeat(60));
            
            const { order, signature, secret } = await this.createOrder(quote);
            const submitResult = await this.submitOrder(order, signature);
            console.log('✅ Order submitted:', submitResult);
            
            // Step 3: Monitor order status
            console.log('\n' + '='.repeat(60));
            console.log('STEP 3: MONITOR FOR RESOLVER PICKUP');
            console.log('='.repeat(60));
            
            const orderId = submitResult.orderId;
            await this.monitorOrderStatus(orderId);
            
            // Step 4: Provide secret (simulated)
            console.log('\n' + '='.repeat(60));
            console.log('STEP 4: PROVIDE SECRET FOR UNLOCK');
            console.log('='.repeat(60));
            
            await this.provideSecret(orderId, secret, submitResult.orderHash);
            
            console.log('\n🎉 WORKFLOW TEST COMPLETED SUCCESSFULLY! 🎉');
            
        } catch (error) {
            console.error('\n❌ Workflow test failed:', error.message);
        }
    }

    async getQuote() {
        try {
            const response = await axios.get(`${this.relayerUrl}/api/quote`, {
                params: {
                    fromToken: ethers.ZeroAddress, // ETH
                    toToken: '0xA0b86a33E6417c4d2C6C4c4c4c4c4c4c4c4c4c4c', // Mock USDC
                    amount: ethers.parseEther('0.1').toString(),
                    chainId: 11155111 // Sepolia
                }
            });

            return response.data.quote;
        } catch (error) {
            console.error('Quote error:', error.response?.data || error.message);
            throw error;
        }
    }

    async createOrder(quote) {
        const secret = 'test-secret-' + Math.random().toString(36).substr(2, 9);
        const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
        
        const order = {
            maker: this.wallet.address,
            taker: ethers.ZeroAddress,
            makerAsset: quote.fromToken,
            takerAsset: quote.toToken,
            makerAmount: quote.fromAmount,
            takerAmount: quote.toAmount,
            deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            salt: Math.floor(Math.random() * 1000000),
            secretHash: secretHash,
            sourceChain: 11155111,
            destinationChain: 11155111,
            predicate: '0x',
            maxSlippage: 100, // 1%
            requirePriceValidation: false,
            priceData: {
                price: 0,
                timestamp: 0,
                relayer: ethers.ZeroAddress,
                apiSources: [],
                confidence: 0,
                deviation: 0,
                signature: '0x'
            }
        };

        // Sign the order (simplified)
        const orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
            [order.maker, order.makerAsset, order.takerAsset, order.makerAmount, order.takerAmount, order.deadline, order.secretHash]
        ));
        
        const signature = await this.wallet.signMessage(ethers.getBytes(orderHash));

        return { order, signature, secret };
    }

    async submitOrder(order, signature) {
        try {
            const response = await axios.post(`${this.relayerUrl}/api/orders`, {
                order,
                signature
            });

            return response.data;
        } catch (error) {
            console.error('Submit error:', error.response?.data || error.message);
            throw error;
        }
    }

    async monitorOrderStatus(orderId) {
        console.log(`📊 Monitoring order ${orderId}...`);
        
        let attempts = 0;
        const maxAttempts = 10; // 50 seconds
        
        while (attempts < maxAttempts) {
            try {
                const response = await axios.get(`${this.relayerUrl}/api/orders/${orderId}`);
                const order = response.data.order;
                
                console.log(`   Status: ${order.status} (attempt ${attempts + 1}/${maxAttempts})`);
                
                if (order.status === 'picked') {
                    console.log(`✅ Order picked up by resolver: ${order.resolver}`);
                    return;
                } else if (order.status === 'executed') {
                    console.log(`✅ Order executed! Escrow: ${order.escrowAddress}`);
                    return;
                }
                
                await this.sleep(5000); // Wait 5 seconds
                attempts++;
                
            } catch (error) {
                console.error('Status check error:', error.message);
                break;
            }
        }
        
        console.log('⏰ Monitoring timeout - resolver may not be running');
    }

    async provideSecret(orderId, secret, orderHash) {
        try {
            // Sign the secret release message
            const message = ethers.solidityPackedKeccak256(
                ['string', 'string', 'bytes32'],
                ['RELEASE_SECRET', secret, orderHash]
            );
            const signature = await this.wallet.signMessage(ethers.getBytes(message));

            const response = await axios.post(`${this.relayerUrl}/api/orders/${orderId}/secret`, {
                secret,
                signature
            });

            console.log('✅ Secret provided:', response.data.message);
            return response.data;
        } catch (error) {
            console.error('Secret submission error:', error.response?.data || error.message);
            throw error;
        }
    }

    async checkSystemHealth() {
        try {
            const response = await axios.get(`${this.relayerUrl}/api/health`);
            console.log('🏥 System Health:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const tester = new WorkflowTester();
    
    console.log('🧪 WORKFLOW TESTER READY\n');
    
    // Check if relayer is running
    try {
        await tester.checkSystemHealth();
    } catch (error) {
        console.error('❌ Relayer not running! Start it first with: npm start');
        process.exit(1);
    }
    
    // Run the complete workflow test
    await tester.testCompleteWorkflow();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WorkflowTester;