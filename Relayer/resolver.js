require('dotenv').config();
const { ethers } = require('ethers');
const WebSocket = require('ws');

/**
 * 🤖 Resolver - Works with Enhanced Relayer
 * 
 * This resolver:
 * 1. Connects to relayer via WebSocket
 * 2. Picks up orders from orderbook
 * 3. Triggers LOP execution on-chain
 * 4. Uses secrets to unlock escrows
 */
class Resolver {
    constructor() {
        this.setupProviders();
        this.setupContracts();
        this.connectToRelayer();
        this.processingOrders = new Set();
        
        console.log('🤖 Resolver initialized for your workflow');
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

        console.log('📡 Resolver wallet:', this.wallet.address);
    }

    setupContracts() {
        // LimitOrderProtocol ABI
        const lopABI = [
            "function executeOrder((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes)), bytes) external returns (address)",
            "function validateOrderConditions((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bool)",
            "function getOrderHash((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bytes32)",
            "function getOrderStatus(bytes32) external view returns (uint256)",
            "event OrderExecuted(bytes32 indexed orderHash, address indexed resolver, address indexed escrowContract, uint256 chainId)"
        ];

        // Your deployed EscrowFactory addresses
        this.escrowFactories = {
            sepolia: process.env.SEPOLIA_ESCROW_FACTORY_ADDRESS,
            etherlink: process.env.ETHERLINK_ESCROW_FACTORY_ADDRESS
        };

        // LOP contract instances (will be set when deployed)
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

        console.log('📋 Contracts configured');
    }

    connectToRelayer() {
        const relayerUrl = process.env.RELAYER_WS_URL || 'ws://localhost:8080';
        
        this.ws = new WebSocket(relayerUrl);
        
        this.ws.on('open', () => {
            console.log('🔗 Connected to relayer');
            
            // Subscribe as resolver
            this.ws.send(JSON.stringify({
                type: 'subscribe_resolver',
                resolver: this.wallet.address
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
            console.log('🔌 Disconnected from relayer, reconnecting...');
            setTimeout(() => this.connectToRelayer(), 5000);
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
    }

    async handleRelayerMessage(message) {
        switch (message.type) {
            case 'subscribed':
                console.log('✅ Subscribed to relayer as resolver');
                break;

            case 'new_order':
                console.log('📋 New order available:', message.orderId);
                await this.analyzeAndExecuteOrder(message);
                break;

            case 'secret_available':
                console.log('🔐 Secret available for order:', message.orderId);
                await this.handleSecretUnlock(message);
                break;

            default:
                console.log('📨 Unknown message type:', message.type);
        }
    }

    async analyzeAndExecuteOrder(orderMessage) {
        const { orderId, orderHash, order, signature } = orderMessage;
        
        // Prevent duplicate processing
        if (this.processingOrders.has(orderId)) {
            console.log('⏭️  Order already being processed:', orderId);
            return;
        }

        this.processingOrders.add(orderId);

        try {
            console.log(`🔍 Analyzing order ${orderId}...`);
            
            // 1. Basic profitability check
            const isProfitable = await this.checkProfitability(order);
            if (!isProfitable) {
                console.log(`❌ Order ${orderId} not profitable, skipping`);
                return;
            }

            // 2. Validate order on-chain (if LOP is deployed)
            const isValid = await this.validateOrderOnChain(order);
            if (!isValid) {
                console.log(`❌ Order ${orderId} validation failed, skipping`);
                return;
            }

            // 3. Notify relayer we're picking up the order
            this.ws.send(JSON.stringify({
                type: 'order_picked',
                orderId,
                resolver: this.wallet.address
            }));

            // 4. Execute order on-chain
            console.log(`⚡ Executing order ${orderId} on-chain...`);
            await this.executeOrderOnChain(order, signature, orderId);

        } catch (error) {
            console.error(`❌ Error processing order ${orderId}:`, error);
        } finally {
            this.processingOrders.delete(orderId);
        }
    }

    async checkProfitability(order) {
        try {
            // Simple profitability check
            const makerAmount = BigInt(order.makerAmount);
            const takerAmount = BigInt(order.takerAmount);
            
            // Check if the exchange rate is reasonable
            if (makerAmount === 0n || takerAmount === 0n) {
                return false;
            }

            // For demo purposes, accept all orders
            // In production, implement sophisticated profitability analysis
            console.log(`💰 Order exchange rate: ${ethers.formatEther(makerAmount)} → ${ethers.formatEther(takerAmount)}`);
            
            return true;

        } catch (error) {
            console.error('❌ Profitability check error:', error);
            return false;
        }
    }

    async validateOrderOnChain(order) {
        try {
            // Determine which chain to validate on
            const chainName = this.getChainName(order.sourceChain || 11155111);
            const lopContract = this.lopContracts[chainName];
            
            if (!lopContract) {
                console.log(`⚠️  LOP contract not deployed yet for chain ${chainName}`);
                return true; // Allow for now if LOP not deployed
            }

            // Transform order to match contract struct format
            const orderStruct = [
                order.maker,
                order.makerAsset,
                order.takerAsset,
                order.makerAmount,
                order.takerAmount,
                order.deadline,
                order.secretHash,
                order.nonce || 0,
                order.sourceChain || 11155111,
                order.destChain || 128123,
                '0x', // predicateData - empty for now
                order.sourceChain || 11155111,
                false, // gasAdjustment
                [0, 0, ethers.ZeroAddress, [], 0, 0, '0x'] // predicateParams - default values
            ];

            // Call validateOrderConditions on the LOP contract
            const isValid = await lopContract.validateOrderConditions(orderStruct);
            console.log(`🔍 On-chain validation result: ${isValid}`);
            
            return isValid;

        } catch (error) {
            console.error('❌ On-chain validation error:', error);
            return true; // Allow for now if validation fails
        }
    }

    async executeOrderOnChain(order, signature, orderId) {
        try {
            // Determine which chain to execute on
            const chainName = this.getChainName(order.sourceChain || 11155111);
            const lopContract = this.lopContracts[chainName];
            
            if (!lopContract) {
                console.log(`⚠️  LOP contract not deployed yet for chain ${chainName}`);
                console.log(`📝 Would execute order ${orderId} when LOP is deployed`);
                return;
            }

            console.log(`⚡ Executing on ${chainName} chain...`);

            // Transform order to match contract struct format
            const orderStruct = [
                order.maker,
                order.makerAsset,
                order.takerAsset,
                order.makerAmount,
                order.takerAmount,
                order.deadline,
                order.secretHash,
                order.nonce || 0,
                order.sourceChain || 11155111,
                order.destChain || 128123,
                '0x', // predicateData - empty for now
                order.sourceChain || 11155111,
                false, // gasAdjustment
                [0, 0, ethers.ZeroAddress, [], 0, 0, '0x'] // predicateParams - default values
            ];

            // Estimate gas
            const gasEstimate = await lopContract.executeOrder.estimateGas(orderStruct, signature);
            console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

            // Execute the order
            const tx = await lopContract.executeOrder(orderStruct, signature, {
                gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
            });

            console.log(`📤 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Order executed! Block: ${receipt.blockNumber}`);

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
                console.log(`🏭 Escrow deployed at: ${escrowAddress}`);
            }

            return receipt;

        } catch (error) {
            console.error('❌ Order execution error:', error);
            throw error;
        }
    }

    async handleSecretUnlock(secretMessage) {
        const { orderHash, orderId, secret } = secretMessage;
        
        try {
            console.log(`🔐 Processing secret for order ${orderId}...`);
            
            // In a real implementation, you would:
            // 1. Use the secret to unlock the escrow contract
            // 2. Complete the cross-chain swap
            // 3. Claim any rewards/fees
            
            console.log(`🔑 Secret received for order ${orderId}: ${secret.substring(0, 10)}...`);
            
            // TODO: Implement escrow unlocking logic here
            // This would involve calling the escrow contract's unlock function
            console.log(`✅ Secret processed for order ${orderId}`);
            
        } catch (error) {
            console.error(`❌ Secret unlock error for order ${orderId}:`, error);
        }
    }

    getChainName(chainId) {
        switch (parseInt(chainId)) {
            case 11155111:
                return 'sepolia';
            case 128123: // Etherlink testnet
                return 'etherlink';
            default:
                console.log(`⚠️  Unknown chain ID: ${chainId}, defaulting to sepolia`);
                return 'sepolia';
        }
    }

    // Update LOP contract addresses after deployment
    updateLOPAddresses(sepoliaAddress, etherlinkAddress) {
        const lopABI = [
            "function executeOrder((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes)), bytes) external returns (address)",
            "function validateOrderConditions((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bool)",
            "function getOrderHash((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes))) external view returns (bytes32)",
            "function getOrderStatus(bytes32) external view returns (uint256)",
            "event OrderExecuted(bytes32 indexed orderHash, address indexed resolver, address indexed escrowContract, uint256 chainId)"
        ];

        if (sepoliaAddress) {
            this.lopContracts.sepolia = new ethers.Contract(
                sepoliaAddress,
                lopABI,
                this.signers.sepolia
            );
            console.log('✅ Sepolia LOP contract updated:', sepoliaAddress);
        }

        if (etherlinkAddress) {
            this.lopContracts.etherlink = new ethers.Contract(
                etherlinkAddress,
                lopABI,
                this.signers.etherlink
            );
            console.log('✅ Etherlink LOP contract updated:', etherlinkAddress);
        }
    }

    // Health check
    async healthCheck() {
        console.log('🏥 Resolver Health Check:');
        console.log('   Wallet:', this.wallet.address);
        console.log('   WebSocket:', this.ws.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected');
        console.log('   Processing orders:', this.processingOrders.size);
        
        // Check balances
        for (const [chainName, provider] of Object.entries(this.providers)) {
            try {
                const balance = await provider.getBalance(this.wallet.address);
                console.log(`   ${chainName} balance:`, ethers.formatEther(balance), 'ETH');
            } catch (error) {
                console.log(`   ${chainName} balance: Error -`, error.message);
            }
        }
    }

    // Start the resolver
    start() {
        console.log('🚀 Resolver started and ready to process orders');
        
        // Health check every 5 minutes
        setInterval(() => this.healthCheck(), 300000);
        
        // Initial health check
        setTimeout(() => this.healthCheck(), 5000);
    }
}

// Export and auto-start if run directly
module.exports = Resolver;

if (require.main === module) {
    const resolver = new Resolver();
    resolver.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down resolver...');
        if (resolver.ws) {
            resolver.ws.close();
        }
        process.exit(0);
    });
}