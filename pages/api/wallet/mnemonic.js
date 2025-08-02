// API endpoint to securely retrieve wallet mnemonic phrase
// Requires password authentication for security

const WalletManager = require('../../../lib/wallet/WalletManager.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, password } = req.body;

    // Validate required parameters
    if (!walletId || !password) {
      return res.status(400).json({
        error: 'Missing required parameters: walletId and password'
      });
    }

    // Validate password minimum length
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    console.log('🔐 Mnemonic retrieval request for wallet:', walletId);

    const walletManager = new WalletManager();

    // Load and decrypt the wallet
    const wallet = await walletManager.loadWallet(walletId, password);

    if (!wallet) {
      return res.status(401).json({
        error: 'Invalid wallet ID or password'
      });
    }

    // Extract mnemonic from decrypted wallet
    const mnemonic = wallet.mnemonic;

    if (!mnemonic) {
      return res.status(500).json({
        error: 'Mnemonic not found in wallet data'
      });
    }

    console.log('✅ Mnemonic retrieved successfully for wallet:', walletId);

    // Return mnemonic with security warning
    return res.status(200).json({
      success: true,
      mnemonic: mnemonic,
      warning: 'Never share your mnemonic phrase. Anyone with access to it can control your wallet.',
      walletId: walletId
    });

  } catch (error) {
    console.error('❌ Error retrieving mnemonic:', error);

    // Handle specific error types
    if (error.message.includes('incorrect password') || error.message.includes('Malformed UTF-8')) {
      return res.status(401).json({
        error: 'Incorrect password'
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Wallet not found'
      });
    }

    return res.status(500).json({
      error: 'Failed to retrieve mnemonic',
      message: error.message
    });
  }
}