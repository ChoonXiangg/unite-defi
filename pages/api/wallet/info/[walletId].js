const WalletManager = require('../../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId } = req.query;

    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID is required' });
    }

    const walletManager = new WalletManager();
    const walletInfo = walletManager.getWalletInfo(walletId);

    res.status(200).json({
      success: true,
      wallet: walletInfo
    });
  } catch (error) {
    console.error('Wallet info error:', error);
    if (error.message === 'Wallet not found') {
      res.status(404).json({ error: 'Wallet not found' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to get wallet info' });
    }
  }
}