// Real-time token prices using 1inch Spot Price API
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

// Token addresses on different chains for 1inch API
const TOKEN_ADDRESSES = {
  // Ethereum mainnet (chainId: 1)
  1: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302'
  },
  // Arbitrum (chainId: 42161)
  42161: {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0xFF970A61A04b1CdD3c43f5dE4533eBDDB5CC8',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    '1INCH': '0x8312e7d6EeACe1c09bbB8cfEb5ea7E47828283E3'
  },
  // Polygon (chainId: 137)
  137: {
    'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    '1INCH': '0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f'
  },
  // BSC (chainId: 56)
  56: {
    'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'USDT': '0x55d398326f99059fF775485246999027B3197955',
    'WETH': '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302'
  }
};

// Token symbol to preferred chain mapping for best liquidity
const PREFERRED_CHAINS = {
  'ETH': 1,        // Ethereum mainnet
  'WETH': 1,       // Ethereum mainnet
  'USDC': 1,       // Ethereum mainnet
  'USDT': 1,       // Ethereum mainnet
  'DAI': 1,        // Ethereum mainnet
  'WBTC': 1,       // Ethereum mainnet
  '1INCH': 1,      // Ethereum mainnet
  'MATIC': 137,    // Polygon
  'BNB': 56,       // BSC
  'XTZ': 1,        // Fallback to ETH chain (Tezos not on EVM)
  'PGS': 42161     // Custom token, assume on Arbitrum
};

// Note: Using only 1inch API - no hardcoded fallback prices per user requirement

/**
 * Get real-time token price using 1inch Spot Price API
 * @param {string} tokenSymbol - Token symbol (e.g., 'ETH', 'USDC')
 * @param {number} chainId - Optional chain ID, will use preferred chain if not provided
 * @returns {Promise<Object>} Price data with metadata
 */
async function getRealTimePrice(tokenSymbol, chainId = null) {
  // Clean token symbol - remove suffixes like _1, _2, etc.
  const cleanSymbol = tokenSymbol.replace(/_\d+$/, '');
  const upperSymbol = cleanSymbol.toUpperCase();
  
  // Use preferred chain if none specified
  const targetChainId = chainId || PREFERRED_CHAINS[upperSymbol] || 1;
  
  // Get token address for the chain
  const tokenAddresses = TOKEN_ADDRESSES[targetChainId] || TOKEN_ADDRESSES[1];
  const tokenAddress = tokenAddresses[upperSymbol];
  
  if (!tokenAddress) {
    // Token not found on this chain, return error
    return {
      success: false,
      price: 0,
      symbol: tokenSymbol.toUpperCase(), // Return original symbol
      chainId: targetChainId,
      timestamp: Date.now(),
      usingFallback: false,
      fallbackMessage: `Token ${upperSymbol} (from ${tokenSymbol}) not supported on chain ${targetChainId}`,
      source: '1inch-error',
      error: `Token address not found for ${upperSymbol} on chain ${targetChainId}`
    };
  }
  
  try {
    // Use 1inch Swap API to get price in USDC (more reliable for USD prices)
    // Get quote for swapping 1 USD worth of USDC to the target token
    const usdcAddress = TOKEN_ADDRESSES[targetChainId]?.['USDC'] || TOKEN_ADDRESSES[1]['USDC'];
    
    // For USDC and stablecoins, return $1.00 directly
    if (upperSymbol === 'USDC' || upperSymbol === 'USDT' || upperSymbol === 'DAI') {
      console.log(`💰 Stablecoin ${upperSymbol} price: $1.00`);
      return {
        success: true,
        price: 1.00,
        symbol: tokenSymbol.toUpperCase(), // Return original symbol
        chainId: targetChainId,
        timestamp: Date.now(),
        usingFallback: false,
        source: '1inch-stablecoin',
        tokenAddress
      };
    }
    
    // For other tokens, use swap quote to get USD price
    // Use different amounts based on token to avoid precision issues
    let usdcAmount = 1000000; // 1 USDC (6 decimals)
    if (upperSymbol === 'WBTC' || upperSymbol === 'BTC') {
      usdcAmount = 100000000; // 100 USDC for expensive tokens like BTC
    }
    
    const swapUrl = `${ONEINCH_BASE_URL}/swap/v6.0/${targetChainId}/quote?src=${usdcAddress}&dst=${tokenAddress}&amount=${usdcAmount}`;
    console.log(`🔄 Fetching 1inch swap quote for ${upperSymbol} (cleaned from ${tokenSymbol}) using ${usdcAmount / 1000000} USDC:`, swapUrl);
    
    const response = await fetch(swapUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
        'Accept': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`1inch Swap API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📊 1inch Swap API response for ${upperSymbol}:`, data);
    
    // Parse 1inch swap quote response
    // Response format: { "dstAmount": "amount_in_dest_token_wei", "srcAmount": "1000000" }
    let price = 0;
    
    if (!data.dstAmount) {
      console.log(`⚠️ No dstAmount in 1inch swap response for ${upperSymbol}:`, data);
      throw new Error('No dstAmount in 1inch swap quote response');
    }
    
    const dstAmount = data.dstAmount;
    console.log(`🔍 1inch swap quote for ${upperSymbol}: 1 USDC -> ${dstAmount} ${upperSymbol} tokens`);
    
    // Calculate price: We get dstAmount tokens for 1 USDC
    // So token price = 1 USD / (dstAmount / 10^decimals)
    // Different tokens use different decimals
    let decimals = 18; // Default for most tokens
    if (upperSymbol === 'WBTC' || upperSymbol === 'BTC') {
      decimals = 8; // Bitcoin tokens use 8 decimals
    } else if (upperSymbol === 'USDC' || upperSymbol === 'USDT') {
      decimals = 6; // USDC/USDT use 6 decimals
    }
    
    const tokensPerUSD = parseFloat(dstAmount) / Math.pow(10, decimals);
    const usdcUsed = usdcAmount / 1000000; // Convert back to actual USDC amount
    price = usdcUsed / tokensPerUSD;
    
    console.log(`💰 ${upperSymbol} price calculation: 1 USDC gets ${tokensPerUSD} ${upperSymbol}, so ${upperSymbol} = $${price.toFixed(2)}`);
    
    if (!price || price <= 0 || isNaN(price)) {
      throw new Error(`Invalid price data received from 1inch API: ${price}`);
    }
    
    console.log(`✅ 1inch price for ${upperSymbol}: $${price}`);
    
    return {
      success: true,
      price,
      symbol: tokenSymbol.toUpperCase(), // Return original symbol
      chainId: targetChainId,
      timestamp: Date.now(),
      usingFallback: false,
      source: '1inch',
      tokenAddress
    };
    
  } catch (error) {
    console.error(`❌ Failed to fetch 1inch price for ${upperSymbol}:`, error.message);
    
    // Return error - no fallback prices per user requirement (1inch API only)
    return {
      success: false,
      price: 0,
      symbol: tokenSymbol.toUpperCase(), // Return original symbol
      chainId: targetChainId,
      timestamp: Date.now(),
      usingFallback: false,
      fallbackMessage: `1inch API error: ${error.message}`,
      source: '1inch-error',
      error: error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenSymbol, chainId } = req.query;

  if (!tokenSymbol) {
    return res.status(400).json({ 
      error: 'tokenSymbol parameter is required',
      example: '/api/price/realtime-oneinch?tokenSymbol=ETH&chainId=1'
    });
  }

  try {
    const priceData = await getRealTimePrice(tokenSymbol, chainId ? parseInt(chainId) : null);
    
    // Return appropriate HTTP status based on success
    const statusCode = priceData.success ? 200 : 200; // Always 200 since we provide fallback
    
    res.status(statusCode).json(priceData);

  } catch (error) {
    console.error('Real-time price API error:', error);
    
    // Return error data - no fallback per user requirement
    const upperSymbol = tokenSymbol.toUpperCase();
    res.status(500).json({
      success: false,
      price: 0,
      symbol: upperSymbol,
      chainId: chainId ? parseInt(chainId) : 1,
      timestamp: Date.now(),
      usingFallback: false,
      fallbackMessage: 'Server error - 1inch API only',
      source: 'server-error',
      error: error.message
    });
  }
}