// In-memory storage for orders (in production, this would be a database)
let orders = [];

// Add some sample orders for testing
if (orders.length === 0) {
  orders.push({
    id: 'sample_order_1',
    maker: '0x5e8c9f71b484f082df54bd6473dfbf74abba266d',
    fromToken: '0x0000000000000000000000000000000000000000',
    toToken: '0x0000000000000000000000000000000000000000',
    fromAmount: '1000000000000000000', // 1 ETH
    toAmount: '2000000000000000000', // 2 XTZ
    fromChain: 'ethereum',
    toChain: 'etherlink',
    status: 'pending',
    createdAt: new Date().toISOString(),
    nonce: Date.now(),
    deadline: Math.floor(Date.now() / 1000) + 3600
  });
}

export default function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'POST') {
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
      
      console.log('📝 New order submitted:', newOrder);
      console.log('📊 Total orders:', orders.length);
      
      res.status(200).json({ 
        orderId,
        message: 'Order submitted successfully',
        order: newOrder
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit order' });
    }
  } else if (req.method === 'GET') {
    const { user } = req.query;
    
    console.log('📋 Fetching orders, user filter:', user);
    console.log('📊 Total orders in memory:', orders.length);
    
    if (user) {
      // Filter orders by user address for ProcessPage
      const userOrders = orders.filter(order => 
        order.maker.toLowerCase() === user.toLowerCase()
      );
      console.log('👤 User orders found:', userOrders.length);
      res.status(200).json({ orders: userOrders });
    } else {
      // Return all orders for the orderbook page
      console.log('📋 All orders returned:', orders.length);
      res.status(200).json({ orders: orders });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 