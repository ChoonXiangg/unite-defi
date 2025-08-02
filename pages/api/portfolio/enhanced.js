// Enhanced portfolio API using comprehensive 1inch API integration
// This endpoint provides detailed portfolio information without adding new functionality

// Utility function to throttle requests (10 req/sec = 100ms between requests)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const THROTTLE_DELAY = 120; // 120ms = ~8 req/sec to be safe

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress parameter required' });
    }

    const apiKey = process.env.ONEINCH_API_KEY;
    console.log('📊 Getting enhanced portfolio data via 1inch APIs...');
    console.log('   Wallet:', walletAddress);
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');

    const headers = {
      'Accept': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Chain configurations for multi-chain support
    const supportedChains = [
      { id: 1, name: 'Ethereum' },
      { id: 56, name: 'BSC' },
      { id: 137, name: 'Polygon' },
      { id: 42161, name: 'Arbitrum One' }
    ];

    const portfolioData = {
      walletAddress,
      chains: {},
      summary: {
        totalChains: 0,
        totalTokens: 0,
        networksWithBalance: 0,
        lastUpdated: new Date().toISOString()
      },
      gasContext: {},
      metadata: {
        sources: ['1inch_balance_api', '1inch_gas_api', '1inch_token_api'],
        apiVersion: 'enhanced_v1.0'
      }
    };

    // 🆕 Get gas prices for all supported chains sequentially to respect rate limits
    console.log('💰 Fetching gas prices for all chains (throttled)...');
    const gasResults = [];
    
    for (const chain of supportedChains) {
      try {
        console.log(`   Fetching gas for ${chain.name}...`);
        const gasResponse = await fetch(`https://api.1inch.dev/gas-price/v1.5/${chain.id}`, { headers });
        if (gasResponse.ok) {
          const gasData = await gasResponse.json();
          gasResults.push({ status: 'fulfilled', value: { chainId: chain.id, chainName: chain.name, gasData } });
        } else {
          console.warn(`Gas API failed for ${chain.name}: ${gasResponse.status}`);
          gasResults.push({ status: 'rejected', reason: `HTTP ${gasResponse.status}` });
        }
      } catch (error) {
        console.warn(`Gas API failed for ${chain.name}:`, error.message);
        gasResults.push({ status: 'rejected', reason: error.message });
      }
      
      // Throttle requests to stay under 10 req/sec
      if (chain !== supportedChains[supportedChains.length - 1]) {
        await sleep(THROTTLE_DELAY);
      }
    }
    gasResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        // Normalize gas data to prevent React rendering errors
        const normalizedGasData = {};
        const gasData = result.value.gasData;
        
        if (gasData) {
          normalizedGasData.standard = typeof gasData.standard === 'object' ? 
            (gasData.standard.maxFeePerGas || gasData.standard.gasPrice || gasData.standard) : 
            gasData.standard;
          normalizedGasData.fast = typeof gasData.fast === 'object' ? 
            (gasData.fast.maxFeePerGas || gasData.fast.gasPrice || gasData.fast) : 
            gasData.fast;
          normalizedGasData.instant = typeof gasData.instant === 'object' ? 
            (gasData.instant.maxFeePerGas || gasData.instant.gasPrice || gasData.instant) : 
            gasData.instant;
        }
        
        portfolioData.gasContext[result.value.chainId] = {
          chainName: result.value.chainName,
          ...normalizedGasData
        };
      }
    });

    // 🆕 Enhanced balance checking with token metadata for each chain (throttled)
    console.log('🔍 Fetching enhanced balance data for all chains (throttled)...');
    for (const [index, chain] of supportedChains.entries()) {
      try {
        console.log(`   Checking ${chain.name} (${chain.id})...`);

        // Add throttle delay before each balance request (except first)
        if (index > 0) {
          await sleep(THROTTLE_DELAY);
        }

        // Get balances using 1inch Balance API
        const balanceResponse = await fetch(
          `https://api.1inch.dev/balance/v1.2/${chain.id}/balances/${walletAddress}`, 
          { headers }
        );

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          const tokenCount = Object.keys(balanceData).length;
          
          if (tokenCount > 0) {
            console.log(`   ✅ Found ${tokenCount} tokens on ${chain.name}`);
            console.log(`   📊 Sample tokens:`, Object.keys(balanceData).slice(0, 3));
            console.log(`   📊 Sample balances:`, Object.values(balanceData).slice(0, 3));
            
            // Check if any balances are actually non-zero
            const nonZeroBalances = Object.values(balanceData).filter(balance => balance && balance !== '0');
            console.log(`   📊 Non-zero balances: ${nonZeroBalances.length}/${tokenCount}`);
            
            if (nonZeroBalances.length > 0) {
              console.log(`   📊 Sample non-zero balances:`, nonZeroBalances.slice(0, 3));
              portfolioData.summary.networksWithBalance++;
            } else {
              console.log(`   ⚠️ All balances are zero on ${chain.name}`);
            }

            // Only process metadata for chains with actual token balances
            if (nonZeroBalances.length > 0) {
              // 🆕 Get token metadata for tokens with non-zero balances (throttled)
              const nonZeroTokens = Object.entries(balanceData)
                .filter(([addr, balance]) => balance && balance !== '0')
                .slice(0, 10); // Limit to 10 most important tokens
              
              console.log(`   📊 Getting metadata for ${nonZeroTokens.length} tokens with balances...`);
              const tokenMetadataResults = [];
            
            for (const [tokenAddress, balance] of nonZeroTokens) {
              try {
                await sleep(THROTTLE_DELAY); // Throttle each metadata request
                const tokenResponse = await fetch(
                  `https://api.1inch.dev/token/v1.2/${chain.id}/custom?addresses=${tokenAddress}`,
                  { headers }
                );
                if (tokenResponse.ok) {
                  const tokenData = await tokenResponse.json();
                  tokenMetadataResults.push({ 
                    status: 'fulfilled', 
                    value: { address: tokenAddress, metadata: tokenData[tokenAddress.toLowerCase()] }
                  });
                } else {
                  console.warn(`Token metadata failed for ${tokenAddress}: ${tokenResponse.status}`);
                  tokenMetadataResults.push({ 
                    status: 'fulfilled', 
                    value: { address: tokenAddress, metadata: null }
                  });
                }
              } catch (error) {
                console.warn(`Token metadata failed for ${tokenAddress}:`, error.message);
                tokenMetadataResults.push({ 
                  status: 'fulfilled', 
                  value: { address: tokenAddress, metadata: null }
                });
              }
            }
            
            // Build enhanced token list (focus on tokens with non-zero balances)
            const enhancedTokens = nonZeroTokens.map(([tokenAddress, balance]) => {
              const metadataResult = tokenMetadataResults.find(
                result => result.status === 'fulfilled' && result.value.address === tokenAddress
              );
              
              const metadata = metadataResult?.value?.metadata || null;
              
              // Calculate formatted balance
              let formattedBalance = '0';
              let numericBalance = 0;
              
              if (balance && balance !== '0') {
                if (metadata?.decimals) {
                  numericBalance = parseFloat(balance) / Math.pow(10, metadata.decimals);
                  formattedBalance = numericBalance.toFixed(6);
                } else {
                  // If no decimals info, try to display raw balance
                  numericBalance = parseFloat(balance);
                  formattedBalance = numericBalance > 0 ? balance : '0';
                }
              }
              
              return {
                address: tokenAddress,
                balance: balance,
                formattedBalance: formattedBalance,
                numericBalance: numericBalance,
                metadata: metadata ? {
                  name: metadata.name,
                  symbol: metadata.symbol,
                  decimals: metadata.decimals,
                  logoURI: metadata.logoURI
                } : null,
                source: '1inch_enhanced_api'
              };
            }); // No additional filtering needed since we already selected non-zero tokens

            console.log(`   📋 Final enhanced tokens count: ${enhancedTokens.length}`);
            if (enhancedTokens.length > 0) {
              console.log(`   📋 Sample enhanced tokens:`, enhancedTokens.slice(0, 2).map(t => ({
                symbol: t.metadata?.symbol,
                formatted: t.formattedBalance,
                numeric: t.numericBalance
              })));
            }

              portfolioData.chains[chain.id] = {
                chainName: chain.name,
                tokenCount: enhancedTokens.length,
                tokens: enhancedTokens,
                gasInfo: portfolioData.gasContext[chain.id] || null,
                lastUpdated: new Date().toISOString()
              };

              portfolioData.summary.totalTokens += enhancedTokens.length;
            } else {
              // No tokens with balances, create empty chain entry
              console.log(`   📋 No tokens with balances on ${chain.name}`);
              portfolioData.chains[chain.id] = {
                chainName: chain.name,
                tokenCount: 0,
                tokens: [],
                gasInfo: portfolioData.gasContext[chain.id] || null,
                lastUpdated: new Date().toISOString()
              };
            }
          } else {
            console.log(`   ⚪ No tokens found on ${chain.name}`);
            portfolioData.chains[chain.id] = {
              chainName: chain.name,
              tokenCount: 0,
              tokens: [],
              gasInfo: portfolioData.gasContext[chain.id] || null,
              lastUpdated: new Date().toISOString()
            };
          }
        } else {
          console.warn(`Balance API failed for ${chain.name}:`, balanceResponse.status);
          portfolioData.chains[chain.id] = {
            chainName: chain.name,
            error: `API failed: ${balanceResponse.status}`,
            gasInfo: portfolioData.gasContext[chain.id] || null
          };
        }
      } catch (error) {
        console.error(`Error processing ${chain.name}:`, error.message);
        portfolioData.chains[chain.id] = {
          chainName: chain.name,
          error: error.message,
          gasInfo: portfolioData.gasContext[chain.id] || null
        };
      }
    }

    portfolioData.summary.totalChains = supportedChains.length;

    // 🆕 Add performance metrics
    portfolioData.performance = {
      apiCalls: supportedChains.length * 2, // Balance + Gas APIs per chain
      successfulChains: Object.values(portfolioData.chains).filter(chain => !chain.error).length,
      gasDataAvailable: Object.keys(portfolioData.gasContext).length,
      enhancementLevel: 'comprehensive_1inch_integration'
    };

    console.log(`✅ Enhanced portfolio analysis complete:`);
    console.log(`   Total chains: ${portfolioData.summary.totalChains}`);
    console.log(`   Chains with balance: ${portfolioData.summary.networksWithBalance}`);
    console.log(`   Total tokens: ${portfolioData.summary.totalTokens}`);
    console.log(`   Gas data for: ${Object.keys(portfolioData.gasContext).length} chains`);

    return res.status(200).json({
      success: true,
      data: portfolioData
    });

  } catch (error) {
    console.error('❌ Enhanced portfolio API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch enhanced portfolio data',
      message: error.message
    });
  }
}