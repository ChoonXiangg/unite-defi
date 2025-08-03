// Debug endpoint to test token price fetching
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenSymbol } = req.query;
  const symbol = tokenSymbol || 'WETH';

  try {
    console.log(`🔍 Testing price fetch for ${symbol}...`);
    
    // Test the 1inch API call
    const response = await fetch(`http://localhost:3002/api/price/realtime-oneinch?tokenSymbol=${symbol}`);
    const data = await response.json();
    
    console.log(`📊 Response:`, data);
    
    // Simulate balance calculation
    const testBalance = 0.5; // 0.5 tokens
    const testValue = testBalance * (data.price || 0);
    
    res.status(200).json({
      symbol,
      apiResponse: data,
      testBalance,
      testValue,
      debug: {
        apiSuccess: data.success,
        price: data.price,
        calculation: `${testBalance} × ${data.price} = ${testValue}`
      }
    });

  } catch (error) {
    console.error('Debug test error:', error);
    res.status(500).json({
      error: error.message,
      symbol
    });
  }
}