// Generate realistic price history data without external API calls

const BASE_PRICES = {
  'ethereum': 2450,
  'bitcoin': 45000,
  'usd-coin': 1,
  'tether': 1,
  'matic-network': 0.8,
  'binancecoin': 320,
  'avalanche-2': 25,
  'chainlink': 12,
  'uniswap': 6,
  'dai': 1,
  'wrapped-bitcoin': 45000
};

/**
 * Generate realistic price movement using random walk
 * @param {number} basePrice - Starting price
 * @param {number} hours - Number of hours of data
 * @param {number} volatility - Price volatility (0.01 = 1%)
 * @returns {Array} Array of price points
 */
function generatePriceHistory(basePrice, hours = 24, volatility = 0.02, coinId = 'ethereum') {
  const pricePoints = [];
  let currentPrice = basePrice;
  
  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
    
    // Generate realistic price movement (random walk with mean reversion)
    const randomChange = (Math.random() - 0.5) * 2; // -1 to 1
    const meanReversion = (basePrice - currentPrice) / basePrice * 0.1; // Slight pull back to base
    const priceChange = (randomChange * volatility + meanReversion) * currentPrice;
    
    currentPrice = Math.max(currentPrice + priceChange, basePrice * 0.8); // Don't go below 80% of base
    currentPrice = Math.min(currentPrice, basePrice * 1.2); // Don't go above 120% of base
    
    pricePoints.push({
      timestamp: timestamp.toISOString(),
      time: timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      price: parseFloat(currentPrice.toFixed(coinId.includes('usd') || coinId.includes('dai') ? 4 : 2))
    });
  }
  
  return pricePoints;
}

/**
 * Get volatility based on token type
 * @param {string} coinId - Coin identifier
 * @returns {number} Volatility factor
 */
function getVolatility(coinId) {
  // Stablecoins have very low volatility
  if (coinId.includes('usd') || coinId.includes('dai') || coinId.includes('tether')) {
    return 0.001; // 0.1%
  }
  
  // Large cap tokens moderate volatility
  if (coinId.includes('bitcoin') || coinId.includes('ethereum')) {
    return 0.015; // 1.5%
  }
  
  // Altcoins higher volatility
  return 0.025; // 2.5%
}

/**
 * Add trending behavior based on overall market sentiment
 * @param {Array} pricePoints - Array of price points
 * @param {string} coinId - Coin identifier
 * @returns {Array} Modified price points
 */
function addMarketTrend(pricePoints, coinId) {
  // Simulate market trend (can be customized based on actual market conditions)
  const trendDirection = Math.random() > 0.5 ? 1 : -1; // Random trend for demo
  const trendStrength = 0.005; // 0.5% per hour
  
  return pricePoints.map((point, index) => {
    const trendMultiplier = 1 + (trendDirection * trendStrength * index * 0.1);
    return {
      ...point,
      price: parseFloat((point.price * trendMultiplier).toFixed(
        coinId.includes('usd') || coinId.includes('dai') ? 4 : 2
      ))
    };
  });
}

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
    const basePrice = BASE_PRICES[coinId] || 100;
    const hours = Math.min(parseInt(days) * 24, 168); // Max 7 days
    const volatility = getVolatility(coinId);
    
    // Generate base price history
    let chartData = generatePriceHistory(basePrice, hours, volatility, coinId);
    
    // Add market trend
    chartData = addMarketTrend(chartData, coinId);
    
    res.status(200).json({
      success: true,
      data: chartData,
      coinId,
      vsCurrency,
      days,
      dataPoints: chartData.length,
      lastUpdated: new Date().toISOString(),
      source: 'generated',
      note: 'Realistic price simulation - not real market data'
    });

  } catch (error) {
    console.error('Price history generation error:', error);
    
    // Fallback to simple flat data
    const fallbackData = Array.from({ length: 24 }, (_, i) => {
      const timestamp = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      return {
        timestamp: timestamp.toISOString(),
        time: timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        price: BASE_PRICES[coinId] || 100
      };
    });

    res.status(200).json({
      success: false,
      error: error.message,
      data: fallbackData,
      usingFallback: true,
      coinId,
      vsCurrency,
      days,
      dataPoints: fallbackData.length,
      lastUpdated: new Date().toISOString()
    });
  }
}