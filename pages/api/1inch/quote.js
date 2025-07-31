// API route to provide token swap quotes using CoinGecko (since 1inch APIs require auth)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { src, dst, amount } = req.query;

    if (!src || !dst || !amount) {
      return res.status(400).json({ error: 'Missing required parameters: src, dst, amount' });
    }

    console.log('Getting quote for:', { src, dst, amount });

    // Token mapping for CoinGecko IDs
    const tokenMapping = {
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { // USDC on Arbitrum
        id: 'usd-coin',
        decimals: 6,
        symbol: 'USDC'
      },
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': { // ETH
        id: 'ethereum',
        decimals: 18,
        symbol: 'ETH'
      },
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { // WETH on Arbitrum
        id: 'ethereum',
        decimals: 18,
        symbol: 'WETH'
      },
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { // WBTC on Arbitrum
        id: 'wrapped-bitcoin',
        decimals: 8,
        symbol: 'WBTC'
      }
    };

    const srcToken = tokenMapping[src.toLowerCase()];
    const dstToken = tokenMapping[dst.toLowerCase()];

    if (!srcToken || !dstToken) {
      return res.status(400).json({ 
        error: 'Unsupported token',
        supportedTokens: Object.keys(tokenMapping)
      });
    }

    // Get prices from CoinGecko
    const priceResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${srcToken.id},${dstToken.id}&vs_currencies=usd`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GaslessSwapStation/1.0'
        }
      }
    );

    if (!priceResponse.ok) {
      throw new Error(`CoinGecko API error: ${priceResponse.status}`);
    }

    const prices = await priceResponse.json();
    console.log('CoinGecko prices:', prices);

    const srcPriceUsd = prices[srcToken.id]?.usd;
    const dstPriceUsd = prices[dstToken.id]?.usd;

    if (!srcPriceUsd || !dstPriceUsd) {
      throw new Error('Price data not available');
    }

    // Calculate conversion
    const amountBN = BigInt(amount);
    const srcDecimals = BigInt(10 ** srcToken.decimals);
    const dstDecimals = BigInt(10 ** dstToken.decimals);

    // Convert input amount to USD value, then to destination token
    // srcAmount * srcPrice / dstPrice = dstAmount (in token units)
    const srcAmountFloat = Number(amountBN) / Number(srcDecimals);
    const usdValue = srcAmountFloat * srcPriceUsd;
    const dstAmountFloat = usdValue / dstPriceUsd;
    
    // Apply 0.5% slippage protection
    const slippageProtectedAmount = dstAmountFloat * 0.995;
    
    // Convert back to BigInt with proper decimals
    const toAmount = BigInt(Math.floor(slippageProtectedAmount * Number(dstDecimals)));

    console.log('Conversion calculation:', {
      srcAmountFloat,
      usdValue,
      dstAmountFloat,
      slippageProtectedAmount,
      toAmount: toAmount.toString()
    });

    // Return quote data in 1inch-compatible format
    res.status(200).json({
      success: true,
      fromAmount: amount,
      toAmount: toAmount.toString(),
      estimatedGas: '150000', // Estimated gas for DEX swap
      protocols: [{ name: 'CoinGecko Pricing' }],
      gasPrice: '100000000', // 0.1 gwei
      fromToken: {
        address: src,
        symbol: srcToken.symbol,
        decimals: srcToken.decimals
      },
      toToken: {
        address: dst,
        symbol: dstToken.symbol,
        decimals: dstToken.decimals
      },
      pricing: {
        srcPriceUsd,
        dstPriceUsd,
        usdValue,
        slippage: '0.5%'
      }
    });

  } catch (error) {
    console.error('Quote API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}