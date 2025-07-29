export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromToken, toToken, amount, chainId = 1 } = req.query;

  if (!fromToken || !toToken || !amount) {
    return res.status(400).json({ 
      error: 'fromToken, toToken, and amount are required' 
    });
  }

  try {
    // Method 1: Use 1inch API v6 (latest)
    const apiKey = process.env.ONEINCH_API_KEY; // You'd need to get this from 1inch
    
    const headers = apiKey ? {
      'Authorization': `Bearer ${apiKey}`,
      'accept': 'application/json'
    } : {
      'accept': 'application/json'
    };

    // Get token addresses
    const fromTokenAddr = getTokenAddress(fromToken, chainId);
    const toTokenAddr = getTokenAddress(toToken, chainId);
    
    // Convert amount to smallest unit
    const decimals = getTokenDecimals(fromToken);
    const amountWei = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();

    // 1inch API v6 endpoints
    const quoteUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/quote` +
      `?src=${fromTokenAddr}&dst=${toTokenAddr}&amount=${amountWei}`;

    const response = await fetch(quoteUrl, { headers });

    if (response.ok) {
      const data = await response.json();
      
      const toDecimals = getTokenDecimals(toToken);
      const outputAmount = parseFloat(data.dstAmount) / Math.pow(10, toDecimals);
      
      return res.status(200).json({
        success: true,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: outputAmount.toString(),
        rate: (outputAmount / parseFloat(amount)).toString(),
        gasEstimate: data.gas,
        protocols: data.protocols,
        source: '1inch-v6',
        timestamp: Date.now()
      });
    }

    // Method 2: Scrape 1inch dapp data (less reliable but no API key needed)
    const dappData = await scrape1inchDapp(fromToken, toToken, amount, chainId);
    if (dappData) {
      return res.status(200).json({
        success: true,
        ...dappData,
        source: '1inch-dapp',
        timestamp: Date.now()
      });
    }

    throw new Error('All 1inch methods failed');

  } catch (error) {
    console.error('1inch direct fetch error:', error);
    
    // Fallback to our existing method
    return res.status(200).json({
      success: false,
      error: error.message,
      fallback: true
    });
  }
}

// Method 2: Web scraping approach (use carefully - may break if UI changes)
async function scrape1inchDapp(fromToken, toToken, amount, chainId) {
  try {
    // This would require a headless browser like Puppeteer
    // Since we can't install it here, this is pseudocode:
    
    /*
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Navigate to 1inch dapp
    await page.goto(`https://app.1inch.io/#/${chainId}/simple/swap/${fromToken}/${toToken}`);
    
    // Fill in amount
    await page.type('input[data-testid="token-amount-input"]', amount);
    
    // Wait for quote to load
    await page.waitForSelector('[data-testid="best-return-amount"]');
    
    // Extract data
    const quoteData = await page.evaluate(() => {
      const outputAmount = document.querySelector('[data-testid="best-return-amount"]')?.textContent;
      const gasEstimate = document.querySelector('[data-testid="gas-estimate"]')?.textContent;
      const rate = document.querySelector('[data-testid="exchange-rate"]')?.textContent;
      
      return { outputAmount, gasEstimate, rate };
    });
    
    await browser.close();
    return quoteData;
    */
    
    return null; // Puppeteer not available in this environment
  } catch (error) {
    console.error('1inch dapp scraping failed:', error);
    return null;
  }
}

// Method 3: Use 1inch GraphQL endpoint
async function fetch1inchGraphQL(fromToken, toToken, amount, chainId) {
  try {
    const query = `
      query GetSwapQuote($chainId: Int!, $fromToken: String!, $toToken: String!, $amount: String!) {
        swapQuote(chainId: $chainId, fromToken: $fromToken, toToken: $toToken, amount: $amount) {
          fromAmount
          toAmount
          gasEstimate
          protocols {
            name
            part
          }
        }
      }
    `;

    const response = await fetch('https://api.1inch.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { chainId, fromToken, toToken, amount }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.swapQuote;
    }
  } catch (error) {
    console.error('1inch GraphQL failed:', error);
  }
  return null;
}

function getTokenAddress(symbol, chainId) {
  const addresses = {
    1: {
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    }
  };
  return addresses[chainId]?.[symbol.toUpperCase()] || '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
}

function getTokenDecimals(symbol) {
  const decimals = {
    ETH: 18, USDC: 6, USDT: 6, DAI: 18, WBTC: 8
  };
  return decimals[symbol.toUpperCase()] || 18;
}