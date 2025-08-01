require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const axios = require('axios');
const WebSocket = require('ws');

/**
 * 🔄 Enhanced Relayer - Your Exact Workflow
 * 
 * Workflow:
 * 1. User requests quote → Relayer uses 1inch API (with fallbacks)
 * 2. User creates order → Relayer validates & publishes to orderbook
 * 3. Resolver picks up order → Triggers LOP
 * 4. Relayer monitors blockchain → Confirms escrow lock
 * 5. User provides secret → Relayer forwards to resolver
 * 6. Resolver unlocks funds → Complete
 */
class EnhancedRelayer {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupProviders();
        this.setupContracts();
        
        // Core data structures
        this.orderbook = new Map(); // orderId -> orderData
        this.priceCache = new Map(); // tokenPair -> priceData
        this.lockedEscrows = new Map(); // orderHash -> escrowData
        this.pendingSecrets = new Map(); // orderHash -> secretData
        this.resolvers = new Set(); // connected resolvers
        
        this.setupWebSocket();
        this.setupRoutes();
        this.startBlockchainMonitoring();
        
        console.log('🔄 Enhanced Relayer initialized with your exact workflow!');
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
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

        console.log('📡 Providers configured for Sepolia & Etherlink');
    }

    setupContracts() {
        // Your deployed EscrowFactory addresses
        this.escrowFactories = {
            sepolia: process.env.SEPOLIA_ESCROW_FACTORY_ADDRESS,
            etherlink: process.env.ETHERLINK_ESCROW_FACTORY_ADDRESS
        };

        // LOP contract ABI (will be set when deployed)
        const lopABI = [
            "function executeOrder((address,address,address,address,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes,uint256,bool,(uint256,uint256,address,string[],uint256,uint256,bytes)), bytes) external returns (address)",
            "function getOrderStatus(bytes32) external view returns (uint256)",
            "function getOrderEscrow(bytes32) external view returns (address)",
            "event OrderExecuted(bytes32 indexed orderHash, address indexed resolver, address indexed escrowContract, uint256 chainId)"
        ];

        // EscrowFactory ABI
        const escrowFactoryABI = [
            "function createDstEscrow((bytes32,bytes32,address,address,address,uint256,uint256,uint256), uint256) external payable",
            "event EscrowCreated(address indexed escrow, bytes32 indexed orderHash)"
        ];

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

    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: 8080 });
        this.wss.on('connection', (ws) => {
            console.log('🔗 New WebSocket connection');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('❌ WebSocket error:', error);
                    ws.send(JSON.stringify({ error: 'Invalid message format' }));
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                // Remove from resolvers if it was a resolver
                this.resolvers.delete(ws);
            });
        });

        console.log('🌐 WebSocket server started on port 8080');
    }

    setupRoutes() {
        // ============================================================================
        // STEP 1: PRICE QUOTE (User requests quote using 1inch API with fallbacks)
        // ============================================================================
        this.app.get('/api/quote', async (req, res) => {
            try {
                const { fromToken, toToken, amount, chainId } = req.query;
                
                if (!fromToken || !toToken || !amount || !chainId) {
                    return res.status(400).json({ 
                        error: 'Missing required parameters: fromToken, toToken, amount, chainId' 
                    });
                }

                console.log(`💰 Quote request: ${amount} ${fromToken} → ${toToken} on chain ${chainId}`);
                
                const quote = await this.getQuoteWithFallbacks(fromToken, toToken, amount, chainId);
                
                res.json({
                    success: true,
                    quote,
                    timestamp: Date.now(),
                    validFor: 30000, // 30 seconds
                    source: quote.source
                });

            } catch (error) {
                console.error('❌ Quote error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ============================================================================
        // STEP 2: ORDER VALIDATION & PUBLISHING (Validate and publish to orderbook)
        // ============================================================================
        this.app.post('/api/orders', async (req, res) => {
            try {
                const { order, signature } = req.body;
                
                console.log('📝 New order received for validation');
                
                // Validate order structure and parameters
                const validation = await this.validateOrder(order, signature);
                if (!validation.valid) {
                    return res.status(400).json({ error: validation.reason });
                }

                // Generate order ID and hash
                const orderId = this.generateOrderId();
                const orderHash = await this.calculateOrderHash(order);
                
                // Store in orderbook
                const orderData = {
                    id: orderId,
                    hash: orderHash,
                    order,
                    signature,
                    status: 'pending',
                    createdAt: Date.now(),
                    maker: order.maker
                };
                
                this.orderbook.set(orderId, orderData);
                
                // Broadcast to resolvers
                this.broadcastToResolvers({
                    type: 'new_order',
                    orderId,
                    orderHash,
                    order,
                    signature
                });

                console.log(`✅ Order ${orderId} validated and published to orderbook`);
                
                res.json({
                    success: true,
                    orderId,
                    orderHash,
                    status: 'published',
                    message: 'Order published to orderbook, waiting for resolver'
                });

            } catch (error) {
                console.error('❌ Order validation error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ============================================================================
        // STEP 3: ORDER STATUS (Check order status)
        // ============================================================================
        this.app.get('/api/orders/:orderId', async (req, res) => {
            try {
                const { orderId } = req.params;
                const orderData = this.orderbook.get(orderId);
                
                if (!orderData) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                // Check blockchain status if order was executed
                if (orderData.status === 'executed') {
                    const escrowData = this.lockedEscrows.get(orderData.hash);
                    if (escrowData) {
                        orderData.escrowAddress = escrowData.address;
                        orderData.escrowStatus = escrowData.status;
                        orderData.chain = escrowData.chain;
                    }
                }

                res.json({
                    success: true,
                    order: orderData
                });

            } catch (error) {
                console.error('❌ Order status error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ============================================================================
        // STEP 4: SECRET SUBMISSION (User provides secret after escrow is locked)
        // ============================================================================
        this.app.post('/api/orders/:orderId/secret', async (req, res) => {
            try {
                const { orderId } = req.params;
                const { secret, signature } = req.body;
                
                const orderData = this.orderbook.get(orderId);
                if (!orderData) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                // Verify the secret matches the hash in the order
                const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                if (secretHash !== orderData.order.secretHash) {
                    return res.status(400).json({ error: 'Invalid secret' });
                }

                // Verify signature from maker
                const message = ethers.solidityPackedKeccak256(
                    ['string', 'string', 'bytes32'],
                    ['RELEASE_SECRET', secret, orderData.hash]
                );
                const recoveredAddress = ethers.verifyMessage(ethers.getBytes(message), signature);
                
                if (recoveredAddress.toLowerCase() !== orderData.order.maker.toLowerCase()) {
                    return res.status(400).json({ error: 'Invalid signature' });
                }

                // Store secret for resolver
                this.pendingSecrets.set(orderData.hash, {
                    secret,
                    signature,
                    submittedAt: Date.now(),
                    orderId
                });

                // Forward secret to resolver
                this.broadcastToResolvers({
                    type: 'secret_available',
                    orderHash: orderData.hash,
                    orderId,
                    secret
                });

                console.log(`🔐 Secret received for order ${orderId} and forwarded to resolver`);
                
                res.json({
                    success: true,
                    message: 'Secret received and forwarded to resolver for unlock'
                });

            } catch (error) {
                console.error('❌ Secret submission error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ============================================================================
        // ADMIN & MONITORING ROUTES
        // ============================================================================
        this.app.get('/api/orderbook', (req, res) => {
            const orders = Array.from(this.orderbook.values());
            res.json({ 
                success: true, 
                orders,
                summary: {
                    total: orders.length,
                    pending: orders.filter(o => o.status === 'pending').length,
                    picked: orders.filter(o => o.status === 'picked').length,
                    executed: orders.filter(o => o.status === 'executed').length
                }
            });
        });

        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                status: 'healthy',
                orderbook: this.orderbook.size,
                lockedEscrows: this.lockedEscrows.size,
                pendingSecrets: this.pendingSecrets.size,
                connectedResolvers: this.resolvers.size,
                timestamp: Date.now()
            });
        });

        console.log('🛣️  API routes configured for your exact workflow');
    }

    // ============================================================================
    // PRICE QUOTE WITH FALLBACKS (1inch API + alternatives)
    // ============================================================================
    async getQuoteWithFallbacks(fromToken, toToken, amount, chainId) {
        const sources = [
            { name: '1inch', method: this.get1inchQuote.bind(this) },
            { name: 'CoinGecko', method: this.getCoinGeckoQuote.bind(this) },
            { name: 'Fallback', method: this.getFallbackQuote.bind(this) }
        ];

        for (const source of sources) {
            try {
                console.log(`🔍 Trying ${source.name} for quote...`);
                const quote = await source.method(fromToken, toToken, amount, chainId);
                if (quote) {
                    quote.source = source.name;
                    console.log(`✅ Quote successful from ${source.name}`);
                    return quote;
                }
            } catch (error) {
                console.log(`❌ ${source.name} failed: ${error.message}`);
                continue;
            }
        }

        throw new Error('All price sources failed');
    }

    async get1inchQuote(fromToken, toToken, amount, chainId) {
        try {
            const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote`;
            const params = {
                src: fromToken,
                dst: toToken,
                amount: amount
            };

            const response = await axios.get(url, {
                params,
                headers: {
                    'Authorization': `Bearer ${process.env.oneInchApiKey}`,
                    'accept': 'application/json'
                },
                timeout: 10000
            });

            return {
                fromToken,
                toToken,
                fromAmount: amount,
                toAmount: response.data.dstAmount,
                estimatedGas: response.data.estimatedGas,
                protocols: response.data.protocols
            };

        } catch (error) {
            if (error.response?.status === 400) {
                console.log('⚠️  1inch API: Token pair not supported on this chain');
            }
            throw error;
        }
    }

    async getCoinGeckoQuote(fromToken, toToken, amount, chainId) {
        // Fallback to CoinGecko API
        try {
            // This is a simplified implementation
            // In production, you'd implement proper CoinGecko integration
            console.log('🦎 Using CoinGecko fallback...');
            
            // Mock quote for now - implement actual CoinGecko API
            return {
                fromToken,
                toToken,
                fromAmount: amount,
                toAmount: (BigInt(amount) * 95n / 100n).toString(), // 5% slippage estimate
                estimatedGas: '150000',
                protocols: ['CoinGecko']
            };
        } catch (error) {
            throw error;
        }
    }

    async getFallbackQuote(fromToken, toToken, amount, chainId) {
        // Last resort fallback
        console.log('🔄 Using fallback pricing...');
        
        return {
            fromToken,
            toToken,
            fromAmount: amount,
            toAmount: (BigInt(amount) * 90n / 100n).toString(), // 10% conservative estimate
            estimatedGas: '200000',
            protocols: ['Fallback']
        };
    }

    // ============================================================================
    // ORDER VALIDATION
    // ============================================================================
    async validateOrder(order, signature) {
        try {
            // 1. Check required fields
            const requiredFields = ['maker', 'makerAsset', 'takerAsset', 'makerAmount', 'takerAmount', 'deadline', 'secretHash'];
            for (const field of requiredFields) {
                if (!order[field]) {
                    return { valid: false, reason: `Missing required field: ${field}` };
                }
            }

            // 2. Check deadline
            if (order.deadline <= Date.now() / 1000) {
                return { valid: false, reason: 'Order deadline has passed' };
            }

            // 3. Verify signature (simplified - implement proper EIP-712)
            const orderHash = await this.calculateOrderHash(order);
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(orderHash), signature);
            
            if (recoveredAddress.toLowerCase() !== order.maker.toLowerCase()) {
                return { valid: false, reason: 'Invalid signature' };
            }

            // 4. Check maker balance (simplified)
            const chainId = order.sourceChain || 11155111;
            const provider = chainId === 11155111 ? this.providers.sepolia : this.providers.etherlink;
            
            if (order.makerAsset === ethers.ZeroAddress) {
                const balance = await provider.getBalance(order.maker);
                if (balance < BigInt(order.makerAmount)) {
                    return { valid: false, reason: 'Insufficient ETH balance' };
                }
            }

            return { valid: true };

        } catch (error) {
            console.error('❌ Order validation error:', error);
            return { valid: false, reason: `Validation failed: ${error.message}` };
        }
    }

    // ============================================================================
    // BLOCKCHAIN MONITORING (Step 4: Monitor for escrow locks)
    // ============================================================================
    startBlockchainMonitoring() {
        console.log('👀 Starting blockchain monitoring for escrow locks...');
        
        // Monitor both chains for escrow creation events
        this.monitorChain('sepolia');
        this.monitorChain('etherlink');
    }

    async monitorChain(chainName) {
        const provider = this.providers[chainName];
        const escrowFactoryAddress = this.escrowFactories[chainName];
        
        if (!escrowFactoryAddress) {
            console.log(`⚠️  No EscrowFactory address for ${chainName}`);
            return;
        }

        // Listen for EscrowCreated events
        const escrowFactoryABI = [
            "event EscrowCreated(address indexed escrow, bytes32 indexed orderHash)"
        ];
        
        const escrowFactory = new ethers.Contract(
            escrowFactoryAddress,
            escrowFactoryABI,
            provider
        );

        escrowFactory.on('EscrowCreated', async (escrowAddress, orderHash, event) => {
            console.log(`🏭 Escrow created on ${chainName}:`, escrowAddress, orderHash);
            
            // Store escrow data
            this.lockedEscrows.set(orderHash, {
                address: escrowAddress,
                chain: chainName,
                status: 'locked',
                createdAt: Date.now(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });

            // Update order status in orderbook
            for (const [orderId, orderData] of this.orderbook.entries()) {
                if (orderData.hash === orderHash) {
                    orderData.status = 'executed';
                    orderData.escrowAddress = escrowAddress;
                    orderData.executedAt = Date.now();
                    
                    // Notify user that funds are locked and secret is needed
                    this.broadcastToUsers({
                        type: 'escrow_locked',
                        orderId,
                        orderHash,
                        escrowAddress,
                        chain: chainName,
                        message: 'Funds locked in escrow. Please provide your secret to complete the swap.'
                    });
                    
                    break;
                }
            }
        });

        console.log(`📡 Monitoring ${chainName} for escrow events`);
    }

    // ============================================================================
    // WEBSOCKET HANDLERS
    // ============================================================================
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'subscribe_resolver':
                ws.isResolver = true;
                this.resolvers.add(ws);
                ws.send(JSON.stringify({ type: 'subscribed', role: 'resolver' }));
                console.log('🤖 Resolver subscribed');
                break;
                
            case 'subscribe_user':
                ws.userId = data.userId;
                ws.send(JSON.stringify({ type: 'subscribed', role: 'user' }));
                console.log(`👤 User ${data.userId} subscribed`);
                break;
                
            case 'order_picked':
                // Resolver picked up an order
                const orderData = this.orderbook.get(data.orderId);
                if (orderData) {
                    orderData.status = 'picked';
                    orderData.resolver = data.resolver;
                    orderData.pickedAt = Date.now();
                    
                    this.broadcastToUsers({
                        type: 'order_picked',
                        orderId: data.orderId,
                        resolver: data.resolver
                    });
                }
                break;
                
            default:
                ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
    }

    broadcastToResolvers(message) {
        this.resolvers.forEach(resolver => {
            if (resolver.readyState === WebSocket.OPEN) {
                resolver.send(JSON.stringify(message));
            }
        });
    }

    broadcastToUsers(message) {
        this.wss.clients.forEach(client => {
            if (!client.isResolver && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    generateOrderId() {
        return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async calculateOrderHash(order) {
        // Simplified order hash calculation
        return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
            [order.maker, order.makerAsset, order.takerAsset, order.makerAmount, order.takerAmount, order.deadline, order.secretHash]
        ));
    }

    // ============================================================================
    // SERVER STARTUP
    // ============================================================================
    start(port = process.env.PORT || 3001) {
        this.app.listen(port, () => {
            console.log(`🚀 Enhanced Relayer running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/api/health`);
            console.log(`📖 Orderbook: http://localhost:${port}/api/orderbook`);
            console.log(`🌐 WebSocket: ws://localhost:8080`);
            console.log('');
            console.log('🔄 Workflow Ready:');
            console.log('1. GET /api/quote - Price quotes with 1inch API + fallbacks');
            console.log('2. POST /api/orders - Order validation & orderbook publishing');
            console.log('3. Resolver pickup via WebSocket');
            console.log('4. Blockchain monitoring for escrow locks');
            console.log('5. POST /api/orders/:id/secret - Secret forwarding to resolver');
        });
    }
}

// Export and auto-start if run directly
module.exports = EnhancedRelayer;

if (require.main === module) {
    const relayer = new EnhancedRelayer();
    relayer.start();
}