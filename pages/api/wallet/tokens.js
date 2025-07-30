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
      }
    };

    const tokenResults = {};

    // Common ERC20 token addresses for major networks
    const commonTokens = {
      ethereum: [
        { address: '0xA0b86a33E6E8B17B0B8B1c8e7F7b8C8B8f6a8F1D', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
        { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      ],
      bsc: [
        { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18 },
        { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
        { address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      ],
      polygon: [
        { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
        { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      ],
      arbitrumSepolia: [
        // Add your deployed PGS token
        { address: '0x032CdA4d263385dDe296C6C288B56A750CcCF047', symbol: 'PGS', name: 'PGS Token', decimals: 18 },
      ]
    };

    // ERC20 ABI for balance and token info queries
    const erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)'
    ];

    // Process each network
    for (const [networkKey, networkConfig] of Object.entries(networks)) {
      console.log(`🌐 Checking ${networkConfig.name} for tokens...`);
      
      try {
        // Create provider with fallback
        let provider = null;
        for (const rpcUrl of networkConfig.rpcUrls) {
          try {
            provider = new ethers.JsonRpcProvider(rpcUrl);
            await provider.getBlockNumber(); // Test connection
            break;
          } catch (rpcError) {
            console.warn(`RPC failed for ${networkConfig.name}:`, rpcUrl);
            continue;
          }
        }

        if (!provider) {
          tokenResults[networkKey] = {
            network: networkConfig.name,
            error: 'All RPC endpoints failed',
            tokens: []
          };
          continue;
        }

        const networkTokens = [];

        // Get native token balance
        try {
          const nativeBalance = await provider.getBalance(walletAddress);
          const formattedNativeBalance = ethers.formatEther(nativeBalance);
          
          if (parseFloat(formattedNativeBalance) > 0) {
            networkTokens.push({
              type: 'native',
              symbol: networkConfig.symbol,
              name: `${networkConfig.name} Native Token`,
              balance: formattedNativeBalance,
              decimals: 18,
              address: 'native'
            });
          }
        } catch (nativeError) {
          console.warn(`Failed to get native balance for ${networkConfig.name}:`, nativeError.message);
        }

        // Get ERC20 token balances
        const tokensToCheck = commonTokens[networkKey] || [];
        
        for (const tokenInfo of tokensToCheck) {
          try {
            const tokenContract = new ethers.Contract(tokenInfo.address, erc20ABI, provider);
            
            // Get token balance
            const balance = await tokenContract.balanceOf(walletAddress);
            const decimals = tokenInfo.decimals || await tokenContract.decimals();
            const formattedBalance = ethers.formatUnits(balance, decimals);
            
            // Only include tokens with non-zero balance
            if (parseFloat(formattedBalance) > 0) {
              let tokenName = tokenInfo.name;
              let tokenSymbol = tokenInfo.symbol;
              
              // Try to get live token info if not provided
              if (!tokenName || !tokenSymbol) {
                try {
                  tokenName = tokenName || await tokenContract.name();
                  tokenSymbol = tokenSymbol || await tokenContract.symbol();
                } catch (infoError) {
                  console.warn(`Failed to get token info for ${tokenInfo.address}:`, infoError.message);
                }
              }
              
              networkTokens.push({
                type: 'erc20',
                address: tokenInfo.address,
                symbol: tokenSymbol || 'UNKNOWN',
                name: tokenName || 'Unknown Token',
                balance: formattedBalance,
                decimals: decimals,
                contractAddress: tokenInfo.address
              });
            }
          } catch (tokenError) {
            console.warn(`Failed to check token ${tokenInfo.address} on ${networkConfig.name}:`, tokenError.message);
          }
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