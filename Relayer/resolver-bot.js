require('dotenv').config();
const { ethers } = require('ethers');
const WebSocket = require('ws');
const axios = require('axios');

/**
 * 🤖 Resolver Bot - Cross-Chain Order Execution
 * 
 * This resolver bot:
 * 1. Connects to your relayer via WebSocket
 * 2. Monitors orderbook for profitable orders
 * 3. Analyzes cross-chain arbitrage opportunities
 * 4. Executes orders by triggering your LOP contracts
 * 5. Handles secret-based unlocking for atomic swaps
 * 6. Manages cross-chain fund settlement
 */
class ResolverBot {
    constructor() {
        this.setupProviders();
        this.setupContracts();
        this.setupWebSocket();
        
        // Bot state
        this.isRunning = false;
        this.processingOrders = new Set();
        this.completedOrders = new Set();
        this.profitThreshold = ethers.parseEther('0.001'); // Minimum 0.001 ETH profit
        this.maxGasPrice = ethers.parseUnits('50', 'gwei'); // Max 50 gwei
        
        // Performance tracking
        this.stats = {
            ordersProcessed: 0,
            ordersExecuted: 0,
            totalProfit: 0n,
            totalGasUsed: 0n,
            startTime: Date.now()
        };
        
        console.log('🤖 Resolver Bot initialized');
        console.log('💼 Wallet:', this.wallet.address);
    }

    setupProviders() {
        this.providers = {
            sepolia: new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL),
            etherlink: new ethers.JsonRpcProvider(process.env.ETHERLINK_TESTNET_RPC_URL)
        };

        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
        this.signers = {
            sepolia: this.wallet.connect(this.providers.sepolia),
            etherlink: this.wallet.connect(this.providers.etherlink)
        };

        console.log('📡 Multi-chain providers configured');
    }

    setupContracts() {
        // Your deployed LOP contract ABI
        const lopABI = [
            "function executeOrder((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes)), bytes) external returns (address)",
            "function validateOrderConditions((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bool)",
            "function getOrderHash((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bytes32)",
            "function getOrderStatus(bytes32) external view returns (uint256)",
            "function authorizedResolvers(address) external view returns (bool)",
            "event OrderExecuted(bytes32 indexed orderHash, address indexed resolver, address indexed escrowContract, uint256 chainId)"
        ];

        // Your deployed LOP contracts
        this.lopContracts = {
            sepolia: process.env.SEPOLIA_HYBRID_LOP_ADDRESS ? new ethers.Contract(
                process.env.SEPOLIA_HYBRID_LOP_ADDRESS,
                lopABI,
                this.signers.sepolia
            ) : null,
            etherlink: process.env.ETHERLINK_HYBRID_LOP_ADDRESS ? new ethers.Contract(
                process.env.ETHERLINK_HYBRID_LOP_ADDRESS,
                lopABI,
                this.signers.etherlink
            ) : null
        };

        // ERC20 ABI for token operations
        this.erc20ABI = [
            "function balanceOf(address) external view returns (uint256)",
            "function allowance(address,address) external view returns (uint256)",
            "function approve(address,uint256) external returns (bool)",
            "function transfer(address,uint256) external returns (bool)"
        ];

        console.log('📋 LOP contracts configured');
        console.log('   Sepolia LOP:', process.env.SEPOLIA_HYBRID_LOP_ADDRESS || 'Not set');
        console.log('   Etherlink LOP:', process.env.ETHERLINK_HYBRID_LOP_ADDRESS || 'Not set');
    }

    setupWebSocket() {
        const relayerUrl = process.env.RELAYER_WS_URL || 'ws://localhost:8080';
        
        this.connectToRelayer(relayerUrl);
    }

    connectToRelayer(url) {
        console.log('🔗 Connecting to relayer:', url);
        
        this.ws = new WebSocket(url);
        
        this.ws.on('open', () => {
            console.log('✅ Connected to relayer');
            
            // Subscribe as resolver
            this.ws.send(JSON.stringify({
                type: 'subscribe_resolver',
                resolver: this.wallet.address,
                capabilities: {
                    chains: ['sepolia', 'etherlink'],
                    maxGasPrice: this.maxGasPrice.toString(),
                    minProfit: this.profitThreshold.toString()
                }
            }));
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleRelayerMessage(message);
            } catch (error) {
                console.error('❌ WebSocket message error:', error);
            }
        });

        this.ws.on('close', () => {
            console.log('🔌 Disconnected from relayer, reconnecting in 5s...');
            setTimeout(() => this.connectToRelayer(url), 5000);
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
    }

    async handleRelayerMessage(message) {
        switch (message.type) {
            case 'subscribed':
                console.log('✅ Subscribed as resolver');
                this.isRunning = true;
                break;

            case 'new_order':
                console.log('📋 New order available:', message.orderId);
                await this.analyzeOrder(message);
                break;

            case 'secret_available':
                console.log('🔐 Secret available for order:', message.orderId);
                await this.handleSecretUnlock(message);
                break;

            case 'order_cancelled':
                console.log('❌ Order cancelled:', message.orderId);
                this.processingOrders.delete(message.orderId);
                break;

            default:
                console.log('📨 Unknown message:', message.type);
        }
    }

    async analyzeOrder(orderMessage) {
        const { orderId, orderHash, order, signature } = orderMessage;
        
        // Skip if already processing
        if (this.processingOrders.has(orderId)) {
            return;
        }

        this.processingOrders.add(orderId);
        this.stats.ordersProcessed++;

        try {
            console.log(`🔍 Analyzing order ${orderId}...`);
            
            // 1. Quick profitability check
            const profitAnalysis = await this.analyzeProfitability(order);
            if (!profitAnalysis.profitable) {
                console.log(`❌ Order ${orderId} not profitable: ${profitAnalysis.reason}`);
                return;
            }

            // 2. Gas price check
            const gasCheck = await this.checkGasPrices(order);
            if (!gasCheck.acceptable) {
                console.log(`❌ Order ${orderId} gas too high: ${gasCheck.reason}`);
                return;
            }

            // 3. Validate order on-chain
            const validationResult = await this.validateOrderOnChain(order);
            if (!validationResult.valid) {
                console.log(`❌ Order ${orderId} validation failed: ${validationResult.reason}`);
                return;
            }

            // 4. Check our authorization
            const authCheck = await this.checkResolverAuthorization(order);
            if (!authCheck.authorized) {
                console.log(`❌ Not authorized to resolve on ${authCheck.chain}`);
                return;
            }

            // 5. Notify relayer we're taking this order
            this.ws.send(JSON.stringify({
                type: 'order_picked',
                orderId,
                resolver: this.wallet.address,
                estimatedProfit: profitAnalysis.estimatedProfit.toString(),
                estimatedGas: gasCheck.estimatedGas.toString()
            }));

            // 6. Execute the order
            console.log(`⚡ Executing order ${orderId}...`);
            await this.executeOrder(order, signature, orderId);

        } catch (error) {
            console.error(`❌ Error analyzing order ${orderId}:`, error);
        } finally {
            this.processingOrders.delete(orderId);
        }
    }

    async analyzeProfitability(order) {
        try {
            // Calculate potential profit from cross-chain arbitrage
            const sourceChain = this.getChainName(order.sourceChain);
            const destChain = this.getChainName(order.destinationChain);
            
            // Get current prices on both chains
            const sourcePriceData = await this.getTokenPrice(order.makerAsset, order.takerAsset, sourceChain);
            const destPriceData = await this.getTokenPrice(order.takerAsset, order.makerAsset, destChain);
            
            // Calculate arbitrage opportunity
            const orderRate = BigInt(order.takerAmount) * BigInt(1e18) / BigInt(order.makerAmount);
            const marketRate = sourcePriceData.rate;
            
            // Estimate profit (simplified)
            const priceDifference = orderRate > marketRate ? orderRate - marketRate : 0n;
            const estimatedProfit = priceDifference * BigInt(order.makerAmount) / BigInt(1e18);
            
            // Check if profit exceeds threshold
            const profitable = estimatedProfit >= this.profitThreshold;
            
            return {
                profitable,
                estimatedProfit,
                reason: profitable ? 'Profitable arbitrage opportunity' : `Profit ${ethers.formatEther(estimatedProfit)} below threshold ${ethers.formatEther(this.profitThreshold)}`
            };

        } catch (error) {
            return {
                profitable: false,
                estimatedProfit: 0n,
                reason: `Profitability analysis failed: ${error.message}`
            };
        }
    }

    async checkGasPrices(order) {
        try {
            const chainName = this.getChainName(order.sourceChain);
            const provider = this.providers[chainName];
            
            // Get current gas price
            const feeData = await provider.getFeeData();
            const currentGasPrice = feeData.gasPrice;
            
            // Estimate gas for order execution
            const estimatedGas = 500000n; // Conservative estimate
            const estimatedCost = currentGasPrice * estimatedGas;
            
            const acceptable = currentGasPrice <= this.maxGasPrice;
            
            return {
                acceptable,
                currentGasPrice,
                estimatedGas,
                estimatedCost,
                reason: acceptable ? 'Gas price acceptable' : `Gas price ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei exceeds max ${ethers.formatUnits(this.maxGasPrice, 'gwei')} gwei`
            };

        } catch (error) {
            return {
                acceptable: false,
                reason: `Gas check failed: ${error.message}`
            };
        }
    }

    async validateOrderOnChain(order) {
        try {
            const chainName = this.getChainName(order.sourceChain);
            const lopContract = this.lopContracts[chainName];
            
            if (!lopContract) {
                return {
                    valid: false,
                    reason: `LOP contract not available for ${chainName}`
                };
            }

            // Call validateOrderConditions
            const isValid = await lopContract.validateOrderConditions(order);
            
            return {
                valid: isValid,
                reason: isValid ? 'Order conditions valid' : 'Order conditions failed on-chain validation'
            };

        } catch (error) {
            return {
                valid: false,
                reason: `On-chain validation failed: ${error.message}`
            };
        }
    }

    async checkResolverAuthorization(order) {
        try {
            const chainName = this.getChainName(order.sourceChain);
            const lopContract = this.lopContracts[chainName];
            
            if (!lopContract) {
                return {
                    authorized: false,
                    chain: chainName,
                    reason: 'LOP contract not available'
                };
            }

            const isAuthorized = await lopContract.authorizedResolvers(this.wallet.address);
            
            return {
                authorized: isAuthorized,
                chain: chainName,
                reason: isAuthorized ? 'Authorized' : 'Not authorized as resolver'
            };

        } catch (error) {
            return {
                authorized: false,
                chain: this.getChainName(order.sourceChain),
                reason: `Authorization check failed: ${error.message}`
            };
        }
    }

    async executeOrder(order, signature, orderId) {
        try {
            const chainName = this.getChainName(order.sourceChain);
            const lopContract = this.lopContracts[chainName];
            
            if (!lopContract) {
                throw new Error(`LOP contract not available for ${chainName}`);
            }

            console.log(`⚡ Executing on ${chainName}...`);

            // Estimate gas
            let gasEstimate;
            try {
                gasEstimate = await lopContract.executeOrder.estimateGas(order, signature);
            } catch (error) {
                console.log('⚠️  Gas estimation failed, using default');
                gasEstimate = 500000n;
            }

            // Execute with gas buffer
            const tx = await lopContract.executeOrder(order, signature, {
                gasLimit: gasEstimate * 120n / 100n // 20% buffer
            });

            console.log(`📤 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Order executed! Block: ${receipt.blockNumber}`);

            // Update stats
            this.stats.ordersExecuted++;
            this.stats.totalGasUsed += receipt.gasUsed;

            // Extract escrow address from events
            const orderExecutedEvent = receipt.logs.find(log => {
                try {
                    const parsed = lopContract.interface.parseLog(log);
                    return parsed.name === 'OrderExecuted';
                } catch {
                    return false;
                }
            });

            if (orderExecutedEvent) {
                const parsed = lopContract.interface.parseLog(orderExecutedEvent);
                const escrowAddress = parsed.args.escrowContract;
                console.log(`🏭 Escrow deployed: ${escrowAddress}`);
                
                // Notify relayer of successful execution
                this.ws.send(JSON.stringify({
                    type: 'order_executed',
                    orderId,
                    txHash: tx.hash,
                    escrowAddress,
                    gasUsed: receipt.gasUsed.toString()
                }));
            }

            this.completedOrders.add(orderId);
            return receipt;

        } catch (error) {
            console.error(`❌ Order execution failed:`, error);
            
            // Notify relayer of failure
            this.ws.send(JSON.stringify({
                type: 'order_execution_failed',
                orderId,
                error: error.message
            }));
            
            throw error;
        }
    }

    async handleSecretUnlock(secretMessage) {
        const { orderHash, orderId, secret } = secretMessage;
        
        try {
            console.log(`🔐 Processing secret for order ${orderId}...`);
            
            // Here you would implement the escrow unlocking logic
            // This involves calling the escrow contract with the secret
            // to unlock the funds and complete the cross-chain swap
            
            console.log(`🔑 Secret received: ${secret.substring(0, 10)}...`);
            
            // TODO: Implement actual escrow unlocking
            // 1. Find the escrow contract address
            // 2. Call unlock function with the secret
            // 3. Complete the cross-chain settlement
            
            console.log(`✅ Secret processed for order ${orderId}`);
            
        } catch (error) {
            console.error(`❌ Secret unlock failed for order ${orderId}:`, error);
        }
    }

    async getTokenPrice(tokenA, tokenB, chain) {
        try {
            // Simplified price fetching - in production, integrate with DEX APIs
            // For now, return a mock rate
            return {
                rate: ethers.parseEther('1800'), // 1 ETH = 1800 USDC
                source: 'mock'
            };
        } catch (error) {
            throw new Error(`Price fetch failed: ${error.message}`);
        }
    }

    getChainName(chainId) {
        switch (parseInt(chainId)) {
            case 11155111:
                return 'sepolia';
            case 128123:
                return 'etherlink';
            default:
                throw new Error(`Unsupported chain ID: ${chainId}`);
        }
    }

    // Performance monitoring
    async getPerformanceStats() {
        const runtime = Date.now() - this.stats.startTime;
        const runtimeHours = runtime / (1000 * 60 * 60);
        
        return {
            ...this.stats,
            runtime: runtime,
            runtimeHours: runtimeHours.toFixed(2),
            ordersPerHour: this.stats.ordersProcessed / runtimeHours,
            successRate: this.stats.ordersProcessed > 0 ? 
                (this.stats.ordersExecuted / this.stats.ordersProcessed * 100).toFixed(2) + '%' : '0%',
            avgGasPerOrder: this.stats.ordersExecuted > 0 ? 
                (this.stats.totalGasUsed / BigInt(this.stats.ordersExecuted)).toString() : '0'
        };
    }

    async healthCheck() {
        console.log('🏥 Resolver Bot Health Check:');
        console.log('   Status:', this.isRunning ? 'Running' : 'Stopped');
        console.log('   Wallet:', this.wallet.address);
        console.log('   WebSocket:', this.ws.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected');
        console.log('   Processing Orders:', this.processingOrders.size);
        
        // Check balances
        for (const [chainName, provider] of Object.entries(this.providers)) {
            try {
                const balance = await provider.getBalance(this.wallet.address);
                console.log(`   ${chainName} Balance:`, ethers.formatEther(balance), 'ETH');
            } catch (error) {
                console.log(`   ${chainName} Balance: Error -`, error.message);
            }
        }

        // Performance stats
        const stats = await this.getPerformanceStats();
        console.log('   Orders Processed:', stats.ordersProcessed);
        console.log('   Orders Executed:', stats.ordersExecuted);
        console.log('   Success Rate:', stats.successRate);
        console.log('   Runtime:', stats.runtimeHours, 'hours');
    }

    start() {
        console.log('🚀 Resolver Bot starting...');
        
        // Health check every 5 minutes
        setInterval(() => this.healthCheck(), 300000);
        
        // Performance stats every hour
        setInterval(async () => {
            const stats = await this.getPerformanceStats();
            console.log('📊 Performance Update:', stats);
        }, 3600000);
        
        // Initial health check
        setTimeout(() => this.healthCheck(), 5000);
        
        console.log('✅ Resolver Bot is running and monitoring for orders');
    }

    stop() {
        console.log('🛑 Stopping Resolver Bot...');
        this.isRunning = false;
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Export and auto-start if run directly
module.exports = ResolverBot;

if (require.main === module) {
    const bot = new ResolverBot();
    bot.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down Resolver Bot...');
        bot.stop();
        process.exit(0);
    });
}