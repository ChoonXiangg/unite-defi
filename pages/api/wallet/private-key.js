const WalletManager = require('../../../lib/wallet/WalletManager');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, password } = req.body;

    if (!walletId || !password) {
      return res.status(400).json({ error: 'Wallet ID and password are required' });
    }

    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    // Return private keys (this is a sensitive operation)
    res.status(200).json({
      success: true,
      walletId,
      privateKeys: {
        evm: wallet.evm.privateKey,
        tezos: wallet.tezos.privateKey
      }
    });
  } catch (error) {
    console.error('Private key retrieval error:', error);
    res.status(401).json({ error: error.message || 'Failed to retrieve private keys' });
  }
}