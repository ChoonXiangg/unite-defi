// Configuration for Unite DeFi UI
const config = {
    // Contract addresses for deployed LOP contracts
    SEPOLIA_LOP: '0xE1a2de86f545C37dDd5722b988fa81774759BD44',  // Updated: Fixed EIP-712 contract
    ETHERLINK_LOP: '0x1Ab07abaC969aAF2cBC1b87ce64cfFADD259a4fd', // Updated: Fixed EIP-712 contract

    // CONTRACTS object for UI compatibility
    CONTRACTS: {
        SEPOLIA_LOP: '0xE1a2de86f545C37dDd5722b988fa81774759BD44',
        ETHERLINK_LOP: '0x1Ab07abaC969aAF2cBC1b87ce64cfFADD259a4fd'
    },

    // RPC URLs
    SEPOLIA_RPC_URL: 'https://eth-sepolia.g.alchemy.com/v2/_tXQMK2f5X42k-Gi_h8rlpaXFxXXMMWi',
    ETHERLINK_RPC_URL: 'https://node.ghostnet.etherlink.com',

    // Chain IDs
    SEPOLIA_CHAIN_ID: 11155111,
    ETHERLINK_CHAIN_ID: 128123,

    // Relayer configuration
    RELAYER_URL: 'http://localhost:3001',
    RELAYER_API_URL: 'http://localhost:3001',

    // Token configuration
    TOKENS: {
        SEPOLIA: {
            ETH: {
                address: '0x0000000000000000000000000000000000000000',
                symbol: 'ETH',
                decimals: 18,
                name: 'Ethereum'
            },
            USDC: {
                address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
                symbol: 'USDC',
                decimals: 6,
                name: 'USD Coin (Sepolia)'
            }
        },
        ETHERLINK: {
            XTZ: {
                address: '0x0000000000000000000000000000000000000000',
                symbol: 'XTZ',
                decimals: 18,
                name: 'Tezos'
            },
            USDC: {
                address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
                symbol: 'USDC',
                decimals: 6,
                name: 'USD Coin (Etherlink)'
            }
        }
    },

    // Domain separators from deployed contracts
    DOMAIN_SEPARATORS: {
        ETHERLINK: '0x1c8e7d7cfcee86dc62184749c9e6327269016e19bf4b71706cd021543a4d619d',
        SEPOLIA: '0x0000000000000000000000000000000000000000000000000000000000000000'   // Will be updated
    }
};

export { config };