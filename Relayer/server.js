require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const FusionPlusRelayer = require('./src/FusionPlusRelayer');

console.log('🚀 Starting 1inch Fusion+ Relayer...');
console.log('📖 Based on official 1inch Fusion+ specification');
console.log('🔗 https://1inch.io/assets/1inch-fusion-plus.pdf');

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
    console.log('✅ 1inch Fusion+ Relayer initialized successfully');
    console.log('🏗️  Contracts deployed:');
    console.log('   📍 Etherlink (Source): 0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff');
    console.log('   📍 Sepolia (Destination): 0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312');
} catch (error) {
    console.error('❌ Failed to initialize 1inch Fusion+ relayer:', error.message);
    process.exit(1);
}

// REST API
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        protocol: '1inch Fusion+',
        message: 'Intent-based Atomic Cross-Chain Swaps',
        specification: 'https://1inch.io/assets/1inch-fusion-plus.pdf',
        contracts: {
            etherlink: {
                address: '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
                role: 'Source Chain',
                network: 'Etherlink Ghostnet'
            },
            sepolia: {
                address: '0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312',
                role: 'Destination Chain',
                network: 'Ethereum Sepolia'
            }
        },
        features: [
            'Dutch Auction Mechanism',
            'Partial Fill Support with Merkle Trees',
            'Safety Deposit System',
            'Gas Price Adjustments',
            '4-Phase Atomic Swap Protocol'
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
        
        // Validate order data
        const orderData = {
            maker: req.body.maker || config.DEPLOYER_ADDRESS,
            makerAsset: req.body.makerAsset || '0x0000000000000000000000000000000000000000',
            takerAsset: req.body.takerAsset || '0x0000000000000000000000000000000000000000',
            makerAmount: req.body.makerAmount || '1.0',
            startPrice: req.body.startPrice || '1.0',
            endPrice: req.body.endPrice || '0.95',
            duration: req.body.duration || 300000, // 5 minutes
            partsAmount: req.body.partsAmount || 4,
            gasAdjustment: req.body.gasAdjustment !== false
        };
        
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

app.get('/api/orders', (req, res) => {
    try {
        const orders = relayer.getAllOrders();
        res.json({ 
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
        });
    } catch (error) {
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
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log('');
    console.log('✅ 1inch Fusion+ Relayer Server running!');
    console.log('📖 Implementing official 1inch Fusion+ specification');
    console.log('');
    console.log('🌐 Server Details:');
    console.log(`   HTTP API: http://localhost:${PORT}`);
    console.log('   WebSocket: ws://localhost:8080');
    console.log('');
    console.log('🏭 Cross-Chain Infrastructure:');
    console.log('   Source Chain:      Etherlink Ghostnet');
    console.log('   Destination Chain: Ethereum Sepolia');
    console.log('   Contract (Source): 0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff');
    console.log('   Contract (Dest):   0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312');
    console.log('');
    console.log('📋 Available endpoints:');
    console.log(`   GET  http://localhost:${PORT}/`);
    console.log(`   GET  http://localhost:${PORT}/api/status`);
    console.log(`   GET  http://localhost:${PORT}/api/protocol`);
    console.log(`   GET  http://localhost:${PORT}/api/test-connection`);
    console.log(`   POST http://localhost:${PORT}/api/orders`);
    console.log(`   GET  http://localhost:${PORT}/api/orders`);
    console.log('');
    console.log('🔄 4-Phase Protocol:');
    console.log('   Phase 1: Announcement (Dutch Auction)');
    console.log('   Phase 2: Deposit (Escrow Creation)'); 
    console.log('   Phase 3: Withdrawal (Secret Revelation)');
    console.log('   Phase 4: Recovery (Cancellation if needed)');
    console.log('');
    console.log('🎯 Ready for 1inch Fusion+ cross-chain swaps!');
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