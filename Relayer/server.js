require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const FusionPlusRelayer = require('./src/FusionPlusRelayer');

const app = express();
const wss = new WebSocketServer({ port: 8080 });

// Configuration
const config = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    DEPLOYER_ADDRESS: process.env.DEPLOYER_ADDRESS || '0x5e8c9f71b484f082df54bd6473dfbf74abba266d'
};

// Initialize 1inch Fusion+ relayer
let relayer;
try {
    relayer = new FusionPlusRelayer(config);
} catch (error) {
    console.error('❌ Failed to initialize 1inch Fusion+ relayer:', error.message);
    process.exit(1);
}

// REST API
app.use(express.json());

// CORS middleware - Allow requests from your UI
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/', (req, res) => {
    res.json({
        protocol: '1inch Fusion+',
        message: 'Intent-based Atomic Cross-Chain Swaps',
        specification: 'https://1inch.io/assets/1inch-fusion-plus.pdf',
        mode: 'dynamic',
        description: 'Networks and contracts connected on-demand based on user orders',
        supportedNetworks: ['etherlink', 'ethereum'],
        features: [
            'Dutch Auction Mechanism',
            'Partial Fill Support with Merkle Trees',
            'Safety Deposit System',
            'Gas Price Adjustments',
            '4-Phase Atomic Swap Protocol',
            'Dynamic Network Connection',
            'Bidirectional Cross-Chain Swaps'
        ],
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', async (req, res) => {
    try {
        const status = await relayer.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ 
            protocol: '1inch Fusion+',
            error: error.message 
        });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        console.log('📝 New 1inch Fusion+ order received:', req.body);
        
        // Validate required fields - NO DEFAULTS
        if (!req.body.maker) throw new Error('maker address is required');
        if (!req.body.fromChain) throw new Error('fromChain is required');
        if (!req.body.toChain) throw new Error('toChain is required');
        if (!req.body.fromToken) throw new Error('fromToken address is required');
        if (!req.body.toToken) throw new Error('toToken address is required');
        if (!req.body.fromAmount) throw new Error('fromAmount is required');
        if (!req.body.toAmount) throw new Error('toAmount is required');
        if (!req.body.nonce) throw new Error('nonce is required');
        if (!req.body.deadline) throw new Error('deadline is required');
        if (!req.body.signature) throw new Error('signature is required');

        // Map UI order format to relayer format - NO DEFAULTS
        const orderData = {
            // Basic order info - from user input only
            maker: req.body.maker,
            makerAsset: req.body.fromToken,
            takerAsset: req.body.toToken,
            makerAmount: req.body.fromAmount,
            
            // Price and auction settings - from user input only
            startPrice: req.body.fromAmount,
            endPrice: req.body.toAmount,
            duration: 300000, // Only auction duration has default
            partsAmount: 4,
            gasAdjustment: true,
            
            // Cross-chain info - from user input only
            fromChain: req.body.fromChain,
            toChain: req.body.toChain,
            nonce: req.body.nonce,
            deadline: req.body.deadline,
            signature: req.body.signature,
            
            // Additional metadata
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        console.log('🔄 Mapped order data:', orderData);
        const result = await relayer.announceOrder(orderData);
        
        res.json({ 
            success: true, 
            protocol: '1inch Fusion+',
            orderId: result.id, 
            message: 'Order announced - Dutch auction started',
            phase: '1 - Announcement',
            auctionDetails: {
                startPrice: req.body.startPrice || '1.0',
                endPrice: req.body.endPrice || '0.95',
                duration: `${(req.body.duration || 300000) / 1000}s`,
                partsAmount: orderData.partsAmount
            },
            merkleRoot: `0x${result.merkleRoot}`,
            nextPhase: 'Deposit Phase (when auction completes)'
        });
    } catch (error) {
        console.error('❌ 1inch Fusion+ order processing failed:', error);
        res.status(500).json({ 
            protocol: '1inch Fusion+',
            error: error.message,
            phase: 'Order Announcement Failed'
        });
    }
});

// Helper function to safely serialize BigInt values
function safeBigIntStringify(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
}

app.get('/api/orders', (req, res) => {
    try {
        const orders = relayer.getAllOrders();
        const response = { 
            protocol: '1inch Fusion+',
            orders, 
            count: orders.length,
            summary: {
                announced: orders.filter(o => o.status === 'announced').length,
                depositing: orders.filter(o => o.status === 'depositing').length,
                escrows_created: orders.filter(o => o.status === 'escrows_created').length,
                secret_revealed: orders.filter(o => o.status === 'secret_revealed').length,
                completed: orders.filter(o => o.status === 'completed').length,
                recovered: orders.filter(o => o.status === 'recovered').length
            }
        };
        
        // Safely serialize any remaining BigInt values
        const safeResponse = safeBigIntStringify(response);
        res.json(safeResponse);
    } catch (error) {
        console.error('❌ Error in /api/orders:', error.message);
        res.status(500).json({ 
            protocol: '1inch Fusion+',
            error: error.message 
        });
    }
});

app.get('/api/test-connection', async (req, res) => {
    try {
        const result = await relayer.testConnection();
        res.json({ 
            protocol: '1inch Fusion+',
            success: result, 
            message: result ? 'All 1inch Fusion+ infrastructure ready' : 'Connection failed',
            specification: 'https://1inch.io/assets/1inch-fusion-plus.pdf'
        });
    } catch (error) {
        res.status(500).json({ 
            protocol: '1inch Fusion+',
            error: error.message 
        });
    }
});

// New endpoint for protocol information
app.get('/api/protocol', (req, res) => {
    res.json({
        name: '1inch Fusion+',
        description: 'Intent-based Atomic Cross-Chain Swaps',
        specification: 'https://1inch.io/assets/1inch-fusion-plus.pdf',
        phases: {
            1: 'Announcement Phase - Dutch auction with decreasing price',
            2: 'Deposit Phase - Escrow creation on both chains with safety deposits', 
            3: 'Withdrawal Phase - Secret revelation and fund transfers',
            4: 'Recovery Phase - Cancellation and fund recovery if needed'
        },
        features: {
            dutchAuction: 'Competitive price discovery mechanism',
            partialFills: 'Merkle tree based secret management for N+1 secrets',
            safetyDeposits: 'Incentivize proper execution and completion',
            gasAdjustments: 'Dynamic price adjustments based on gas costs',
            crossChain: 'Etherlink ↔ Ethereum atomic swaps',
            trustless: 'No intermediaries, fully decentralized'
        },
        timeouts: {
            finalityLock: '60 seconds',
            exclusiveWithdraw: '300 seconds', 
            cancellation: '600 seconds'
        }
    });
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection to 1inch Fusion+ relayer');
    
    ws.send(JSON.stringify({ 
        type: 'welcome', 
        protocol: '1inch Fusion+',
        message: 'Connected to 1inch Fusion+ Relayer',
        specification: 'https://1inch.io/assets/1inch-fusion-plus.pdf',
        timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 WebSocket message:', data);
            
            // Enhanced echo with protocol info
            ws.send(JSON.stringify({
                type: 'echo',
                protocol: '1inch Fusion+',
                data: data,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Invalid WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                protocol: '1inch Fusion+',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
    });
});

// Start the server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log('🚀 1inch Fusion+ Relayer running on port', PORT);
    console.log('📖 Specification: https://1inch.io/assets/1inch-fusion-plus.pdf');
    console.log('🔧 Mode: Dynamic (networks connected on-demand)');
    console.log('📋 API: http://localhost:' + PORT);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down 1inch Fusion+ relayer gracefully...');
    server.close(() => {
        if (relayer && relayer.stop) {
            relayer.stop();
        }
        console.log('✅ 1inch Fusion+ relayer stopped');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception in 1inch Fusion+ relayer:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection in 1inch Fusion+ relayer at:', promise, 'reason:', reason);
    process.exit(1);
}); 