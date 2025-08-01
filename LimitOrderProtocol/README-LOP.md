# Advanced 1inch Limit Order Protocol (LOP) with Relayer

## 🚀 Overview

This project implements an advanced **Limit Order Protocol (LOP)** with full **1inch API integration** and a sophisticated **relayer system**. The system supports multi-chain operations, automatic escrow deployment, and real-time order monitoring.

## 🏗️ Architecture

### Core Components

1. **LimitOrderProtocol.sol** - Main contract handling order validation and execution
2. **EscrowFactory.sol** - Factory for deploying escrow contracts per order
3. **OneInchIntegration.sol** - Integration with 1inch price oracle and swap services
4. **OneInchRelayer.js** - Advanced relayer with 1inch API integration
5. **Multi-chain Support** - Ethereum, Sepolia, Etherlink, Polygon, BSC, Arbitrum

### Key Features

✅ **1inch API Integration** - Price validation, swap quotes, supported tokens  
✅ **Signature Validation** - EIP-712 compliant order signing  
✅ **Condition Predicates** - Custom order execution conditions  
✅ **Automatic Escrow Deployment** - Per-order escrow contracts  
✅ **Multi-chain Support** - Deploy on multiple networks  
✅ **Real-time Monitoring** - WebSocket-based order tracking  
✅ **Resolver Authorization** - KYC'd resolver system  

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
# Install main dependencies
npm install

# Install relayer dependencies
cd relayer
npm install
cd ..
```

### 2. Environment Configuration

Update your `.env` file with the following variables:

```env
# Private key for deployment and relayer
PRIVATE_KEY=your_private_key_here

# 1inch API Key (get from https://portal.1inch.dev/)
oneInchApiKey=your_1inch_api_key_here

# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
ETHERLINK_TESTNET_RPC_URL=https://node.ghostnet.etherlink.com
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key

# Block explorer API keys
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Compile Contracts

```bash
npm run compile
```

## 📦 Deployment

### Deploy to Sepolia Testnet

```bash
npm run deploy:sepolia
```

### Deploy to Etherlink Testnet

```bash
npm run deploy:etherlink
```

### Deploy to Ethereum Mainnet

```bash
npm run deploy:ethereum
```

The deployment script will:
- Deploy EscrowFactory
- Deploy OneInchIntegration  
- Deploy LimitOrderProtocol
- Authorize LOP in EscrowFactory
- Save deployment addresses to `.env`

## 🔄 Running the Relayer

### Start Production Relayer

```bash
npm run relayer
```

### Start Development Relayer (with auto-restart)

```bash
npm run relayer:dev
```

The relayer provides:
- **HTTP API** on port 3001
- **WebSocket** on port 8080
- **Real-time order monitoring**
- **1inch API integration**

## 🌐 API Endpoints

### HTTP REST API

```bash
# Service information
GET http://localhost:3001/

# Get all orders
GET http://localhost:3001/orders

# Get specific order
GET http://localhost:3001/orders/:hash

# Create new order
POST http://localhost:3001/orders
{
  "order": { ... },
  "signature": "0x..."
}

# Get supported chains
GET http://localhost:3001/chains

# Get supported tokens for chain
GET http://localhost:3001/tokens/:chain

# Get token price
GET http://localhost:3001/price/:chain/:from/:to

# Validate order
POST http://localhost:3001/validate
{
  "order": { ... },
  "signature": "0x..."
}
```

### WebSocket API

```javascript
const ws = new WebSocket('ws://localhost:8080');

// Add order
ws.send(JSON.stringify({
  type: 'addOrder',
  order: { ... },
  signature: '0x...'
}));

// Get order status
ws.send(JSON.stringify({
  type: 'getOrderStatus',
  orderHash: '0x...'
}));
```

## 📋 Order Structure

```javascript
const order = {
  maker: "0x...",              // Order creator address
  makerAsset: "0x...",         // Token to sell (0x0 for ETH)
  takerAsset: "0x...",         // Token to buy (0x0 for ETH)
  makerAmount: "1000000000000000000", // Amount to sell (wei)
  takerAmount: "2000000000000000000", // Amount to buy (wei)
  deadline: 1640995200,        // Unix timestamp
  salt: 12345,                 // Unique nonce
  makerAssetData: "0x",        // Additional maker asset data
  takerAssetData: "0x",        // Additional taker asset data
  predicate: "0x",             // Custom condition bytecode
  permit: "0x",                // Permit data for gasless approvals
  interaction: "0x"            // Post-interaction bytecode
};
```

## 🔐 1inch API Integration

The system integrates with multiple 1inch API endpoints:

### Supported APIs

1. **Price Oracle** - Real-time token prices
2. **Swap API** - Optimal swap routes
3. **Tokens API** - Supported tokens per chain
4. **Limit Orders** - 1inch native limit orders

### API Usage Examples

```javascript
// Get supported tokens
const tokens = await relayer.oneInchAPI.getSupportedTokens(1); // Ethereum

// Get token price
const quote = await relayer.oneInchAPI.getSwapQuote(
  1,                    // Chain ID
  "0xA0b86a33E6...",   // From token
  "0x6B175474E8...",   // To token  
  "1000000000000000000" // Amount (1 token)
);

// Validate order price
const isValid = await relayer.oneInchAPI.validateOrderPrice(order, 100); // 1% slippage
```

## 🧪 Testing

### Run Contract Tests

```bash
npm test
```

### Test Coverage

The test suite covers:
- Order creation and validation
- Signature verification
- Order execution flow
- Escrow deployment
- Access control
- Error conditions

## 🔄 Workflow

### 1. Order Creation
1. User creates order with required parameters
2. User signs order using EIP-712
3. Order submitted to relayer via API/WebSocket

### 2. Order Monitoring
1. Relayer validates order signature and structure
2. Relayer checks 1inch API for price conditions
3. Relayer monitors on-chain conditions continuously

### 3. Order Execution
1. When conditions are met, resolver triggers execution
2. LOP validates signature and conditions on-chain
3. EscrowFactory deploys new escrow contract
4. Maker funds transferred to escrow
5. Order marked as executed

### 4. Order Settlement
1. Taker provides required assets to escrow
2. Escrow automatically swaps assets between parties
3. Order completed successfully

## 🛡️ Security Features

- **EIP-712 Signatures** - Structured data signing
- **Reentrancy Protection** - All state-changing functions protected
- **Access Control** - Authorized resolvers only
- **Deadline Validation** - Time-bound orders
- **Price Oracle Integration** - Market price validation
- **Emergency Functions** - Owner emergency controls

## 🌍 Supported Networks

| Network | Chain ID | Testnet | Status |
|---------|----------|---------|--------|
| Ethereum | 1 | ❌ | ✅ Ready |
| Sepolia | 11155111 | ✅ | ✅ Ready |
| Etherlink | 128123 | ✅ | ✅ Ready |
| Polygon | 137 | ❌ | ✅ Ready |
| BSC | 56 | ❌ | ✅ Ready |
| Arbitrum | 42161 | ❌ | ✅ Ready |

## 📊 Monitoring & Analytics

The relayer provides comprehensive monitoring:

- **Order Book Status** - Real-time order tracking
- **Execution Metrics** - Success/failure rates
- **Gas Usage** - Transaction cost analysis
- **1inch API Usage** - Rate limiting and quotas
- **WebSocket Connections** - Active client monitoring

## 🚨 Error Handling

Common error scenarios and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid signature` | Wrong signer or corrupted signature | Re-sign order with correct private key |
| `Order conditions not met` | Price/time conditions failed | Wait for better market conditions |
| `Unauthorized resolver` | Resolver not authorized | Contact admin for authorization |
| `Insufficient allowance` | Token approval missing | Approve tokens before order creation |
| `1inch API error` | API rate limit or network issue | Retry with backoff or check API status |

## 🔮 Future Enhancements

- [ ] **Cross-chain Orders** - Orders spanning multiple chains
- [ ] **MEV Protection** - Front-running protection mechanisms  
- [ ] **Batch Execution** - Multiple order execution in single transaction
- [ ] **Advanced Predicates** - More complex condition types
- [ ] **Fee Optimization** - Dynamic fee adjustment based on network conditions
- [ ] **Mobile SDK** - React Native integration
- [ ] **Analytics Dashboard** - Web-based monitoring interface

## 📞 Support

For technical support or questions:

1. Check the error logs in relayer console
2. Verify 1inch API key and rate limits
3. Ensure proper network configuration
4. Check contract deployment addresses

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for the DeFi ecosystem**