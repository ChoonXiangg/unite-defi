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
      blockchain, 
      network, 
      to, 
      amount 
    } = req.body;

    // Validate required fields
    if (!walletId || !password || !blockchain || !network || !to || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: walletId, password, blockchain, network, to, amount' 
      });
    }

    // Validate blockchain type
    if (!['evm', 'tezos'].includes(blockchain)) {
      return res.status(400).json({ error: 'Blockchain must be "evm" or "tezos"' });
    }

    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    const portfolioService = new PortfolioService();
    
    const transaction = {
      blockchain,
      network,
      to,
      amount
    };

    const estimate = await portfolioService.estimateTransactionFee(wallet, transaction);

    res.status(200).json({
      success: true,
      estimate
    });
  } catch (error) {
    console.error('Fee estimation error:', error);
    res.status(500).json({ error: error.message || 'Fee estimation failed' });
  }
}