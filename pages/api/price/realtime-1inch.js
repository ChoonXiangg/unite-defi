// Helper function to get token decimals
const getTokenDecimals = (tokenAddress) => {
  const tokenDecimals = {
    // Native tokens (18 decimals)
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 18, // ETH
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 18, // MATIC
    '0x85f138bfee4ef8e540890cfb48f620571d67eda3': 18, // AVAX
    '0xb8c77482e45f1f44de1745f52c74426c631bdd52': 18, // BNB
    // 6 decimal tokens
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,  // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,  // USDT
    // 8 decimal tokens
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8,  // WBTC
  };
  
  return tokenDecimals[tokenAddress.toLowerCase()] || 18; // Default to 18
};

// Helper function to get fallback prices
const getFallbackPrice = (fromToken) => {
  const fallbackPrices = {
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 2450, // ETH
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 45000, // WBTC
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1, // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 1, // USDT
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 0.8, // MATIC
    '0xb8c77482e45f1f44de1745f52c74426c631bdd52': 320, // BNB
    '0x85f138bfee4ef8e540890cfb48f620571d67eda3': 25, // AVAX
  };
  
  return fallbackPrices[fromToken.toLowerCase()] || 1;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    fromToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
    toToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',   // USDC
    chainId = 1 
  } = req.query;

  try {
    // Get token decimals for proper amount calculation
    const fromDecimals = getTokenDecimals(fromToken);
    const toDecimals = getTokenDecimals(toToken);
    
    // Set amount to 1 token in smallest unit (wei format)
    const amount = Math.pow(10, fromDecimals).toString();
    
    // Use 1inch API v5.0 quote endpoint
    const url = `https://api.1inch.io/v5.0/${chainId}/quote?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'User-Agent': 'Unite-DeFi/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract toTokenAmount and calculate price per 1 token
    const toTokenAmount = parseFloat(data.toTokenAmount);
    const price = toTokenAmount / Math.pow(10, toDecimals);
    
    res.status(200).json({
      success: true,
      price: price,
      rawToTokenAmount: data.toTokenAmount,
      fromToken,
      toToken,
      fromDecimals,
      toDecimals,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('1inch API error:', error);
    
    const fallbackPrice = getFallbackPrice(fromToken);
    
    res.status(200).json({
      success: false,
      price: fallbackPrice,
      error: error.message,
      usingFallback: true,
      fallbackMessage: 'Using fallback price - 1inch API unavailable',
      fromToken,
      toToken,
      timestamp: new Date().toISOString()
    });
  }
}