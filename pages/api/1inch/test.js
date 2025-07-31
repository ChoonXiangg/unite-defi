// Test endpoint to debug 1inch API issues
export default async function handler(req, res) {
  try {
    console.log('Testing 1inch API...');
    
    // Test with a simple USDC to ETH swap
    const testParams = new URLSearchParams({
      src: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      amount: '10000000' // 10 USDC (6 decimals)
    });

    // Try different API versions and endpoints
    const endpointsToTest = [
      // New potential endpoints from 1inch docs
      `https://api.1inch.exchange/v5.0/42161/quote?${testParams}`,
      `https://api.1inch.dev/swap/v6.0/42161/quote?${testParams}`,
      `https://pathfinder.1inch.io/v1.2/chain/42161/router/v5/quotes?${testParams}`,
      
      // Alternative formats
      `https://api-v5.1inch.exchange/v5.0/42161/quote?${testParams}`,
      `https://pathfinder.1inch.exchange/v1.2/chain/42161/router/v5/quotes?${testParams}`,
      
      // CoinGecko alternative for pricing
      `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd`,
      
      // Uniswap V3 subgraph (alternative pricing source)
      `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum`
    ];

    const results = [];

    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'GaslessSwapStation/1.0'
          },
          timeout: 5000
        });

        const text = await response.text();
        
        results.push({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: text.substring(0, 500) // First 500 chars
        });

        if (response.ok) {
          console.log(`✅ SUCCESS: ${endpoint}`);
        } else {
          console.log(`❌ FAILED: ${endpoint} - ${response.status}`);
        }

      } catch (error) {
        results.push({
          endpoint,
          error: error.message
        });
        console.log(`❌ ERROR: ${endpoint} - ${error.message}`);
      }
    }

    res.status(200).json({
      message: '1inch API test results',
      testParams: Object.fromEntries(testParams),
      results
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message 
    });
  }
}