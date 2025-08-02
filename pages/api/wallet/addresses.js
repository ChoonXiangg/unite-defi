// API endpoint to retrieve all public addresses for a wallet
// Returns EVM and Tezos addresses without requiring password authentication

const WalletManager = require('../../../lib/wallet/WalletManager.js');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId } = req.query;

    // Validate wallet ID
    if (!walletId) {
      return res.status(400).json({
        error: 'Wallet ID is required'
      });
    }

    console.log('📍 Fetching public addresses for wallet:', walletId);

    const walletManager = new WalletManager();

    // Get wallet metadata (includes public addresses)
    const walletData = await walletManager.getWalletById(walletId);

    if (!walletData) {
      return res.status(404).json({
        error: 'Wallet not found'
      });
    }

    // Extract public addresses from metadata
    const addresses = {
      evm: {
        address: walletData.metadata.evmAddress,
        networks: [
          {
            name: 'Ethereum Mainnet',
            chainId: 1,
            explorer: `https://etherscan.io/address/${walletData.metadata.evmAddress}`,
            symbol: 'ETH'
          },
          {
            name: 'Ethereum Sepolia',
            chainId: 11155111,
            explorer: `https://sepolia.etherscan.io/address/${walletData.metadata.evmAddress}`,
            symbol: 'ETH'
          },
          {
            name: 'Binance Smart Chain',
            chainId: 56,
            explorer: `https://bscscan.com/address/${walletData.metadata.evmAddress}`,
            symbol: 'BNB'
          },
          {
            name: 'Polygon',
            chainId: 137,
            explorer: `https://polygonscan.com/address/${walletData.metadata.evmAddress}`,
            symbol: 'MATIC'
          },
          {
            name: 'Arbitrum Sepolia',
            chainId: 421614,
            explorer: `https://sepolia.arbiscan.io/address/${walletData.metadata.evmAddress}`,
            symbol: 'ETH'
          }
        ]
      },
      tezos: {
        address: walletData.metadata.tezosAddress,
        networks: [
          {
            name: 'Tezos Mainnet',
            explorer: `https://tzkt.io/${walletData.metadata.tezosAddress}`,
            symbol: 'XTZ'
          },
          {
            name: 'Tezos Ghostnet',
            explorer: `https://ghostnet.tzkt.io/${walletData.metadata.tezosAddress}`,
            symbol: 'XTZ'
          }
        ]
      }
    };

    // Additional address formats and information
    const addressDetails = {
      wallet: {
        id: walletData.id,
        username: walletData.metadata.username,
        label: walletData.metadata.label,
        description: walletData.metadata.description,
        createdAt: walletData.createdAt
      },
      addresses,
      qrCodes: {
        evm: {
          address: walletData.metadata.evmAddress,
          qrData: walletData.metadata.evmAddress // Can be used to generate QR codes on frontend
        },
        tezos: {
          address: walletData.metadata.tezosAddress,
          qrData: walletData.metadata.tezosAddress
        }
      },
      compatibility: {
        evm: {
          supportedTokens: ['ERC-20', 'ERC-721', 'ERC-1155'],
          supportedProtocols: ['EIP-1559', 'Legacy Transactions'],
          networks: 5
        },
        tezos: {
          supportedTokens: ['FA1.2', 'FA2'],
          supportedProtocols: ['Tezos Smart Contracts'],
          networks: 2
        }
      }
    };

    console.log('✅ Public addresses retrieved successfully for wallet:', walletId);

    return res.status(200).json({
      success: true,
      walletId,
      ...addressDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching wallet addresses:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Wallet not found'
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch wallet addresses',
      message: error.message
    });
  }
}