const { TezosToolkit } = require('@taquito/taquito');
const { InMemorySigner } = require('@taquito/signer');

class TezosProvider {
  constructor() {
    this.networks = {
      mainnet: {
        name: 'Tezos Mainnet',
        rpc: 'https://mainnet.api.tez.ie',
        symbol: 'XTZ'
      },
      ghostnet: {
        name: 'Ghostnet Testnet',
        rpc: 'https://ghostnet.ecadinfra.com',
        symbol: 'XTZ'
      }
    };
    
    this.tezos = {};
    this.initializeProviders();
  }

  initializeProviders() {
    for (const [networkKey, network] of Object.entries(this.networks)) {
      this.tezos[networkKey] = new TezosToolkit(network.rpc);
    }
  }

  getTezos(network = 'mainnet') {
    if (!this.tezos[network]) {
      throw new Error(`Network ${network} not supported`);
    }
    return this.tezos[network];
  }

  async setWallet(privateKey, network = 'mainnet') {
    const tezos = this.getTezos(network);
    const signer = new InMemorySigner(privateKey);
    tezos.setSigner(signer);
    return signer;
  }

  async getBalance(address, network = 'mainnet') {
    const tezos = this.getTezos(network);
    const balance = await tezos.tz.getBalance(address);
    return {
      balance: (balance.toNumber() / 1000000).toString(), // Convert from mutez to XTZ
      symbol: this.networks[network].symbol,
      network: this.networks[network].name
    };
  }

  async getTokenBalance(address, tokenAddress, tokenId = null, network = 'mainnet') {
    const tezos = this.getTezos(network);
    
    try {
      const contract = await tezos.contract.at(tokenAddress);
      let balance;
      
      if (tokenId !== null) {
        // FA2 token (NFT or multi-asset)
        const storage = await contract.storage();
        balance = await storage.ledger.get({ 0: address, 1: tokenId });
      } else {
        // FA1.2 token
        const storage = await contract.storage();
        balance = await storage.ledger.get(address);
      }
      
      return {
        balance: balance ? balance.toString() : '0',
        tokenAddress,
        tokenId,
        network: this.networks[network].name
      };
    } catch (error) {
      return {
        balance: '0',
        tokenAddress,
        tokenId,
        network: this.networks[network].name,
        error: error.message
      };
    }
  }

  async sendTransaction(privateKey, to, amount, network = 'mainnet') {
    const tezos = this.getTezos(network);
    await this.setWallet(privateKey, network);
    
    const amountInMutez = Math.floor(parseFloat(amount) * 1000000); // Convert XTZ to mutez
    
    const operation = await tezos.wallet.transfer({
      to,
      amount: amountInMutez,
      mutez: true
    }).send();
    
    return {
      hash: operation.opHash,
      from: await tezos.signer.publicKeyHash(),
      to,
      amount,
      network: this.networks[network].name
    };
  }

  async sendTokenTransaction(privateKey, to, amount, tokenAddress, tokenId = null, network = 'mainnet') {
    const tezos = this.getTezos(network);
    await this.setWallet(privateKey, network);
    
    const contract = await tezos.wallet.at(tokenAddress);
    const from = await tezos.signer.publicKeyHash();
    
    let operation;
    
    if (tokenId !== null) {
      // FA2 token transfer
      operation = await contract.methods.transfer([{
        from_: from,
        txs: [{
          to_: to,
          token_id: tokenId,
          amount: amount
        }]
      }]).send();
    } else {
      // FA1.2 token transfer
      operation = await contract.methods.transfer(from, to, amount).send();
    }
    
    return {
      hash: operation.opHash,
      from,
      to,
      amount,
      tokenAddress,
      tokenId,
      network: this.networks[network].name
    };
  }

  async getNFTMetadata(tokenAddress, tokenId, network = 'mainnet') {
    const tezos = this.getTezos(network);
    
    try {
      const contract = await tezos.contract.at(tokenAddress);
      const storage = await contract.storage();
      
      // Try to get token metadata
      const tokenInfo = await storage.token_metadata.get(tokenId);
      
      if (tokenInfo && tokenInfo.token_info) {
        const metadata = {};
        
        // Parse token_info map
        for (const [key, value] of tokenInfo.token_info.entries()) {
          const keyStr = Buffer.from(key, 'hex').toString('utf-8');
          const valueStr = Buffer.from(value, 'hex').toString('utf-8');
          metadata[keyStr] = valueStr;
        }
        
        return {
          tokenId,
          tokenAddress,
          metadata,
          network: this.networks[network].name
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
      return null;
    }
  }

  async getNFTsOwnedByAddress(address, tokenAddress, network = 'mainnet') {
    const tezos = this.getTezos(network);
    
    try {
      const contract = await tezos.contract.at(tokenAddress);
      const storage = await contract.storage();
      
      const ownedTokens = [];
      
      // This is a simplified approach - in production, you'd use indexing services
      // Here we try to iterate through possible token IDs (0-999)
      for (let tokenId = 0; tokenId < 1000; tokenId++) {
        try {
          const balance = await storage.ledger.get({ 0: address, 1: tokenId });
          if (balance && balance.toNumber() > 0) {
            const metadata = await this.getNFTMetadata(tokenAddress, tokenId, network);
            ownedTokens.push({
              tokenId,
              balance: balance.toString(),
              metadata: metadata?.metadata || {}
            });
          }
        } catch (error) {
          // Token doesn't exist or address doesn't own it
          continue;
        }
      }
      
      return ownedTokens;
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      return [];
    }
  }

  async getOperationHistory(address, network = 'mainnet') {
    const tezos = this.getTezos(network);
    
    try {
      // Note: This is a basic implementation
      // In production, you'd use indexing services like TzKT API
      const operations = [];
      
      // Get current block level
      const head = await tezos.rpc.getBlockHeader();
      const currentLevel = head.level;
      
      // Check last 100 blocks for operations involving this address
      for (let level = Math.max(1, currentLevel - 100); level <= currentLevel; level++) {
        try {
          const block = await tezos.rpc.getBlock({ block: level.toString() });
          
          for (const operationGroup of block.operations) {
            for (const operation of operationGroup) {
              if (operation.contents) {
                for (const content of operation.contents) {
                  if (content.source === address || content.destination === address) {
                    operations.push({
                      hash: operation.hash,
                      level: level,
                      timestamp: block.header.timestamp,
                      source: content.source,
                      destination: content.destination,
                      amount: content.amount ? (parseInt(content.amount) / 1000000).toString() : '0',
                      kind: content.kind
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          // Skip blocks that can't be fetched
          continue;
        }
      }
      
      return operations;
    } catch (error) {
      console.error('Error fetching operation history:', error);
      return [];
    }
  }

  async estimateFee(privateKey, to, amount, network = 'mainnet') {
    const tezos = this.getTezos(network);
    await this.setWallet(privateKey, network);
    
    const amountInMutez = Math.floor(parseFloat(amount) * 1000000);
    
    const estimate = await tezos.estimate.transfer({
      to,
      amount: amountInMutez,
      mutez: true
    });
    
    return {
      gasLimit: estimate.gasLimit,
      storageLimit: estimate.storageLimit,
      fee: (estimate.totalCost / 1000000).toString(), // Convert to XTZ
      network: this.networks[network].name
    };
  }

  getSupportedNetworks() {
    return Object.entries(this.networks).map(([key, network]) => ({
      key,
      ...network
    }));
  }
}

module.exports = TezosProvider;