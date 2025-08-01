# 🚀 Fusion+ Cross-Chain Relayer

A 1inch Fusion+ style relayer for cross-chain atomic swaps between Etherlink and Ethereum Sepolia.

## 📋 Overview

This relayer implements the complete 1inch Fusion+ specification for cross-chain swaps:
- **Phase 1**: Order announcement with Dutch auctions
- **Phase 2**: Automated escrow creation on both chains  
- **Phase 3**: Secret revelation and withdrawal execution
- **Phase 4**: Recovery mechanisms for failed swaps

## 🏗️ Your Deployed Contracts

- **Etherlink Ghostnet**: `0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff`
- **Ethereum Sepolia**: `0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312`

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment Configuration

Create a `.env` file in this directory:

```bash
# Copy the configuration from config-example.js
PRIVATE_KEY=your_private_key_here
DEPLOYER_ADDRESS=0x5e8c9f71b484f082df54bd6473dfbf74abba266d
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PORT=3000
```

### 3. Start the Relayer

```bash
npm start
```

### 4. Test the Connection

Open your browser to `http://localhost:3000` or test the API:

```bash
curl http://localhost:3000/api/test-connection
```

## 🌐 API Endpoints

### REST API (Port 3000)

- `GET /` - Relayer status and info
- `GET /api/status` - Detailed system status
- `GET /api/test-connection` - Test blockchain connections
- `POST /api/orders` - Submit new cross-chain order
- `GET /api/orders` - Get all orders

### WebSocket (Port 8080)

Real-time updates for order status, price changes, and swap completions.

## 📝 Order Submission

Submit a cross-chain swap order:

```javascript
// POST http://localhost:3000/api/orders
{
  "maker": "0x...",
  "token": "0x...",
  "amount": "1000000000000000000",
  "startPrice": "1.0",
  "endPrice": "0.95",
  "duration": 300000,
  "partsAmount": 4
}
```

## 🔄 Order Lifecycle

1. **Announcement** (Phase 1)
   - Order submitted with Dutch auction parameters
   - Price decreases over time until profitable for resolvers

2. **Deposit** (Phase 2)  
   - Escrows created on both Etherlink and Sepolia
   - Safety deposits locked

3. **Withdrawal** (Phase 3)
   - Secret revealed after finality lock
   - Funds transferred to respective parties

4. **Recovery** (Phase 4 - if needed)
   - Escrows cancelled if swap fails
   - Funds returned to original owners

## 🧪 Testing the Relayer

### Test Connection

```bash
curl http://localhost:3000/api/test-connection
```

### Submit Test Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "maker": "0x5e8c9f71b484f082df54bd6473dfbf74abba266d",
    "amount": "1000000000000000000",
    "startPrice": "1.0",
    "endPrice": "0.95"
  }'
```

### Check Order Status

```bash
curl http://localhost:3000/api/orders
```

## 🔧 Configuration

Key settings in your `.env` file:

```bash
# Your wallet private key (for signing transactions)
PRIVATE_KEY=your_private_key_here

# Your wallet address  
DEPLOYER_ADDRESS=0x5e8c9f71b484f082df54bd6473dfbf74abba266d

# RPC endpoints for blockchain connections
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Server ports
PORT=3000
WEBSOCKET_PORT=8080
```

## 🔍 Monitoring

The relayer provides comprehensive monitoring:

- **Blockchain connections**: Real-time block numbers
- **Contract status**: Owner verification and health checks  
- **Order tracking**: Active, completed, and failed orders
- **Performance metrics**: Uptime, success rates

## 🛠️ Development

### Project Structure

```
fusion-plus-relayer/
├── server.js              # Main server entry point
├── src/
│   └── FusionPlusRelayer.js # Core relayer logic
├── package.json           # Dependencies and scripts
├── config-example.js      # Configuration template
└── README.md              # This file
```

### Key Features

- **Dutch Auction Pricing**: Competitive price discovery
- **Partial Fill Support**: Merkle tree secret management
- **Cross-Chain Coordination**: Monitors both networks
- **Safety Deposits**: Incentivizes proper execution
- **Recovery Mechanisms**: Handles failed swaps

## 🌟 What This Achieves

### ✅ Full 1inch Fusion+ Compliance
Based on the official [1inch Fusion+ specification](https://1inch.io/assets/1inch-fusion-plus.pdf)

### ✅ Cross-Chain Infrastructure  
- Etherlink ↔ Ethereum swaps
- Real-time coordination between chains
- Atomic swap guarantees

### ✅ Production Ready Features
- Dutch auction mechanism
- Partial fill support
- Safety deposit system
- Recovery protocols

## 🚨 Important Notes

1. **Testnet Only**: Currently configured for Etherlink Ghostnet and Ethereum Sepolia
2. **Private Key Security**: Never commit your private key to version control
3. **RPC Limits**: Public RPCs may have rate limits
4. **Gas Costs**: Ensure sufficient funds on both networks

## 🎯 Next Steps

1. **Test the relayer** with small amounts first
2. **Monitor logs** for any issues or errors
3. **Scale to mainnet** when ready for production
4. **Add more chains** by deploying contracts to other networks

## 📞 Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your `.env` configuration
3. Test blockchain connections with `/api/test-connection`
4. Ensure you have testnet funds on both networks

---

**🎉 You now have a complete 1inch Fusion+ relayer running your cross-chain swap infrastructure!** 