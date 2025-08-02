import { coinGeckoRateLimiter } from '../../../utils/rateLimiter';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokens, chainId = 1 } = req.query;

  if (!tokens) {
    return res.status(400).json({ error: 'Tokens parameter is required' });
  }

  const tokenList = Array.isArray(tokens) ? tokens : tokens.split(',');

  try {
    // Wait for rate limiter slot before making API call
    await coinGeckoRateLimiter.waitForSlot();
    // Map token symbols to CoinGecko IDs
    const tokenMap = {
      'ETH': 'ethereum',
      'USDC': 'usd-coin', 
      'USDT': 'tether',
      'BTC': 'bitcoin',
      'BNB': 'binancecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'XTZ': 'tezos',
      'kUSD': 'kolibri-usd'
    };

    const coinIds = tokenList
      .map(token => tokenMap[token.toUpperCase()])
      .filter(id => id)
      .join(',');

    if (!coinIds) {
      throw new Error('No valid tokens found');
    }

    // CoinGecko API for real-time prices
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const prices = {};

    // Map prices back to token symbols
    for (const tokenSymbol of tokenList) {
      const coinId = tokenMap[tokenSymbol.toUpperCase()];
      if (coinId && data[coinId]) {
        prices[tokenSymbol.toUpperCase()] = data[coinId].usd;
      } else {
        prices[tokenSymbol.toUpperCase()] = getDefaultPrice(tokenSymbol);
      }
    }

    // Include rate limit status in response
    const rateLimitStatus = coinGeckoRateLimiter.getStatus();
    
    res.status(200).json({
      success: true,
      prices,
      chainId: parseInt(chainId),
      timestamp: Date.now(),
      source: 'coingecko',
      rateLimit: {
        remaining: rateLimitStatus.remainingCalls,
        total: rateLimitStatus.maxCalls,
        resetTime: rateLimitStatus.nextResetTime
      }
    });

  } catch (error) {
    console.error('Price fetch error:', error);
    
    // Fallback to default prices if API fails
    const fallbackPrices = {};
    tokenList.forEach(token => {
      fallbackPrices[token.toUpperCase()] = getDefaultPrice(token);
    });

    res.status(200).json({
      success: true,
      prices: fallbackPrices,
      chainId: parseInt(chainId),
      timestamp: Date.now(),
      fallback: true
    });
  }
}

function getDefaultPrice(tokenSymbol) {
  const defaultPrices = {
    ETH: 2450,
    USDC: 1,
    USDT: 1,
    BTC: 45000,
    XTZ: 1.2,
    kUSD: 1,
    BNB: 320,
    MATIC: 0.8,
    AVAX: 25
  };
  
  return defaultPrices[tokenSymbol.toUpperCase()] || 1;
}