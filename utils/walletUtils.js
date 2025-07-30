import { ethers } from 'ethers';

// ERC20 Token ABI for approve function
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)'
];

export class WalletService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.address = null;
  }

  async connectWallet() {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.address = await this.signer.getAddress();

      return {
        address: this.address,
        provider: this.provider,
        signer: this.signer
      };
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }

  async checkTokenAllowance(tokenAddress, spenderAddress, chainId = 1) {
    if (!this.signer || !this.address) {
      throw new Error('Wallet not connected');
    }

    // Skip allowance check for native tokens (ETH, BNB, etc.)
    if (tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
      return ethers.MaxUint256; // Native tokens don't need allowance
    }

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const allowance = await tokenContract.allowance(this.address, spenderAddress);
      return allowance;
    } catch (error) {
      console.error('Failed to check allowance:', error);
      throw error;
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const tx = await tokenContract.approve(spenderAddress, amount);
      return tx;
    } catch (error) {
      console.error('Token approval failed:', error);
      throw error;
    }
  }

  async executeSwap(transactionData) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.signer.sendTransaction({
        to: transactionData.to,
        data: transactionData.data,
        value: transactionData.value,
        gasLimit: transactionData.gas,
        gasPrice: transactionData.gasPrice
      });

      return tx;
    } catch (error) {
      console.error('Swap execution failed:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress) {
    if (!this.signer || !this.address) {
      throw new Error('Wallet not connected');
    }

    try {
      if (tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        // Native token balance
        return await this.provider.getBalance(this.address);
      } else {
        // ERC20 token balance
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
        return await tokenContract.balanceOf(this.address);
      }
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  isConnected() {
    return !!(this.provider && this.signer && this.address);
  }

  getAddress() {
    return this.address;
  }

  async switchNetwork(chainId) {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      console.error('Network switch failed:', error);
      throw error;
    }
  }
}

// Utility functions for 1inch integration
export const oneInchUtils = {
  // Get 1inch router address for different chains
  getRouterAddress: (chainId) => {
    const routers = {
      1: '0x1111111254eeb25477b68fb85ed929f73a960582', // Ethereum
      137: '0x1111111254eeb25477b68fb85ed929f73a960582', // Polygon
      56: '0x1111111254eeb25477b68fb85ed929f73a960582', // BSC
      42161: '0x1111111254eeb25477b68fb85ed929f73a960582', // Arbitrum
      43114: '0x1111111254eeb25477b68fb85ed929f73a960582', // Avalanche
    };
    return routers[chainId] || routers[1];
  },

  // Convert amount to smallest unit based on token decimals
  toSmallestUnit: (amount, decimals) => {
    return ethers.parseUnits(amount.toString(), decimals);
  },

  // Convert from smallest unit to human readable
  fromSmallestUnit: (amount, decimals) => {
    return ethers.formatUnits(amount, decimals);
  },

  // Build swap transaction data
  buildSwapData: async (fromToken, toToken, amount, walletAddress, chainId = 1) => {
    const response = await fetch('/api/price/oneinch-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        amount: oneInchUtils.toSmallestUnit(amount, fromToken.decimals || 18).toString(),
        fromAddress: walletAddress,
        slippage: 1,
        chainId: chainId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to build swap transaction');
    }

    return await response.json();
  }
};

export default WalletService;