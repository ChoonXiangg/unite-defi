import { coinGeckoRateLimiter } from '../../../utils/rateLimiter';

// Helper function to generate fallback chart data
const generateFallbackData = (coinId, hours = 24) => {
  const basePrices = {
    'ethereum': 2450,
    'bitcoin': 45000,
    'usd-coin': 1,
    'tether': 1,
    'matic-network': 0.8,
    'binancecoin': 320,
    'avalanche-2': 25
  };
  
  const basePrice = basePrices[coinId] || 100;
  
  return Array.from({ length: hours }, (_, i) => {
    const timestamp = new Date(Date.now() - (hours - 1 - i) * 60 * 60 * 1000);
    // Add some realistic price variation (±2% random walk)
    const variation = (Math.random() - 0.5) * 0.04 * basePrice;
    const price = basePrice + variation;
    
    return {
      timestamp: timestamp.toISOString(),
      time: timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      price: parseFloat(price.toFixed(coinId.includes('usd') ? 4 : 2))
    };
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    coinId = 'ethereum',
    vsCurrency = 'usd',
    days = '1'
  } = req.query;

  try {
    // Wait for rate limiter slot before making API call
    await coinGeckoRateLimiter.waitForSlot();
    
    // CoinGecko API for historical price data
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=hourly`;
    
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
    
    // Check if we have price data
    if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
      throw new Error('No price data received from CoinGecko');
    }
    
    // Format the price data for charting
    const chartData = data.prices.map(([timestamp, price]) => ({
      timestamp: new Date(timestamp).toISOString(),
      time: new Date(timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      price: parseFloat(price.toFixed(coinId.includes('usd') ? 4 : 2))
    }));

    res.status(200).json({
      success: true,
      data: chartData,
      coinId,
      vsCurrency,
      days,
      dataPoints: chartData.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('CoinGecko API error:', error);
    
    // Generate fallback mock data
    const mockData = generateFallbackData(coinId, 24);

    res.status(200).json({
      success: false,
      error: error.message,
      data: mockData,
      usingFallback: true,
      fallbackMessage: 'Using mock chart data - CoinGecko API unavailable',
      coinId,
      vsCurrency,
      days,
      dataPoints: mockData.length,
      lastUpdated: new Date().toISOString()
    });
  }
}