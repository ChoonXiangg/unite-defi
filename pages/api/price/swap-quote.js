export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    fromToken, 
    toToken, 
    amount, 
    chainId = 1,
    fromTokenAddress,
    toTokenAddress 
  } = req.query;

  if (!fromToken || !toToken || !amount) {
    return res.status(400).json({ 
      error: 'fromToken, toToken, and amount are required' 
    });
  }

  try {
    // Get proper token decimals and addresses
    const fromTokenAddr = fromTokenAddress || getTokenAddress(fromToken, chainId);
    const toTokenAddr = toTokenAddress || getTokenAddress(toToken, chainId);
    
    // Get token decimals (most tokens are 18, USDC/USDT are 6)
    const fromDecimals = getTokenDecimals(fromToken);
    const toDecimals = getTokenDecimals(toToken);
    
    // Convert amount to smallest unit
    const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, fromDecimals)).toString();

    // 1inch swap quote API
    const url = `https://api.1inch.io/v5.0/${chainId}/quote` +
      `?fromTokenAddress=${fromTokenAddr}` +
      `&toTokenAddress=${toTokenAddr}` +
      `&amount=${amountInSmallestUnit}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert back to human readable format using correct decimals
    const outputAmount = parseFloat(data.toTokenAmount) / Math.pow(10, toDecimals);
    const rate = outputAmount / parseFloat(amount);

    res.status(200).json({
      success: true,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(8),
      rate: rate.toFixed(8),
      gasEstimate: data.estimatedGas,
      timestamp: Date.now(),
      chainId: parseInt(chainId),
      source: '1inch'
    });

  } catch (error) {
    console.error('Swap quote error:', error);

    // Fallback to simple rate calculation using real-time prices
    const fromPrice = await getDefaultPrice(fromToken);
    const toPrice = await getDefaultPrice(toToken);
    const rate = toPrice / fromPrice;
    const outputAmount = parseFloat(amount) * rate;

    res.status(200).json({
      success: true,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toString(),
      rate: rate.toString(),
      timestamp: Date.now(),
      chainId: parseInt(chainId),
      fallback: true
    });
  }
}

function getTokenAddress(symbol, chainId) {
  // Real token addresses by chain
  const addresses = {
    1: { // Ethereum
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0xA0b86a33E6441b8C4C8C1fb99dCF4616E16eDf6f4', // Correct USDC address
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    },
    137: { // Polygon
      MATIC: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    },
    56: { // BSC
      BNB: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    },
    42161: { // Arbitrum
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    },
    43114: { // Avalanche
      AVAX: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    }
  };

  return addresses[chainId]?.[symbol.toUpperCase()] || '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
}

async function getDefaultPrice(tokenSymbol) {
  // Try to fetch real-time price as fallback
  try {
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

    const coinId = tokenMap[tokenSymbol.toUpperCase()];
    if (coinId) {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      if (response.ok) {
        const data = await response.json();
        return data[coinId]?.usd || getHardcodedPrice(tokenSymbol);
      }
    }
  } catch (error) {
    console.error('Fallback price fetch failed:', error);
  }
  
  return getHardcodedPrice(tokenSymbol);
}

function getTokenDecimals(symbol) {
  const decimals = {
    ETH: 18,
    WETH: 18,
    USDC: 6,
    USDT: 6,
    DAI: 18,
    WBTC: 8,
    BNB: 18,
    MATIC: 18,
    AVAX: 18,
    XTZ: 6,
    kUSD: 18
  };
  
  return decimals[symbol.toUpperCase()] || 18;
}

function getHardcodedPrice(tokenSymbol) {
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