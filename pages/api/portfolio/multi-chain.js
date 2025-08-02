// Multi-chain portfolio API using 1inch for data and CoinGecko for logos
import { coinGeckoRateLimiter } from '../../../utils/rateLimiter';

// Utility function to throttle requests 
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

    const oneInchApiKey = process.env.ONEINCH_API_KEY;
    console.log('📊 Getting multi-chain portfolio data...');
    console.log('   Wallet:', walletAddress);
    console.log('   1inch API Key:', oneInchApiKey ? 'Present ✅' : 'Missing ❌');

    const headers = {
      'Accept': 'application/json'
    };
    
    if (oneInchApiKey) {
      headers['Authorization'] = `Bearer ${oneInchApiKey}`;
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
        totalValueUSD: 0,
        lastUpdated: new Date().toISOString()
      },
      gasContext: {},
      tokenLogos: {}, // Store token logos from CoinGecko
      metadata: {
        sources: ['1inch_balance_api', '1inch_gas_api', '1inch_token_api', 'coingecko_logos'],
        apiVersion: 'portfolio_v1.0'
      }
    };

    // Get gas prices for all supported chains sequentially to respect rate limits
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

    // Enhanced balance checking with token metadata for each chain (throttled)
    console.log('🔍 Fetching enhanced balance data for all chains (throttled)...');
    let totalValueUSD = 0;
    const allTokenSymbols = new Set(); // Collect unique token symbols for logo fetching
    
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
            
            // Check if any balances are actually non-zero
            const nonZeroBalances = Object.values(balanceData).filter(balance => balance && balance !== '0');
            console.log(`   📊 Non-zero balances: ${nonZeroBalances.length}/${tokenCount}`);
            
            if (nonZeroBalances.length > 0) {
              portfolioData.summary.networksWithBalance++;
            }

            // Only process metadata for tokens with non-zero balances
            if (nonZeroBalances.length > 0) {
              // Get token metadata for tokens with non-zero balances (throttled)
              const nonZeroTokens = Object.entries(balanceData)
                .filter(([addr, balance]) => balance && balance !== '0')
                .slice(0, 20); // Limit to 20 most important tokens per chain
              
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

                // Add token symbol to collection for logo fetching
                if (metadata?.symbol) {
                  allTokenSymbols.add(metadata.symbol.toUpperCase());
                }
                
                // Estimate USD value (this would need price data from 1inch price API)
                // For now, we'll set it to 0 and calculate later if needed
                const estimatedValueUSD = 0;
                
                return {
                  address: tokenAddress,
                  balance: balance,
                  formattedBalance: formattedBalance,
                  numericBalance: numericBalance,
                  estimatedValueUSD: estimatedValueUSD,
                  metadata: metadata ? {
                    name: metadata.name,
                    symbol: metadata.symbol,
                    decimals: metadata.decimals,
                    logoURI: metadata.logoURI
                  } : null,
                  source: '1inch_enhanced_api',
                  chainId: chain.id,
                  chainName: chain.name
                };
              });

              console.log(`   📋 Final enhanced tokens count: ${enhancedTokens.length}`);

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

    // Fetch token logos from CoinGecko for unique tokens (with rate limiting)
    console.log('🎨 Fetching token logos from CoinGecko...');
    const tokenSymbolsArray = Array.from(allTokenSymbols);
    
    if (tokenSymbolsArray.length > 0) {
      try {
        // Wait for rate limiter slot before making CoinGecko API call
        await coinGeckoRateLimiter.waitForSlot();
        
        // Map common token symbols to CoinGecko IDs
        const tokenMap = {
          'ETH': 'ethereum',
          'WETH': 'ethereum',
          'USDC': 'usd-coin',
          'USDT': 'tether',
          'BTC': 'bitcoin',
          'WBTC': 'wrapped-bitcoin',
          'BNB': 'binancecoin',
          'MATIC': 'matic-network',
          'AVAX': 'avalanche-2',
          'LINK': 'chainlink',
          'UNI': 'uniswap',
          'AAVE': 'aave',
          'CRV': 'curve-dao-token',
          'COMP': 'compound-governance-token',
          'MKR': 'maker',
          'YFI': 'yearn-finance',
          'SUSHI': 'sushi',
          'DOGE': 'dogecoin',
          'ADA': 'cardano',
          'SOL': 'solana',
          'DOT': 'polkadot'
        };

        // Fetch token info from CoinGecko
        const coinIds = tokenSymbolsArray
          .map(symbol => tokenMap[symbol])
          .filter(id => id)
          .slice(0, 50) // Limit to 50 tokens to avoid API issues
          .join(',');

        if (coinIds) {
          const coinGeckoUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;
          const logoResponse = await fetch(coinGeckoUrl);
          
          if (logoResponse.ok) {
            const logoData = await logoResponse.json();
            
            // Map logos back to token symbols
            logoData.forEach(coin => {
              const symbol = coin.symbol.toUpperCase();
              portfolioData.tokenLogos[symbol] = {
                logoUrl: coin.image,
                name: coin.name,
                currentPrice: coin.current_price,
                priceChange24h: coin.price_change_percentage_24h,
                marketCap: coin.market_cap
              };
            });
            
            console.log(`   ✅ Fetched logos for ${logoData.length} tokens from CoinGecko`);
          }
        }
      } catch (error) {
        console.warn('⚠️ CoinGecko logo fetch failed:', error.message);
      }
    }

    portfolioData.summary.totalChains = supportedChains.length;
    portfolioData.summary.totalValueUSD = totalValueUSD;

    // Add performance metrics
    portfolioData.performance = {
      apiCalls: supportedChains.length * 2, // Balance + Gas APIs per chain
      successfulChains: Object.values(portfolioData.chains).filter(chain => !chain.error).length,
      gasDataAvailable: Object.keys(portfolioData.gasContext).length,
      logosAvailable: Object.keys(portfolioData.tokenLogos).length,
      enhancementLevel: 'comprehensive_1inch_coingecko'
    };

    console.log(`✅ Multi-chain portfolio analysis complete:`);
    console.log(`   Total chains: ${portfolioData.summary.totalChains}`);
    console.log(`   Chains with balance: ${portfolioData.summary.networksWithBalance}`);
    console.log(`   Total tokens: ${portfolioData.summary.totalTokens}`);
    console.log(`   Token logos: ${Object.keys(portfolioData.tokenLogos).length}`);

    return res.status(200).json({
      success: true,
      data: portfolioData
    });

  } catch (error) {
    console.error('❌ Multi-chain portfolio API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch multi-chain portfolio data',
      message: error.message
    });
  }
}