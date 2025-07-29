const WalletManager = require('../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId } = req.body;

    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID is required' });
    }

    const walletManager = new WalletManager();
    const deleted = walletManager.deleteWallet(walletId);

    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'Wallet deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'Wallet not found' });
    }
  } catch (error) {
    console.error('Wallet deletion error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete wallet' });
  }
}