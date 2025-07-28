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
      recipient,
      name,
      description,
      image,
      attributes,
      network = 'sepolia'
    } = req.body;

    // Validate required fields
    if (!walletId || !password || !contractAddress || !recipient || !name) {
      return res.status(400).json({ 
        error: 'Wallet ID, password, contract address, recipient, and NFT name are required' 
      });
    }

    // Load wallet
    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Mint NFT
    const mintResult = await nftService.mintNFT(wallet, contractAddress, {
      recipient,
      name,
      description,
      image,
      attributes
    }, network);

    res.status(200).json({
      success: true,
      nft: mintResult
    });
  } catch (error) {
    console.error('NFT minting error:', error);
    res.status(500).json({ error: error.message || 'Failed to mint NFT' });
  }
}