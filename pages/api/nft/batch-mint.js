const WalletManager = require('../../../lib/wallet/WalletManager');
const EVMProvider = require('../../../lib/blockchain/EVMProvider');
const NFTService = require('../../../lib/services/NFTService');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      walletId, 
      password, 
      contractAddress,
      recipients,
      nftData,
      network = 'sepolia'
    } = req.body;

    // Validate required fields
    if (!walletId || !password || !contractAddress || !recipients || !nftData) {
      return res.status(400).json({ 
        error: 'Wallet ID, password, contract address, recipients, and NFT data are required' 
      });
    }

    if (!Array.isArray(recipients) || !Array.isArray(nftData)) {
      return res.status(400).json({ 
        error: 'Recipients and NFT data must be arrays' 
      });
    }

    if (recipients.length !== nftData.length) {
      return res.status(400).json({ 
        error: 'Recipients and NFT data arrays must have the same length' 
      });
    }

    if (recipients.length > 50) {
      return res.status(400).json({ 
        error: 'Batch size cannot exceed 50 NFTs' 
      });
    }

    // Load wallet
    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Batch mint NFTs
    const batchResult = await nftService.batchMintNFTs(wallet, contractAddress, {
      recipients,
      nftData
    }, network);

    res.status(200).json({
      success: true,
      batch: batchResult
    });
  } catch (error) {
    console.error('NFT batch minting error:', error);
    res.status(500).json({ error: error.message || 'Failed to batch mint NFTs' });
  }
}