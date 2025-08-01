// Configuration example for Fusion+ Relayer
// Create a .env file in this directory with these values:

/*
PRIVATE_KEY=your_private_key_here
DEPLOYER_ADDRESS=0x5e8c9f71b484f082df54bd6473dfbf74abba266d
SEPOLIA_RPC_URL=https://rpc.sepolia.org
ETHERLINK_RPC_URL=https://node.ghostnet.etherlink.com
PORT=3000
WEBSOCKET_PORT=8080
ETHERLINK_ESCROW_FACTORY=0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff
SEPOLIA_ESCROW_FACTORY=0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312
DEFAULT_SAFETY_DEPOSIT=0.01
AUCTION_DURATION=300000
FINALITY_LOCK_PERIOD=60000
*/

module.exports = {
    // Your deployed contract addresses
    contracts: {
        etherlink: '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
        sepolia: '0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312'
    },
    
    // RPC endpoints
    rpc: {
        etherlink: 'https://node.ghostnet.etherlink.com',
        sepolia: 'https://rpc.sepolia.org'
    },
    
    // Server settings
    server: {
        port: 3000,
        websocketPort: 8080
    },
    
    // Relayer settings
    relayer: {
        defaultSafetyDeposit: '0.01',
        auctionDuration: 300000, // 5 minutes
        finalityLockPeriod: 60000 // 1 minute
    }
}; 