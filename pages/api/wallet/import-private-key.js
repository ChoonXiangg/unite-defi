// API endpoint to import wallet from private key
// Supports both EVM and Tezos private keys

const WalletManager = require('../../../lib/wallet/WalletManager.js');
const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { privateKey, password, keyType = 'evm', metadata = {} } = req.body;

    // Validate required parameters
    if (!privateKey || !password) {
      return res.status(400).json({
        error: 'Missing required parameters: privateKey and password'
      });
    }

    // Validate password minimum length
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    // Validate private key format
    if (!privateKey.trim()) {
      return res.status(400).json({
        error: 'Private key cannot be empty'
      });
    }

    // Validate key type
    if (!['evm', 'tezos'].includes(keyType)) {
      return res.status(400).json({
        error: 'Key type must be either "evm" or "tezos"'
      });
    }

    console.log('🔐 Private key import request');
    console.log('   Key type:', keyType);
    console.log('   Metadata:', Object.keys(metadata));

    const walletManager = new WalletManager();

    // Import wallet from private key
    const walletData = await walletManager.importWalletFromPrivateKey(privateKey, keyType);

    // Check if wallet already exists
    const existingWallet = walletManager.checkWalletExists(
      walletData.evm.address,
      walletData.tezos.address
    );

    if (existingWallet) {
      return res.status(409).json({
        error: 'A wallet with these addresses already exists',
        existingWallet: {
          id: existingWallet.id,
          createdAt: existingWallet.createdAt,
          evmAddress: existingWallet.metadata.evmAddress,
          tezosAddress: existingWallet.metadata.tezosAddress
        }
      });
    }

    // Generate unique wallet ID
    const walletId = `wallet_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

    // Prepare wallet data for encryption (include import info)
    const walletDataForStorage = {
      ...walletData,
      importedAt: new Date().toISOString(),
      importMethod: 'private_key',
      keyType: keyType
    };

    // Save encrypted wallet
    await walletManager.saveWallet(walletId, walletDataForStorage, password, {
      ...metadata,
      importType: walletData.importType,
      importNote: walletData.note
    });

    console.log('✅ Wallet imported successfully from private key');
    console.log('   Wallet ID:', walletId);
    console.log('   EVM Address:', walletData.evm.address);
    console.log('   Tezos Address:', walletData.tezos.address);
    console.log('   Import Type:', walletData.importType);

    return res.status(201).json({
      success: true,
      walletId,
      addresses: {
        evm: walletData.evm.address,
        tezos: walletData.tezos.address
      },
      importType: walletData.importType,
      note: walletData.note,
      message: 'Wallet imported successfully from private key'
    });

  } catch (error) {
    console.error('❌ Error importing wallet from private key:', error);

    // Handle specific error types
    if (error.message.includes('invalid private key') || 
        error.message.includes('Invalid private key')) {
      return res.status(400).json({
        error: 'Invalid private key format'
      });
    }

    if (error.message.includes('Unsupported private key type')) {
      return res.status(400).json({
        error: 'Unsupported private key type. Use "evm" or "tezos".'
      });
    }

    return res.status(500).json({
      error: 'Failed to import wallet from private key',
      message: error.message
    });
  }
}