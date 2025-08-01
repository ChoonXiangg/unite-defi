# 🚀 Foundry Deployment Instructions

## 📋 Prerequisites

### 1. Ubuntu/WSL Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required tools
sudo apt install -y curl git build-essential
```

### 2. Install Foundry
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Restart shell or source bashrc
source ~/.bashrc

# Update Foundry
foundryup
```

### 3. Verify Installation
```bash
forge --version
cast --version
anvil --version
```

## 🔧 Project Setup

### 1. Navigate to Project
```bash
cd /path/to/unite-defi
```

### 2. Make Deploy Script Executable
```bash
chmod +x deploy-foundry.sh
```

### 3. Verify Environment Variables
```bash
# Check your .env file has:
cat .env | grep -E "(PRIVATE_KEY|ETHERLINK_TESTNET_RPC_URL)"
```

Required variables:
- `PRIVATE_KEY` - Your wallet private key
- `ETHERLINK_TESTNET_RPC_URL` - Etherlink RPC URL
- `ETHERSCAN_API_KEY` - For contract verification (optional)

## 🚀 Deploy on Etherlink

### Option 1: Automated Script
```bash
./deploy-foundry.sh
```

### Option 2: Manual Commands
```bash
# 1. Install dependencies
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# 2. Build contracts
forge build

# 3. Deploy to Etherlink
forge script script/DeployLOP.s.sol:DeployLOP \
    --rpc-url $ETHERLINK_TESTNET_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    -vvvv
```

## 📊 Expected Output

```
🏆 ETHGlobal Unite - Deploying LimitOrderProtocol
📝 Deploying with account: 0x5e8C9F71b484f082df54bd6473dfbf74aBbA266D
💰 Account balance: 0.5 ETH
🌐 Chain ID: 128123
📍 Network: Etherlink Testnet

📋 Deploying LimitOrderProtocol...
✅ LimitOrderProtocol deployed to: 0x1234567890123456789012345678901234567890

⚙️  Configuring cross-chain support...
✅ Sepolia EscrowFactory configured: 0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312
✅ Etherlink EscrowFactory configured: 0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff

🔐 Setting up authorizations...
✅ Resolver authorized: 0x5e8C9F71b484f082df54bd6473dfbf74aBbA266D
✅ Price relayer authorized: 0x5e8C9F71b484f082df54bd6473dfbf74aBbA266D

🏆 HACKATHON SUBMISSION READY!
📋 Contract Details:
   Address: 0x1234567890123456789012345678901234567890
   Network: Etherlink Testnet
   Chain ID: 128123
   Deployer: 0x5e8C9F71b484f082df54bd6473dfbf74aBbA266D

📝 Add to your .env:
ETHERLINK_HYBRID_LOP_ADDRESS=0x1234567890123456789012345678901234567890
```

## 🔧 Troubleshooting

### Common Issues:

1. **"forge: command not found"**
   ```bash
   # Reinstall Foundry
   curl -L https://foundry.paradigm.xyz | bash
   source ~/.bashrc
   foundryup
   ```

2. **"insufficient funds for gas"**
   ```bash
   # Get Etherlink testnet ETH
   # Visit: https://faucet.etherlink.com/
   ```

3. **"RPC URL not responding"**
   ```bash
   # Test RPC connection
   cast chain-id --rpc-url $ETHERLINK_TESTNET_RPC_URL
   ```

4. **"Private key format error"**
   ```bash
   # Ensure private key is 64 characters (no 0x prefix in .env)
   echo $PRIVATE_KEY | wc -c  # Should be 65 (64 + newline)
   ```

### Verification Issues:
```bash
# If verification fails, verify manually later:
forge verify-contract \
    --chain-id 128123 \
    --num-of-optimizations 200 \
    --constructor-args $(cast abi-encode "constructor(address,string,string)" $DEPLOYER_ADDRESS "EtherlinkLOP" "1") \
    $CONTRACT_ADDRESS \
    LimitOrderProtocol/LimitOrderProtocol.sol:LimitOrderProtocol \
    --etherscan-api-key $ETHERSCAN_API_KEY
```

## ✅ Post-Deployment

### 1. Update Environment
```bash
# Add deployed address to .env
echo "ETHERLINK_HYBRID_LOP_ADDRESS=0x1234567890123456789012345678901234567890" >> .env
```

### 2. Start Relayer System
```bash
cd Relayer
npm install
npm start
```

### 3. Test Deployment
```bash
# Run demo CLI
node demo-cli.js

# Or test specific functions
cast call $ETHERLINK_HYBRID_LOP_ADDRESS "owner()" --rpc-url $ETHERLINK_TESTNET_RPC_URL
```

## 🏆 Ready for Judging!

Your LimitOrderProtocol is now deployed on Etherlink and ready for the ETHGlobal Unite hackathon judging!

### Demo Commands for Judges:
```bash
# 1. Show contract on Etherlink
cast call $ETHERLINK_HYBRID_LOP_ADDRESS "owner()" --rpc-url $ETHERLINK_TESTNET_RPC_URL

# 2. Start relayer system
cd Relayer && npm start

# 3. Run interactive demo
node demo-cli.js

# 4. Show 1inch integration
curl "http://localhost:3001/api/quote?fromToken=0x0&toToken=0xA0b...&amount=1000000000000000000&chainId=128123"
```