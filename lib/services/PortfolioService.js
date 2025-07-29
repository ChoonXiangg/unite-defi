const EVMProvider = require('../blockchain/EVMProvider');
const TezosProvider = require('../blockchain/TezosProvider');

class PortfolioService {
  constructor() {
    this.evmProvider = new EVMProvider();
    this.tezosProvider = new TezosProvider();
  }

  async getWalletPortfolio(walletData) {
    const portfolio = {
      evm: {},
      tezos: {},
      totalValue: 0
    };

    // Get EVM balances across all supported networks
    const evmNetworks = this.evmProvider.getSupportedNetworks();
    for (const network of evmNetworks) {
      try {
        const balance = await this.evmProvider.getBalance(walletData.evm.address, network.key);
        portfolio.evm[network.key] = {
          network: balance.network,
          nativeToken: balance,
          tokens: []
        };
      } catch (error) {
        console.error(`Error fetching ${network.key} balance:`, error.message);
        portfolio.evm[network.key] = {
          network: network.name,
          nativeToken: { balance: '0', symbol: network.symbol },
          tokens: [],
          error: error.message
        };
      }
    }

    // Get Tezos balances
    const tezosNetworks = this.tezosProvider.getSupportedNetworks();
    for (const network of tezosNetworks) {
      try {
        const balance = await this.tezosProvider.getBalance(walletData.tezos.address, network.key);
        portfolio.tezos[network.key] = {
          network: balance.network,
          nativeToken: balance,
          tokens: [],
          nfts: []
        };
      } catch (error) {
        console.error(`Error fetching ${network.key} balance:`, error.message);
        portfolio.tezos[network.key] = {
          network: network.name,
          nativeToken: { balance: '0', symbol: network.symbol },
          tokens: [],
          nfts: [],
          error: error.message
        };
      }
    }

    return portfolio;
  }

  async getTokenBalances(walletData, tokenAddresses, network = 'ethereum', blockchain = 'evm') {
    const balances = [];

    if (blockchain === 'evm') {
      for (const tokenAddress of tokenAddresses) {
        try {
          const balance = await this.evmProvider.getTokenBalance(
            walletData.evm.address, 
            tokenAddress, 
            network
          );
          balances.push(balance);
        } catch (error) {
          balances.push({
            tokenAddress,
            balance: '0',
            error: error.message
          });
        }
      }
    } else if (blockchain === 'tezos') {
      for (const tokenAddress of tokenAddresses) {
        try {
          const balance = await this.tezosProvider.getTokenBalance(
            walletData.tezos.address, 
            tokenAddress, 
            null, 
            network
          );
          balances.push(balance);
        } catch (error) {
          balances.push({
            tokenAddress,
            balance: '0',
            error: error.message
          });
        }
      }
    }

    return balances;
  }

  async getNFTPortfolio(walletData, nftContracts, network = 'mainnet') {
    const nfts = [];

    for (const contractAddress of nftContracts) {
      try {
        const ownedNFTs = await this.tezosProvider.getNFTsOwnedByAddress(
          walletData.tezos.address,
          contractAddress,
          network
        );
        
        nfts.push({
          contractAddress,
          ownedTokens: ownedNFTs
        });
      } catch (error) {
        nfts.push({
          contractAddress,
          ownedTokens: [],
          error: error.message
        });
      }
    }

    return nfts;
  }

  async getTransactionHistory(walletData, network = 'ethereum', blockchain = 'evm') {
    let transactions = [];

    try {
      if (blockchain === 'evm') {
        transactions = await this.evmProvider.getTransactionHistory(
          walletData.evm.address, 
          network
        );
      } else if (blockchain === 'tezos') {
        transactions = await this.tezosProvider.getOperationHistory(
          walletData.tezos.address, 
          network
        );
      }
    } catch (error) {
      console.error(`Error fetching transaction history:`, error.message);
    }

    return transactions;
  }

  async sendTransaction(walletData, transaction) {
    const { blockchain, network, to, amount, tokenAddress, tokenId } = transaction;

    try {
      if (blockchain === 'evm') {
        if (tokenAddress) {
          // ERC-20 token transfer
          return await this.evmProvider.sendTokenTransaction(
            walletData.evm.privateKey,
            to,
            amount,
            tokenAddress,
            network
          );
        } else {
          // Native currency transfer
          return await this.evmProvider.sendTransaction(
            walletData.evm.privateKey,
            to,
            amount,
            network
          );
        }
      } else if (blockchain === 'tezos') {
        if (tokenAddress) {
          // Tezos token transfer
          return await this.tezosProvider.sendTokenTransaction(
            walletData.tezos.privateKey,
            to,
            amount,
            tokenAddress,
            tokenId,
            network
          );
        } else {
          // XTZ transfer
          return await this.tezosProvider.sendTransaction(
            walletData.tezos.privateKey,
            to,
            amount,
            network
          );
        }
      }
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async estimateTransactionFee(walletData, transaction) {
    const { blockchain, network, to, amount } = transaction;

    try {
      if (blockchain === 'evm') {
        return await this.evmProvider.estimateGas(
          walletData.evm.privateKey,
          to,
          amount,
          network
        );
      } else if (blockchain === 'tezos') {
        return await this.tezosProvider.estimateFee(
          walletData.tezos.privateKey,
          to,
          amount,
          network
        );
      }
    } catch (error) {
      throw new Error(`Fee estimation failed: ${error.message}`);
    }
  }

  getSupportedNetworks() {
    return {
      evm: this.evmProvider.getSupportedNetworks(),
      tezos: this.tezosProvider.getSupportedNetworks()
    };
  }
}

module.exports = PortfolioService;