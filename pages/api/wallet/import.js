const WalletManager = require('../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mnemonic, password } = req.body;

    if (!mnemonic || !password) {
      return res.status(400).json({ error: 'Mnemonic and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const walletManager = new WalletManager();
    const wallet = await walletManager.importWallet(mnemonic);
    
    // Generate wallet ID from timestamp and random string
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save encrypted wallet
    await walletManager.saveWallet(walletId, wallet, password);

    // Return wallet info
    res.status(200).json({
      success: true,
      walletId,
      addresses: {
        evm: wallet.evm.address,
        tezos: wallet.tezos.address
      }
    });
  } catch (error) {
    console.error('Wallet import error:', error);
    res.status(500).json({ error: error.message || 'Failed to import wallet' });
  }
}