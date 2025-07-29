const WalletManager = require('../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const walletManager = new WalletManager();
    const wallets = walletManager.listWallets();

    res.status(200).json({
      success: true,
      wallets
    });
  } catch (error) {
    console.error('List wallets error:', error);
    res.status(500).json({ error: 'Failed to list wallets' });
  }
}