// Historical price data simulation using 1inch API
// Since 1inch doesn't provide historical data, we'll create a chart by sampling current prices
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

// Token addresses - reuse from the main 1inch API
const TOKEN_ADDRESSES = {
  1: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302'
  },
  42161: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'PGS': '0x4a109A21EeD37d5D1AA0e8e2DE9e50005850eC6c'
  },
  137: {
    'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  },
  56: {
    'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'USDT': '0x55d398326f99059fF775485246999027B3197955',
    'WETH': '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
  }
};

/**
 * Get current price from 1inch API (reuse logic from realtime-oneinch.js)
 */
async function getCurrentPrice(tokenSymbol, chainId = 1) {
  const cleanSymbol = tokenSymbol.replace(/_\d+$/, '');
  const upperSymbol = cleanSymbol.toUpperCase();
  
  const tokenAddresses = TOKEN_ADDRESSES[chainId] || TOKEN_ADDRESSES[1];
  const tokenAddress = tokenAddresses[upperSymbol];
  const usdcAddress = TOKEN_ADDRESSES[chainId]?.['USDC'] || TOKEN_ADDRESSES[1]['USDC'];

  if (!tokenAddress) {
    throw new Error(`Token ${upperSymbol} not supported on chain ${chainId}`);
  }

  // Handle stablecoins
  if (upperSymbol === 'USDC' || upperSymbol === 'USDT' || upperSymbol === 'DAI') {
    return 1.00;
  }

  // Use swap quote for other tokens
  let usdcAmount = 1000000; // 1 USDC
  if (upperSymbol === 'WBTC' || upperSymbol === 'BTC') {
    usdcAmount = 100000000; // 100 USDC for expensive tokens
  }

  const swapUrl = `${ONEINCH_BASE_URL}/swap/v6.0/${chainId}/quote?src=${usdcAddress}&dst=${tokenAddress}&amount=${usdcAmount}`;
  
  const response = await fetch(swapUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`1inch API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.dstAmount) {
    throw new Error('No dstAmount in 1inch response');
  }

  // Calculate price based on token decimals
  let decimals = 18;
  if (upperSymbol === 'WBTC' || upperSymbol === 'BTC') {
    decimals = 8;
  } else if (upperSymbol === 'USDC' || upperSymbol === 'USDT') {
    decimals = 6;
  }

  const tokensPerUSD = parseFloat(data.dstAmount) / Math.pow(10, decimals);
  const usdcUsed = usdcAmount / 1000000;
  const price = usdcUsed / tokensPerUSD;

  return price;
}

/**
 * Generate simulated historical chart data using current 1inch price with realistic variations
 */
function generateSimulatedChart(currentPrice, hours = 24, points = 48) {
  const prices = [];
  const now = new Date();
  
  // Handle $0 price - return flat $0 chart
  if (currentPrice === 0) {
    for (let i = 0; i < points; i++) {
      const hoursAgo = (hours * (points - 1 - i)) / (points - 1);
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      
      prices.push({
        time: timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        timestamp: timestamp.getTime(),
        price: 0
      });
    }
    return prices;
  }
  
  // Create realistic price variations (±2-5% from current price)
  const baseVolatility = 0.02; // 2% base volatility
  const extraVolatility = Math.random() * 0.03; // Up to 3% extra
  const totalVolatility = baseVolatility + extraVolatility;
  
  // Generate trend direction (slightly bearish, neutral, or bullish)
  const trendDirection = (Math.random() - 0.5) * 0.04; // ±2% trend over 24h
  
  for (let i = 0; i < points; i++) {
    const hoursAgo = (hours * (points - 1 - i)) / (points - 1);
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    // Create natural price movement
    const timeProgress = i / (points - 1); // 0 to 1
    const trendEffect = trendDirection * timeProgress;
    
    // Add some noise for realistic movement
    const noise = (Math.random() - 0.5) * totalVolatility;
    
    // Create some momentum (prices tend to continue in same direction)
    const momentum = i > 0 ? (prices[i-1].price / currentPrice - 1) * 0.3 : 0;
    
    const priceVariation = trendEffect + noise + momentum;
    const simulatedPrice = currentPrice * (1 + priceVariation);
    
    prices.push({
      time: timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      timestamp: timestamp.getTime(),
      price: Math.max(simulatedPrice, currentPrice * 0.85) // Prevent extreme drops
    });
  }
  
  return prices;
}

/**
 * Calculate 24h price change percentage
 */
function calculate24hChange(chartData) {
  if (chartData.length < 2) return 0;
  
  const oldestPrice = chartData[0].price;
  const currentPrice = chartData[chartData.length - 1].price;
  
  // Handle $0 prices
  if (oldestPrice === 0 && currentPrice === 0) return 0;
  if (oldestPrice === 0) return 0; // Prevent division by zero
  
  const change = ((currentPrice - oldestPrice) / oldestPrice) * 100;
  return parseFloat(change.toFixed(2));
}



export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenSymbol, chainId, days = 1 } = req.query;

  if (!tokenSymbol) {
    return res.status(400).json({ 
      error: 'tokenSymbol parameter is required',
      example: '/api/price/oneinch-historical?tokenSymbol=ETH&chainId=1&days=1'
    });
  }

  try {
    console.log(`📈 Generating 1inch-based historical data for ${tokenSymbol}...`);
    
    // Get current price from 1inch
    const currentPrice = await getCurrentPrice(tokenSymbol, chainId ? parseInt(chainId) : 1);
    
    // Generate simulated historical chart
    const hours = parseInt(days) * 24;
    const points = Math.min(hours * 2, 96); // Max 96 points for performance
    const chartData = generateSimulatedChart(currentPrice, hours, points);
    
    // Calculate 24h change
    const change24h = calculate24hChange(chartData);
    
    console.log(`✅ Generated ${chartData.length} price points for ${tokenSymbol} (24h change: ${change24h}%)`);
    
    res.status(200).json({
      success: true,
      data: chartData,
      currentPrice,
      change24h,
      symbol: tokenSymbol.toUpperCase(),
      chainId: chainId ? parseInt(chainId) : 1,
      timestamp: Date.now(),
      source: '1inch-simulated',
      disclaimer: 'Historical data simulated based on current 1inch price with realistic market variations'
    });

  } catch (error) {
    console.error('1inch historical data error:', error);
    
    // Special handling for PGS (custom token)
    const upperSymbol = tokenSymbol.toUpperCase();
    if (upperSymbol === 'PGS') {
      console.log(`💡 Generating simulated data for PGS custom token...`);
      
      // Generate simulated chart for PGS with $0 base price
      const currentPrice = 0;
      const hours = parseInt(days) * 24;
      const points = Math.min(hours * 2, 96);
      const chartData = generateSimulatedChart(currentPrice, hours, points);
      const change24h = calculate24hChange(chartData);
      
      return res.status(200).json({
        success: true,
        data: chartData,
        currentPrice,
        change24h,
        symbol: tokenSymbol.toUpperCase(),
        chainId: chainId ? parseInt(chainId) : 42161,
        timestamp: Date.now(),
        source: 'custom-token-simulated',
        disclaimer: 'PGS custom token data simulated with estimated price'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      symbol: tokenSymbol.toUpperCase(),
      chainId: chainId ? parseInt(chainId) : 1,
      timestamp: Date.now(),
      source: '1inch-error'
    });
  }
}