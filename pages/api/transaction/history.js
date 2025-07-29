const WalletManager = require('../../../lib/wallet/WalletManager');
const PortfolioService = require('../../../lib/services/PortfolioService');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      walletId, 
      password, 
      blockchain = 'evm', 
      network = 'ethereum' 
    } = req.body;

    if (!walletId || !password) {
      return res.status(400).json({ 
        error: 'Wallet ID and password are required' 
      });
    }

    // Validate blockchain type
    if (!['evm', 'tezos'].includes(blockchain)) {
      return res.status(400).json({ error: 'Blockchain must be "evm" or "tezos"' });
    }

    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    const portfolioService = new PortfolioService();
    const transactions = await portfolioService.getTransactionHistory(wallet, network, blockchain);

    res.status(200).json({
      success: true,
      transactions,
      blockchain,
      network
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch transaction history' });
  }
}