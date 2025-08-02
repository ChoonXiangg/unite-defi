// Configuration for Unite DeFi UI
export const config = {
  // Your relayer API endpoint
  RELAYER_API_URL: 'http://localhost:3001',
  
  // WebSocket endpoint  
  RELAYER_WS_URL: 'ws://localhost:8080',
  
  // Your deployed contract addresses
  CONTRACTS: {
    SEPOLIA_LOP: process.env.NEXT_PUBLIC_SEPOLIA_HYBRID_LOP_ADDRESS || '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
    ETHERLINK_LOP: process.env.NEXT_PUBLIC_ETHERLINK_HYBRID_LOP_ADDRESS || '0xf4C21603E2A717aC176880Bf7EB00E560A4459ab',
    SEPOLIA_ESCROW_FACTORY: '0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312',
    ETHERLINK_ESCROW_FACTORY: '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff'
  },
  
  // Chain configurations
  CHAINS: {
    SEPOLIA: {
      id: 11155111,
      name: 'Sepolia',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/_tXQMK2f5X42k-Gi_h8rlpaXFxXXMMWi',
      blockExplorer: 'https://sepolia.etherscan.io'
    },
    ETHERLINK: {
      id: 128123,
      name: 'Etherlink Testnet',
      rpcUrl: 'https://node.ghostnet.etherlink.com',
      blockExplorer: 'https://testnet.explorer.etherlink.com'
    }
  },
  
  // Common tokens
  TOKENS: {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ethereum'
    },
    USDC: {
      address: '0xA0b86a33E6417c4d2C6C4c4c4c4c4c4c4c4c4c4c',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    }
  }
};