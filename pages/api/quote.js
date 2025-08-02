export default function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { fromToken, toToken, amount, chainId } = req.query;

  // Mock 1inch API response
  const mockQuote = {
    toTokenAmount: (parseFloat(amount) * 0.98).toFixed(18),
    estimatedGas: '50000',
    price: '0.98',
    fromToken,
    toToken,
    amount,
    chainId
  };

  res.status(200).json(mockQuote);
} 