# 🚀 ResolverTriggeredLOP - Advanced Limit Order Protocol

A comprehensive Limit Order Protocol designed to be triggered by resolvers with full **1inch API integration** and seamless connection to your deployed **EscrowFactory** contracts.

## 🏗️ Architecture Overview

```
User Creates Order → Relayer Validates → Resolver Picks Up → LOP Executes → EscrowFactory Deploys → Funds Locked
       ↓                    ↓                ↓               ↓                    ↓                ↓
   EIP-712 Sign      1inch Price Check   Profitability   Signature Valid    Escrow Contract    Cross-Chain
                     Predicate Check      Analysis        Conditions Met     Fund Transfer      Settlement
```

## 🎯 Key Features

### ✅ **1inch API Integration**
- **Price Validation**: Validates order prices against 1inch oracle
- **Slippage Protection**: Configurable slippage tolerance
- **Multi-Chain Support**: Works on chains where 1inch is deployed
- **Fallback Handling**: Graceful degradation when 1inch unavailable

### ✅ **Resolver-Triggered Execution**
- **Authorization System**: Only authorized resolvers can execute orders
- **Signature Validation**: EIP-712 compliant order verification
- **Condition Checking**: Comprehensive pre-execution validation
- **Gas Optimization**: Efficient execution flow

### ✅ **EscrowFactory Integration**
- **Direct Integration**: Works with your deployed EscrowFactory contracts
- **Cross-Chain Ready**: Supports Sepolia ↔ Etherlink
- **Deterministic Addresses**: Predictable escrow contract addresses
- **Safety Deposits**: Configurable safety deposit calculations

### ✅ **Advanced Order Features**
- **Custom Predicates**: Programmable order conditions
- **Hash-Lock Support**: Secret-based cross-chain settlements
- **Flexible Takers**: Support for any-taker or specific-taker orders
- **Deadline Management**: Automatic expiration handling

## 📋 **1inch API Support Matrix**

| Chain | Chain ID | 1inch Oracle | 1inch Router | Status |
|-------|----------|--------------|--------------|--------|
| Ethereum | 1 | ✅ | ✅ | **Supported** |
| Polygon | 137 | ✅ | ✅ | **Supported** |
| BSC | 56 | ✅ | ✅ | **Supported** |
| Arbitrum | 42161 | ✅ | ✅ | **Supported** |
| Optimism | 10 | ✅ | ✅ | **Supported** |
| Avalanche | 43114 | ✅ | ✅ | **Supported** |
| Sepolia | 11155111 | ❌ | ❌ | **Testnet - No 1inch** |
| Etherlink | 128123 | ❌ | ❌ | **No 1inch deployment** |

**Note**: On chains without 1inch, price validation is automatically skipped.

## 🚀 **Deployment**

### **1. Deploy the LOP Contract**

```bash
# Deploy on Sepolia
npm run deploy:resolver-lop:sepolia

# Deploy on Etherlink  
npm run deploy:resolver-lop:etherlink
```

### **2. Configure Your Environment**

Add to your `.env`:
```bash
# LOP Contract Addresses (update after deployment)
SEPOLIA_LOP_ADDRESS=0x...
ETHERLINK_LOP_ADDRESS=0x...

# Your existing EscrowFactory addresses
SEPOLIA_ESCROW_FACTORY_ADDRESS=0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312
ETHERLINK_ESCROW_FACTORY_ADDRESS=0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff
```

### **3. Authorize Resolvers**

```javascript
const lop = await ethers.getContractAt("ResolverTriggeredLOP", lopAddress);
await lop.setResolverAuthorization(resolverAddress, true);
```

## 🔄 **Complete Workflow**

### **Phase 1: Order Creation**

```javascript
// 1. User creates order
const order = {
    maker: "0xUserAddress",
    taker: "0x0000000000000000000000000000000000000000", // Any resolver
    makerAsset: "0xUSDC_ADDRESS",
    takerAsset: "0xWETH_ADDRESS",
    makerAmount: "1000000", // 1 USDC
    takerAmount: "500000000000000000", // 0.5 WETH
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    salt: Date.now(),
    secretHash: ethers.keccak256(secret), // For cross-chain
    sourceChain: 11155111, // Sepolia
    destinationChain: 128123, // Etherlink
    predicate: "0x", // Custom conditions
    maxSlippage: 100, // 1% slippage tolerance
    use1inchValidation: true // Enable 1inch price checks
};

// 2. User signs order (EIP-712)
const signature = await signer.signTypedData(domain, types, order);

// 3. Submit to relayer
await relayer.createOrder(order, signature);
```

### **Phase 2: Resolver Execution**

```javascript
// 1. Resolver picks up profitable order
const orders = await relayer.getPendingOrders();
const profitableOrder = await resolver.analyzeProfitability(orders);

// 2. Resolver executes via LOP
const lopIntegration = new LOPIntegration();
const result = await lopIntegration.executeOrder(
    profitableOrder, 
    signature, 
    'sepolia'
);

console.log("Escrow deployed:", result.escrowAddress);
```

### **Phase 3: LOP Processing**

The LOP contract performs these steps automatically:

1. **✅ Signature Validation**
   ```solidity
   require(validateOrderSignature(order, signature), "Invalid signature");
   ```

2. **✅ Condition Validation**
   ```solidity
   // Check deadline, balance, allowance
   require(validateOrderConditions(order), "Conditions not met");
   ```

3. **✅ 1inch Price Validation** (if enabled)
   ```solidity
   if (order.use1inchValidation) {
       uint256 oracleRate = IOneInchV6Oracle(oracle).getRate(makerAsset, takerAsset, true);
       uint256 orderRate = (takerAmount * 1e18) / makerAmount;
       uint256 minRate = (oracleRate * (10000 - maxSlippage)) / 10000;
       require(orderRate >= minRate, "Price deviation too high");
   }
   ```

4. **✅ Custom Predicate Execution**
   ```solidity
   if (predicate.length > 0) {
       (bool success, bytes memory result) = address(this).staticcall(predicate);
       require(success && abi.decode(result, (bool)), "Predicate failed");
   }
   ```

5. **✅ Fund Transfer**
   ```solidity
   // Pull funds from user to LOP contract
   IERC20(makerAsset).safeTransferFrom(maker, address(this), makerAmount);
   ```

6. **✅ Escrow Deployment**
   ```solidity
   // Call your EscrowFactory
   IYourEscrowFactory(escrowFactory).createDstEscrow(immutables, cancellationTime);
   ```

## 🔧 **Integration Examples**

### **Using with Enhanced Relayer**

```javascript
// Update enhanced-relayer.js
const LOPIntegration = require('./lop-integration.js');

class EnhancedRelayer {
    constructor() {
        this.lopIntegration = new LOPIntegration({
            sepoliaLOPAddress: process.env.SEPOLIA_LOP_ADDRESS,
            etherlinkLOPAddress: process.env.ETHERLINK_LOP_ADDRESS
        });
    }

    async executeOrderViaLOP(order, signature) {
        const network = this.getNetworkName(order.sourceChain);
        return await this.lopIntegration.executeOrder(order, signature, network);
    }
}
```

### **Using with Resolver**

```javascript
// Update resolver.js
const LOPIntegration = require('./lop-integration.js');

class OrderResolver {
    constructor() {
        this.lopIntegration = new LOPIntegration();
    }

    async executeOrder(order) {
        // Check 1inch support
        const oneInchSupported = await this.lopIntegration.isOneInchSupported(
            order.sourceChain, 
            this.getNetworkName(order.sourceChain)
        );

        if (oneInchSupported) {
            // Get current 1inch rate
            const rate = await this.lopIntegration.getOneInchRate(
                order.sourceChain,
                order.makerAsset,
                order.takerAsset,
                this.getNetworkName(order.sourceChain)
            );
            console.log("Current 1inch rate:", rate);
        }

        // Execute order
        return await this.lopIntegration.executeOrder(
            order, 
            order.signature, 
            this.getNetworkName(order.sourceChain)
        );
    }
}
```

## 📊 **Monitoring & Events**

### **Event Monitoring**

```javascript
const lopIntegration = new LOPIntegration();

await lopIntegration.monitorEvents('sepolia', (event) => {
    switch (event.type) {
        case 'OrderExecuted':
            console.log(`Order ${event.orderHash} executed`);
            console.log(`Escrow: ${event.escrowContract}`);
            break;
            
        case 'OneInchPriceValidated':
            console.log(`Price validation: ${event.valid}`);
            console.log(`Oracle rate: ${event.oracleRate}`);
            console.log(`Order rate: ${event.orderRate}`);
            break;
    }
});
```

### **Order Status Tracking**

```javascript
// Check order status
const status = await lopIntegration.getOrderStatus(orderHash, 'sepolia');
console.log(`Order status: ${status.statusName}`); // pending/executed/cancelled

// Get escrow address
const escrowAddress = await lopIntegration.getOrderEscrow(orderHash, 'sepolia');
console.log(`Escrow deployed at: ${escrowAddress}`);
```

## 🔒 **Security Features**

### **Authorization System**
- Only authorized resolvers can execute orders
- Owner-controlled resolver management
- Emergency functions for contract owner

### **Signature Validation**
- EIP-712 compliant order signing
- Prevents signature replay attacks
- Validates maker authorization

### **Price Protection**
- 1inch oracle integration for fair pricing
- Configurable slippage tolerance
- Automatic fallback when oracle unavailable

### **Condition Validation**
- Balance and allowance checks
- Deadline enforcement
- Custom predicate execution

## 🚨 **Error Handling**

### **Common Errors**

| Error | Cause | Solution |
|-------|-------|----------|
| `LOP: Unauthorized resolver` | Resolver not authorized | Call `setResolverAuthorization()` |
| `LOP: Invalid signature` | Wrong signature or order data | Verify EIP-712 signing |
| `LOP: Order conditions not met` | Balance/allowance/deadline issues | Check user funds and timing |
| `LOP: EscrowFactory not set` | Factory not configured | Call `setEscrowFactory()` |

### **1inch Integration Errors**

| Scenario | Behavior |
|----------|----------|
| 1inch not deployed on chain | Price validation skipped |
| Oracle call fails | Validation passes (fail-safe) |
| Price deviation too high | Order execution rejected |
| Token pair not supported | Validation skipped |

## 🎯 **Next Steps**

1. **Deploy the LOP contracts** on your target chains
2. **Update your relayer** to use the new LOP integration
3. **Authorize your resolvers** to execute orders
4. **Test with sample orders** to verify functionality
5. **Monitor events** for real-time order tracking

## 📞 **Support**

The ResolverTriggeredLOP is designed to work seamlessly with:
- ✅ Your deployed EscrowFactory contracts
- ✅ 1inch API on supported chains  
- ✅ Your existing relayer infrastructure
- ✅ Cross-chain order settlement

For any issues or questions, check the error handling section or review the integration examples.

---

**🎉 Your LOP is now ready for production use with full 1inch integration and EscrowFactory compatibility!**