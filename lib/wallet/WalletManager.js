const { generateMnemonic, mnemonicToSeedSync, validateMnemonic } = require('bip39');
const { ethers } = require('ethers');
const { InMemorySigner } = require('@taquito/signer');
const { b58cencode, b58cdecode, prefix } = require('@taquito/utils');
const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');

class WalletManager {
  constructor() {
    this.walletsDir = path.join(process.cwd(), 'data', 'wallets');
    this.ensureWalletsDirectory();
  }

  ensureWalletsDirectory() {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true });
    }
  }

  async generateWallet() {
    const mnemonic = generateMnemonic();
    const walletData = await this.createWalletFromMnemonic(mnemonic);
    return {
      mnemonic,
      ...walletData
    };
  }

  async createWalletFromMnemonic(mnemonic) {
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = mnemonicToSeedSync(mnemonic);
    
    // EVM wallet (Ethereum-compatible)
    const evmWallet = ethers.Wallet.fromPhrase(mnemonic);
    
    // Tezos wallet
    const tezosWallet = await this.createTezosWallet(seed);
    
    return {
      evm: {
        address: evmWallet.address,
        privateKey: evmWallet.privateKey,
        publicKey: evmWallet.publicKey
      },
      tezos: {
        address: tezosWallet.address,
        privateKey: tezosWallet.privateKey,
        publicKey: tezosWallet.publicKey
      }
    };
  }

  async createTezosWallet(seed) {
    // Generate ed25519 key pair from seed
    const privateKeySeed = seed.slice(0, 32);
    const keyPair = nacl.sign.keyPair.fromSeed(privateKeySeed);
    
    // Tezos uses the full 64-byte secret key (not just the 32-byte private key)
    const fullSecretKey = keyPair.secretKey;
    
    // Create proper edsk private key using Taquito's encoding
    const edskPrivateKey = b58cencode(fullSecretKey, prefix.edsk);
    
    const signer = new InMemorySigner(edskPrivateKey);
    
    return {
      address: await signer.publicKeyHash(),
      privateKey: edskPrivateKey,
      publicKey: await signer.publicKey()
    };
  }

  async saveWallet(walletId, walletData, password) {
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(walletData), 
      password
    ).toString();
    
    const walletFile = path.join(this.walletsDir, `${walletId}.json`);
    fs.writeFileSync(walletFile, JSON.stringify({
      id: walletId,
      encrypted: encryptedData,
      createdAt: new Date().toISOString()
    }));
  }

  async loadWallet(walletId, password) {
    const walletFile = path.join(this.walletsDir, `${walletId}.json`);
    
    if (!fs.existsSync(walletFile)) {
      throw new Error('Wallet not found');
    }

    const walletFileData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    try {
      const decryptedData = CryptoJS.AES.decrypt(
        walletFileData.encrypted, 
        password
      ).toString(CryptoJS.enc.Utf8);
      
      return JSON.parse(decryptedData);
    } catch (error) {
      throw new Error('Invalid password');
    }
  }

  listWallets() {
    if (!fs.existsSync(this.walletsDir)) {
      return [];
    }

    return fs.readdirSync(this.walletsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const walletData = JSON.parse(
          fs.readFileSync(path.join(this.walletsDir, file), 'utf8')
        );
        return {
          id: walletData.id,
          createdAt: walletData.createdAt
        };
      });
  }

  async importWallet(mnemonic) {
    const walletData = await this.createWalletFromMnemonic(mnemonic);
    return {
      mnemonic,
      ...walletData
    };
  }

  deleteWallet(walletId) {
    const walletFile = path.join(this.walletsDir, `${walletId}.json`);
    if (fs.existsSync(walletFile)) {
      fs.unlinkSync(walletFile);
      return true;
    }
    return false;
  }
}

module.exports = WalletManager;