// Test endpoint to verify all 1inch API integrations are working correctly
// This endpoint tests the enhanced features without adding new functionality

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { testAddress } = req.query;
    
    // Use a default test address if none provided (Arbitrum One with known activity)
    const addressToTest = testAddress || '0x7184B01a8A9ac24428bB8d3925701D151920C9Ce';
    
    console.log('🧪 Testing all 1inch API integrations...');
    console.log('   Test address:', addressToTest);
    
    const apiKey = process.env.ONEINCH_API_KEY;
    const headers = {
      'Accept': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const testResults = {
      testAddress: addressToTest,
      apiKeyPresent: !!apiKey,
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    };

    // Test 1: Balance API
    console.log('🔍 Testing Balance API...');
    try {
      const balanceUrl = `https://api.1inch.dev/balance/v1.2/42161/balances/${addressToTest}`;
      const balanceResponse = await fetch(balanceUrl, { headers });
      
      testResults.tests.balanceApi = {
        name: 'Balance API',
        url: balanceUrl,
        status: balanceResponse.status,
        success: balanceResponse.ok,
        tokenCount: 0,
        responseTime: null
      };

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        testResults.tests.balanceApi.tokenCount = Object.keys(balanceData).length;
        testResults.tests.balanceApi.sampleTokens = Object.keys(balanceData).slice(0, 3);
        testResults.summary.passed++;
        console.log(`✅ Balance API: Found ${testResults.tests.balanceApi.tokenCount} tokens`);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`Balance API failed: ${balanceResponse.status}`);
        console.log(`❌ Balance API failed: ${balanceResponse.status}`);
      }
    } catch (error) {
      testResults.tests.balanceApi = { name: 'Balance API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Balance API error: ${error.message}`);
      console.log(`❌ Balance API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 2: Gas Price API
    console.log('💰 Testing Gas Price API...');
    try {
      const gasUrl = `https://api.1inch.dev/gas-price/v1.5/42161`;
      const gasResponse = await fetch(gasUrl, { headers });
      
      testResults.tests.gasPriceApi = {
        name: 'Gas Price API',
        url: gasUrl,
        status: gasResponse.status,
        success: gasResponse.ok
      };

      if (gasResponse.ok) {
        const gasData = await gasResponse.json();
        testResults.tests.gasPriceApi.gasData = gasData;
        testResults.summary.passed++;
        console.log(`✅ Gas Price API: Standard gas ${gasData.standard}, Fast gas ${gasData.fast}`);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`Gas Price API failed: ${gasResponse.status}`);
        console.log(`❌ Gas Price API failed: ${gasResponse.status}`);
      }
    } catch (error) {
      testResults.tests.gasPriceApi = { name: 'Gas Price API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Gas Price API error: ${error.message}`);
      console.log(`❌ Gas Price API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 3: Token API
    console.log('🪙 Testing Token API...');
    try {
      const contractAddress = '0x4a109A21EeD37d5D1AA0e8e2DE9e50005850eC6c'; // PGS token
      const tokenUrl = `https://api.1inch.dev/token/v1.2/42161/custom?addresses=${contractAddress}`;
      const tokenResponse = await fetch(tokenUrl, { headers });
      
      testResults.tests.tokenApi = {
        name: 'Token API',
        url: tokenUrl,
        status: tokenResponse.status,
        success: tokenResponse.ok,
        contractAddress: contractAddress
      };

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const pgsTokenData = tokenData[contractAddress.toLowerCase()];
        testResults.tests.tokenApi.tokenData = pgsTokenData;
        testResults.summary.passed++;
        console.log(`✅ Token API: Found PGS token data:`, pgsTokenData?.symbol);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`Token API failed: ${tokenResponse.status}`);
        console.log(`❌ Token API failed: ${tokenResponse.status}`);
      }
    } catch (error) {
      testResults.tests.tokenApi = { name: 'Token API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Token API error: ${error.message}`);
      console.log(`❌ Token API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 4: History API
    console.log('📜 Testing History API...');
    try {
      const historyUrl = `https://api.1inch.dev/history/v2.0/history/${addressToTest}/events?chainId=42161&limit=10`;
      const historyResponse = await fetch(historyUrl, { headers });
      
      testResults.tests.historyApi = {
        name: 'History API',
        url: historyUrl,
        status: historyResponse.status,
        success: historyResponse.ok
      };

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        testResults.tests.historyApi.transactionCount = historyData.items?.length || 0;
        testResults.tests.historyApi.sampleTransaction = historyData.items?.[0] || null;
        testResults.summary.passed++;
        console.log(`✅ History API: Found ${testResults.tests.historyApi.transactionCount} transactions`);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`History API failed: ${historyResponse.status}`);
        console.log(`❌ History API failed: ${historyResponse.status}`);
      }
    } catch (error) {
      testResults.tests.historyApi = { name: 'History API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`History API error: ${error.message}`);
      console.log(`❌ History API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 5: Traces API
    console.log('🔍 Testing Traces API...');
    try {
      const tracesUrl = `https://api.1inch.dev/traces/v1.0/chain/42161/address/${addressToTest}/trace`;
      const tracesResponse = await fetch(tracesUrl, { headers });
      
      testResults.tests.tracesApi = {
        name: 'Traces API',
        url: tracesUrl,
        status: tracesResponse.status,
        success: tracesResponse.ok
      };

      if (tracesResponse.ok) {
        const tracesData = await tracesResponse.json();
        testResults.tests.tracesApi.traceCount = tracesData.traces?.length || 0;
        testResults.summary.passed++;
        console.log(`✅ Traces API: Found ${testResults.tests.tracesApi.traceCount} traces`);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`Traces API failed: ${tracesResponse.status}`);
        console.log(`❌ Traces API failed: ${tracesResponse.status}`);
      }
    } catch (error) {
      testResults.tests.tracesApi = { name: 'Traces API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Traces API error: ${error.message}`);
      console.log(`❌ Traces API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 6: NFT API
    console.log('🖼️ Testing NFT API...');
    try {
      const nftUrl = `https://api.1inch.dev/nft/v1.0/byaddress?address=${addressToTest}&chainId=42161`;
      const nftResponse = await fetch(nftUrl, { headers });
      
      testResults.tests.nftApi = {
        name: 'NFT API',
        url: nftUrl,
        status: nftResponse.status,
        success: nftResponse.ok
      };

      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        testResults.tests.nftApi.nftCount = nftData.assets?.length || 0;
        testResults.tests.nftApi.sampleNFT = nftData.assets?.[0] || null;
        testResults.summary.passed++;
        console.log(`✅ NFT API: Found ${testResults.tests.nftApi.nftCount} NFTs`);
      } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`NFT API failed: ${nftResponse.status}`);
        console.log(`❌ NFT API failed: ${nftResponse.status}`);
      }
    } catch (error) {
      testResults.tests.nftApi = { name: 'NFT API', error: error.message, success: false };
      testResults.summary.failed++;
      testResults.summary.errors.push(`NFT API error: ${error.message}`);
      console.log(`❌ NFT API error:`, error.message);
    }
    testResults.summary.total++;

    // Test 7: Enhanced endpoints (our implementations)
    console.log('🚀 Testing enhanced endpoint integrations...');
    const enhancedTests = [];

    try {
      // Test enhanced balance endpoint
      const enhancedBalanceResponse = await fetch(`/api/get-balance?userAddress=${addressToTest}`, {
        method: 'GET'
      });
      enhancedTests.push({
        name: 'Enhanced Balance Endpoint',
        path: '/api/get-balance',
        success: enhancedBalanceResponse.ok,
        status: enhancedBalanceResponse.status
      });
    } catch (error) {
      enhancedTests.push({
        name: 'Enhanced Balance Endpoint',
        path: '/api/get-balance',
        success: false,
        error: error.message
      });
    }

    try {
      // Test enhanced history endpoint
      const enhancedHistoryResponse = await fetch(`/api/get-history?userAddress=${addressToTest}`, {
        method: 'GET'
      });
      enhancedTests.push({
        name: 'Enhanced History Endpoint',
        path: '/api/get-history',
        success: enhancedHistoryResponse.ok,
        status: enhancedHistoryResponse.status
      });
    } catch (error) {
      enhancedTests.push({
        name: 'Enhanced History Endpoint',
        path: '/api/get-history',
        success: false,
        error: error.message
      });
    }

    testResults.tests.enhancedEndpoints = enhancedTests;
    const enhancedPassed = enhancedTests.filter(t => t.success).length;
    testResults.summary.passed += enhancedPassed;
    testResults.summary.failed += (enhancedTests.length - enhancedPassed);
    testResults.summary.total += enhancedTests.length;

    // Calculate success rate
    testResults.summary.successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(2);

    console.log(`🎯 1inch API Integration Test Results:`);
    console.log(`   Total tests: ${testResults.summary.total}`);
    console.log(`   Passed: ${testResults.summary.passed}`);
    console.log(`   Failed: ${testResults.summary.failed}`);
    console.log(`   Success rate: ${testResults.summary.successRate}%`);

    return res.status(200).json({
      success: true,
      testResults
    });

  } catch (error) {
    console.error('❌ 1inch API integration test failed:', error);
    return res.status(500).json({
      error: '1inch API integration test failed',
      message: error.message
    });
  }
}