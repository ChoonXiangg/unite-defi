// 1inch API for token prices
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

// Token addresses on different chains for 1inch API
const TOKEN_ADDRESSES = {
  // Ethereum mainnet (chainId: 1)
  1: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  // Arbitrum (chainId: 42161)
  42161: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  // Polygon (chainId: 137)
  137: {
    'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  }
};

// Fallback prices if 1inch API fails
const FALLBACK_PRICES = {
  'ETH': 2450,
  'USDC': 1,
  'USDT': 1,
  'BTC': 45000,
  'WBTC': 45000,
  'DAI': 1,
  'WETH': 2450,
  'MATIC': 0.8,
  'BNB': 320,
  'AVAX': 25,
  'XTZ': 1.2,
  'kUSD': 1
};

/**
 * Get token price using 1inch spot price API
 * @param {string} tokenAddress - Token contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<number>} Token price in USD
 */
async function getTokenPrice(tokenAddress, chainId = 1) {
  try {
    const url = `${ONEINCH_BASE_URL}/price/v1.1/${chainId}/${tokenAddress}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.price) || 0;
  } catch (error) {
    console.error(`Failed to fetch price for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Get multiple token prices using 1inch
 * @param {string[]} tokens - Array of token symbols
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} Prices object
 */
async function getMultipleTokenPrices(tokens, chainId = 1) {
  const prices = {};
  const tokenAddresses = TOKEN_ADDRESSES[chainId] || TOKEN_ADDRESSES[1];
  
  // Process tokens in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (token) => {
      const upperToken = token.toUpperCase();
      const address = tokenAddresses[upperToken];
      
      if (!address) {
        return { token: upperToken, price: FALLBACK_PRICES[upperToken] || 1 };
      }
      
      const price = await getTokenPrice(address, chainId);
      return {
        token: upperToken,
        price: price !== null ? price : FALLBACK_PRICES[upperToken] || 1
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ token, price }) => {
      prices[token] = price;
    });
    
    // Small delay between batches to be respectful to the API
    if (i + batchSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return prices;
}

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
    const prices = await getMultipleTokenPrices(tokenList, parseInt(chainId));

    res.status(200).json({
      success: true,
      prices,
      chainId: parseInt(chainId),
      timestamp: Date.now(),
      source: '1inch'
    });

  } catch (error) {
    console.error('1inch price fetch error:', error);
    
    // Fallback to default prices if API fails
    const fallbackPrices = {};
    tokenList.forEach(token => {
      fallbackPrices[token.toUpperCase()] = FALLBACK_PRICES[token.toUpperCase()] || 1;
    });

    res.status(200).json({
      success: true,
      prices: fallbackPrices,
      chainId: parseInt(chainId),
      timestamp: Date.now(),
      fallback: true,
      source: 'fallback'
    });
  }
}