const WalletManager = require('../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, metadata } = req.body;

    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID is required' });
    }

    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'Metadata object is required' });
    }

    const walletManager = new WalletManager();
    const updatedWallet = walletManager.updateWalletMetadata(walletId, metadata);

    res.status(200).json({
      success: true,
      wallet: updatedWallet
    });
  } catch (error) {
    console.error('Wallet update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update wallet' });
  }
}