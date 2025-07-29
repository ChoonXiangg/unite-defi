const WalletManager = require('../../../lib/wallet/WalletManager');
const EVMProvider = require('../../../lib/blockchain/EVMProvider');
const NFTService = require('../../../lib/services/NFTService');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, password } = req.body;

    if (!walletId || !password) {
      return res.status(400).json({ error: 'Wallet ID and password are required' });
    }

    // Load wallet
    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Get user's contracts
    const contracts = nftService.getUserContracts(wallet.evm.address);

    res.status(200).json({
      success: true,
      contracts,
      totalContracts: contracts.length
    });
  } catch (error) {
    console.error('Get user contracts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user contracts' });
  }
}