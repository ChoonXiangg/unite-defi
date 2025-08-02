import { coinGeckoRateLimiter } from '../../../utils/rateLimiter';

// Helper function to get fallback prices by CoinGecko ID
const getFallbackPrice = (coinId) => {
  const fallbackPrices = {
    'ethereum': 2450,
    'bitcoin': 45000,
    'usd-coin': 1,
    'tether': 1,
    'matic-network': 0.8,
    'binancecoin': 320,
    'avalanche-2': 25,
    'chainlink': 12,
    'uniswap': 6,
    'dai': 1
  };
  
  return fallbackPrices[coinId] || 100;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    coinId = 'ethereum'
  } = req.query;

  try {
    // Wait for rate limiter slot before making API call
    await coinGeckoRateLimiter.waitForSlot();
    
    // CoinGecko Simple Price API
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || ''
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if we got price data for the requested coin
    if (!data[coinId] || typeof data[coinId].usd !== 'number') {
      throw new Error(`No price data available for ${coinId}`);
    }
    
    const price = data[coinId].usd;
    
    res.status(200).json({
      success: true,
      price: price,
      coinId: coinId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('CoinGecko API error:', error);
    
    const fallbackPrice = getFallbackPrice(coinId);
    
    res.status(200).json({
      success: false,
      price: fallbackPrice,
      error: error.message,
      usingFallback: true,
      fallbackMessage: 'Using fallback price - CoinGecko API unavailable',
      coinId: coinId,
      timestamp: new Date().toISOString()
    });
  }
}