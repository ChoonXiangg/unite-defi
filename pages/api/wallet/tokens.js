// API endpoint to retrieve all ERC20 tokens for a wallet across supported networks
// Returns token balances for all EVM-compatible networks

import { ethers } from 'ethers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.query;

    // Validate wallet address
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Valid wallet address is required'
      });
    }

    console.log('🪙 Fetching ERC20 tokens for address:', walletAddress);

    // Supported EVM networks with RPC endpoints
    const networks = {
      ethereum: {
        name: 'Ethereum',
        chainId: 1,
        rpcUrls: ['https://eth.llamarpc.com'],
        symbol: 'ETH'
      },
      sepolia: {
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        rpcUrls: [process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'],
        symbol: 'ETH'
      },
      bsc: {
        name: 'Binance Smart Chain',
        chainId: 56,
        rpcUrls: ['https://bsc-dataseed.binance.org'],
        symbol: 'BNB'
      },
      polygon: {
        name: 'Polygon',
        chainId: 137,
        rpcUrls: ['https://polygon-rpc.com'],
        symbol: 'MATIC'
      },
      arbitrumSepolia: {
        name: 'Arbitrum Sepolia',
        chainId: 421614,
        rpcUrls: [process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
        symbol: 'ETH'
      },
      arbitrumOne: {
        name: 'Arbitrum One',
        chainId: 42161,
        rpcUrls: [process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'],
        symbol: 'ETH'
      }
    };

    const tokenResults = {};

    // 🚀 Now 100% powered by 1inch APIs - no hardcoded token lists needed!
    // 1inch API will discover ALL tokens automatically

    // 🚀 Process each network using 100% 1inch APIs
    for (const [networkKey, networkConfig] of Object.entries(networks)) {
      console.log(`🌐 Checking ${networkConfig.name} for tokens...`);
      
      try {
        const networkTokens = [];
        const apiKey = process.env.ONEINCH_API_KEY;
        const headers = { 'Accept': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        // 🆕 Step 1: Get native token balance using 1inch-style approach
        try {
          // For native tokens, we can still use a simple RPC call but format it like 1inch
          const { ethers } = require('ethers');
          const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrls[0]);
          const nativeBalance = await provider.getBalance(walletAddress);
          const formattedNativeBalance = ethers.formatEther(nativeBalance);
          
          if (parseFloat(formattedNativeBalance) > 0) {
            networkTokens.push({
              type: 'native',
              symbol: networkConfig.symbol,
              name: `${networkConfig.name} Native Token`,
              balance: formattedNativeBalance,
              decimals: 18,
              address: 'native',
              source: 'rpc_native'
            });
          }
        } catch (nativeError) {
          console.warn(`Failed to get native balance for ${networkConfig.name}:`, nativeError.message);
        }

        // 🆕 Step 2: Use 1inch Balance API to discover ALL ERC20 tokens
        try {
          const oneInchUrl = `https://api.1inch.dev/balance/v1.2/${networkConfig.chainId}/balances/${walletAddress}`;
          const oneInchResponse = await fetch(oneInchUrl, { headers });
          
          if (oneInchResponse.ok) {
            const oneInchData = await oneInchResponse.json();
            console.log(`✅ 1inch Balance API found ${Object.keys(oneInchData).length} tokens on ${networkConfig.name}`);
            
            // 🆕 Step 3: For each token with balance, get comprehensive metadata
            const tokenAddresses = Object.keys(oneInchData).filter(addr => oneInchData[addr] !== '0');
            
            if (tokenAddresses.length > 0) {
              // Batch process tokens in chunks of 20 to avoid API limits
              const chunks = [];
              for (let i = 0; i < tokenAddresses.length; i += 20) {
                chunks.push(tokenAddresses.slice(i, i + 20));
              }
              
              for (const chunk of chunks) {
                try {
                  // 🆕 Step 3a: Get token metadata for chunk using 1inch Token API
                  const tokenApiUrl = `https://api.1inch.dev/token/v1.2/${networkConfig.chainId}/custom?addresses=${chunk.join(',')}`;
                  const tokenResponse = await fetch(tokenApiUrl, { headers });
                  
                  if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    
                    // 🆕 Step 3b: Get price data for non-PGS tokens using 1inch Spot Price API
                    let priceData = {};
                    const nonPgsTokens = chunk.filter(addr => {
                      const token = tokenData[addr.toLowerCase()];
                      return token && !(token.symbol === 'PGS' || token.name?.includes('PGS'));
                    });
                    
                    if (nonPgsTokens.length > 0) {
                      try {
                        const priceUrl = `https://api.1inch.dev/price/v1.1/${networkConfig.chainId}/${nonPgsTokens.join(',')}`;
                        const priceResponse = await fetch(priceUrl, { headers });
                        if (priceResponse.ok) {
                          priceData = await priceResponse.json();
                        }
                      } catch (priceError) {
                        console.warn(`Price API failed for chunk:`, priceError.message);
                      }
                    }
                    
                    // 🆕 Step 3c: Process each token with full 1inch data
                    for (const tokenAddress of chunk) {
                      const balance = oneInchData[tokenAddress];
                      const token = tokenData[tokenAddress.toLowerCase()];
                      
                      if (token && balance !== '0') {
                        const formattedBalance = ethers.formatUnits(balance, token.decimals || 18);
                        const isPGSToken = token.symbol === 'PGS' || token.name?.includes('PGS');
                        
                        // Calculate USD value
                        let usdValue = null;
                        if (!isPGSToken && priceData[tokenAddress.toLowerCase()]) {
                          const tokenPrice = priceData[tokenAddress.toLowerCase()];
                          usdValue = (parseFloat(formattedBalance) * parseFloat(tokenPrice)).toFixed(2);
                        }
                        
                        networkTokens.push({
                          type: isPGSToken ? 'reward' : 'erc20',
                          address: tokenAddress,
                          symbol: token.symbol || 'UNKNOWN',
                          name: token.name || 'Unknown Token',
                          balance: formattedBalance,
                          usdValue: usdValue,
                          decimals: token.decimals || 18,
                          contractAddress: tokenAddress,
                          source: '1inch_comprehensive',
                          logoURI: token.logoURI,
                          ...(isPGSToken && { note: 'Reward token - price not available' })
                        });
                      }
                    }
                  }
                } catch (chunkError) {
                  console.warn(`Failed to process token chunk on ${networkConfig.name}:`, chunkError.message);
                }
              }
            }
          } else {
            console.warn(`1inch Balance API failed for ${networkConfig.name}: ${oneInchResponse.status}`);
          }
        } catch (oneInchError) {
          console.warn(`1inch API completely failed for ${networkConfig.name}:`, oneInchError.message);
        }

        tokenResults[networkKey] = {
          network: networkConfig.name,
          chainId: networkConfig.chainId,
          tokens: networkTokens,
          totalTokens: networkTokens.length
        };

      } catch (networkError) {
        console.error(`Error processing ${networkConfig.name}:`, networkError);
        tokenResults[networkKey] = {
          network: networkConfig.name,
          error: networkError.message,
          tokens: []
        };
      }
    }

    // Calculate totals
    const totalNetworks = Object.keys(tokenResults).length;
    const totalTokensFound = Object.values(tokenResults)
      .reduce((sum, network) => sum + (network.tokens?.length || 0), 0);

    console.log(`✅ Token scan complete: ${totalTokensFound} tokens found across ${totalNetworks} networks`);

    return res.status(200).json({
      success: true,
      walletAddress,
      networks: tokenResults,
      summary: {
        totalNetworks,
        totalTokensFound,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching wallet tokens:', error);
    return res.status(500).json({
      error: 'Failed to fetch wallet tokens',
      message: error.message
    });
  }
}