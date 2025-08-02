const express = require('express');
const { WebSocketServer } = require('ws');

console.log('🚀 Starting Simple Cross-Chain Relayer...');

const app = express();
const wss = new WebSocketServer({ noServer: true });

// In-memory storage for orders
let orders = [];

// Middleware
app.use(express.json());

// CORS middleware
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

// Health check
app.get('/', (req, res) => {
  res.json({
    protocol: 'Cross-Chain Swap',
    message: 'Simple Cross-Chain Relayer Running',
    status: 'running',
    orders: orders.length,
    timestamp: new Date().toISOString()
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  const { user } = req.query;
  
  if (user) {
    // Filter orders by user address for ProcessPage
    const userOrders = orders.filter(order => 
      order.maker.toLowerCase() === user.toLowerCase()
    );
    res.json({ orders: userOrders });
  } else {
    // Return all orders for the orderbook page
    res.json({ orders: orders });
  }
});

// Submit new order
app.post('/api/orders', (req, res) => {
  try {
    const order = req.body;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newOrder = {
      ...order,
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    orders.push(newOrder);
    
    // Broadcast to WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'order_update',
          order: newOrder
        }));
      }
    });
    
    res.json({ 
      orderId,
      message: 'Order submitted successfully',
      order: newOrder
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

// Get price quote
app.get('/api/quote', (req, res) => {
  const { fromToken, toToken, amount, chainId } = req.query;
  
  // Mock quote calculation
  const mockQuote = {
    toTokenAmount: (parseFloat(amount) * 0.98).toFixed(18),
    estimatedGas: '50000',
    price: '0.98',
    fromToken, 
    toToken, 
    amount, 
    chainId
  };
  
  res.json(mockQuote);
});

// Provide secret
app.post('/api/provide-secret', (req, res) => {
  try {
    const { orderId, secret, userAddress } = req.body;
    
    const result = {
      success: true,
      message: 'Secret provided successfully',
      orderId,
      secretHash: `0x${Buffer.from(secret).toString('hex')}`,
      timestamp: new Date().toISOString()
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to provide secret' });
  }
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'Connected to Cross-Chain Relayer',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 WebSocket message:', data);
      
      ws.send(JSON.stringify({
        type: 'echo',
        data: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ Invalid WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
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
const PORT = 8081;
const server = app.listen(PORT, () => {
  console.log('');
  console.log('✅ Simple Cross-Chain Relayer running!');
  console.log('');
  console.log('🌐 Server Details:');
  console.log(`   HTTP API: http://localhost:${PORT}`);
  console.log('   WebSocket: ws://localhost:8081');
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/api/orders`);
  console.log(`   POST http://localhost:${PORT}/api/orders`);
  console.log(`   GET  http://localhost:${PORT}/api/quote`);
  console.log(`   POST http://localhost:${PORT}/api/provide-secret`);
  console.log('');
  console.log('🎯 Ready for cross-chain swaps!');
});

// Attach WebSocket to the HTTP server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down relayer gracefully...');
  process.exit(0);
}); 