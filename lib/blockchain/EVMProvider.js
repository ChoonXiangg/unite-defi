const { ethers } = require('ethers');

class EVMProvider {
  constructor() {
    this.networks = {
      ethereum: {
        name: 'Ethereum Mainnet',
        rpc: 'https://eth.llamarpc.com',
        chainId: 1,
        symbol: 'ETH'
      },
      sepolia: {
        name: 'Sepolia Testnet',
        rpc: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
        chainId: 11155111,
        symbol: 'ETH'
      },
      bsc: {
        name: 'Binance Smart Chain',
        rpc: 'https://bsc-dataseed1.binance.org',
        chainId: 56,
        symbol: 'BNB'
      },
      polygon: {
        name: 'Polygon',
        rpc: 'https://polygon-rpc.com',
        chainId: 137,
        symbol: 'MATIC'
      }
    };
    
    this.providers = {};
    this.initializeProviders();
  }

  initializeProviders() {
    for (const [networkKey, network] of Object.entries(this.networks)) {
      this.providers[networkKey] = new ethers.JsonRpcProvider(network.rpc);
    }
  }

  getProvider(network = 'ethereum') {
    if (!this.providers[network]) {
      throw new Error(`Network ${network} not supported`);
    }
    return this.providers[network];
  }

  getWallet(privateKey, network = 'ethereum') {
    const provider = this.getProvider(network);
    return new ethers.Wallet(privateKey, provider);
  }

  async getBalance(address, network = 'ethereum') {
    const provider = this.getProvider(network);
    const balance = await provider.getBalance(address);
    return {
      balance: ethers.formatEther(balance),
      symbol: this.networks[network].symbol,
      network: this.networks[network].name
    };
  }

  async getTokenBalance(address, tokenAddress, network = 'ethereum') {
    const provider = this.getProvider(network);
    
    // Standard ERC-20 ABI for balanceOf and decimals
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];
    
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    
    const [balance, decimals, symbol] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
      contract.symbol()
    ]);
    
    return {
      balance: ethers.formatUnits(balance, decimals),
      symbol,
      tokenAddress,
      network: this.networks[network].name
    };
  }

  async sendTransaction(privateKey, to, amount, network = 'ethereum') {
    const wallet = this.getWallet(privateKey, network);
    
    const transaction = {
      to,
      value: ethers.parseEther(amount.toString())
    };
    
    const tx = await wallet.sendTransaction(transaction);
    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      amount,
      network: this.networks[network].name
    };
  }

  async sendTokenTransaction(privateKey, to, amount, tokenAddress, network = 'ethereum') {
    const wallet = this.getWallet(privateKey, network);
    
    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)'
    ];
    
    const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const decimals = await contract.decimals();
    
    const tx = await contract.transfer(to, ethers.parseUnits(amount.toString(), decimals));
    
    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      amount,
      tokenAddress,
      network: this.networks[network].name
    };
  }

  async getTransactionHistory(address, network = 'ethereum') {
    const provider = this.getProvider(network);
    
    // Get recent blocks to search for transactions
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100); // Last 100 blocks
    
    const filter = {
      fromBlock,
      toBlock: 'latest'
    };
    
    // This is a simplified approach - in production, you'd use indexing services
    const transactions = [];
    
    for (let blockNumber = fromBlock; blockNumber <= currentBlock; blockNumber++) {
      try {
        const block = await provider.getBlock(blockNumber, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (tx.from === address || tx.to === address) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: ethers.formatEther(tx.value || 0),
                blockNumber: tx.blockNumber,
                timestamp: block.timestamp
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Error fetching block ${blockNumber}:`, error.message);
      }
    }
    
    return transactions;
  }

  async estimateGas(privateKey, to, amount, network = 'ethereum') {
    const wallet = this.getWallet(privateKey, network);
    
    const transaction = {
      to,
      value: ethers.parseEther(amount.toString())
    };
    
    const gasEstimate = await wallet.estimateGas(transaction);
    const gasPrice = await wallet.provider.getFeeData();
    
    return {
      gasLimit: gasEstimate.toString(),
      gasPrice: gasPrice.gasPrice?.toString() || '0',
      estimatedCost: ethers.formatEther(gasEstimate * (gasPrice.gasPrice || 0n))
    };
  }

  getSupportedNetworks() {
    return Object.entries(this.networks).map(([key, network]) => ({
      key,
      ...network
    }));
  }
}

module.exports = EVMProvider;