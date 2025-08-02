// Enhanced portfolio API using comprehensive 1inch API integration
// This endpoint provides detailed portfolio information without adding new functionality

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

    // 🆕 Get gas prices for all supported chains in parallel
    console.log('💰 Fetching gas prices for all chains...');
    const gasPromises = supportedChains.map(async (chain) => {
      try {
        const gasResponse = await fetch(`https://api.1inch.dev/gas-price/v1.5/${chain.id}`, { headers });
        if (gasResponse.ok) {
          const gasData = await gasResponse.json();
          return { chainId: chain.id, chainName: chain.name, gasData };
        }
      } catch (error) {
        console.warn(`Gas API failed for ${chain.name}:`, error.message);
      }
      return null;
    });

    const gasResults = await Promise.allSettled(gasPromises);
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

    // 🆕 Enhanced balance checking with token metadata for each chain
    console.log('🔍 Fetching enhanced balance data for all chains...');
    for (const chain of supportedChains) {
      try {
        console.log(`   Checking ${chain.name} (${chain.id})...`);

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
            portfolioData.summary.networksWithBalance++;

            // 🆕 Get token metadata for each token using 1inch Token API
            const tokenAddresses = Object.keys(balanceData).slice(0, 20); // Limit to prevent API overload
            const tokenMetadataPromises = tokenAddresses.map(async (tokenAddress) => {
              try {
                const tokenResponse = await fetch(
                  `https://api.1inch.dev/token/v1.2/${chain.id}/custom?addresses=${tokenAddress}`,
                  { headers }
                );
                if (tokenResponse.ok) {
                  const tokenData = await tokenResponse.json();
                  return { address: tokenAddress, metadata: tokenData[tokenAddress.toLowerCase()] };
                }
              } catch (error) {
                console.warn(`Token metadata failed for ${tokenAddress}:`, error.message);
              }
              return { address: tokenAddress, metadata: null };
            });

            const tokenMetadataResults = await Promise.allSettled(tokenMetadataPromises);
            
            // Build enhanced token list
            const enhancedTokens = Object.entries(balanceData).map(([tokenAddress, balance]) => {
              const metadataResult = tokenMetadataResults.find(
                result => result.status === 'fulfilled' && result.value.address === tokenAddress
              );
              
              const metadata = metadataResult?.value?.metadata || null;
              
              return {
                address: tokenAddress,
                balance: balance,
                formattedBalance: balance !== '0' ? 
                  (metadata?.decimals ? 
                    (parseFloat(balance) / Math.pow(10, metadata.decimals)).toFixed(6) : 
                    'Unknown') : '0',
                metadata: metadata ? {
                  name: metadata.name,
                  symbol: metadata.symbol,
                  decimals: metadata.decimals,
                  logoURI: metadata.logoURI
                } : null,
                source: '1inch_enhanced_api'
              };
            }).filter(token => token.balance !== '0');

            portfolioData.chains[chain.id] = {
              chainName: chain.name,
              tokenCount: enhancedTokens.length,
              tokens: enhancedTokens,
              gasInfo: portfolioData.gasContext[chain.id] || null,
              lastUpdated: new Date().toISOString()
            };

            portfolioData.summary.totalTokens += enhancedTokens.length;
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