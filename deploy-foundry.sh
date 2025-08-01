#!/bin/bash

# 🏆 ETHGlobal Unite - Foundry Deployment Script
# Deploy LimitOrderProtocol on Etherlink using Foundry

echo "🏆 ETHGlobal Unite - Foundry Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "foundry.toml" ]; then
    echo -e "${RED}❌ foundry.toml not found. Please run from project root.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found. Please create it with your configuration.${NC}"
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

if [ -z "$ETHERLINK_TESTNET_RPC_URL" ]; then
    echo -e "${RED}❌ ETHERLINK_TESTNET_RPC_URL not set in .env${NC}"
    exit 1
fi

echo -e "${BLUE}📡 Checking Foundry installation...${NC}"

# Check if Foundry is installed
if ! command -v forge &> /dev/null; then
    echo -e "${YELLOW}⚠️  Foundry not found. Installing...${NC}"
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
fi

echo -e "${GREEN}✅ Foundry is ready${NC}"

# Initialize Foundry project if needed
if [ ! -d "lib" ]; then
    echo -e "${BLUE}📦 Initializing Foundry project...${NC}"
    forge init --no-commit --force
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# Build the project
echo -e "${BLUE}🔨 Building contracts...${NC}"
forge build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy to Etherlink
echo -e "${BLUE}🚀 Deploying to Etherlink...${NC}"
echo "Network: Etherlink Testnet"
echo "RPC: $ETHERLINK_TESTNET_RPC_URL"

forge script script/DeployLOP.s.sol:DeployLOP \
    --rpc-url $ETHERLINK_TESTNET_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    -vvvv

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Copy the deployed contract address from above"
    echo "2. Add it to your .env file as ETHERLINK_HYBRID_LOP_ADDRESS"
    echo "3. Start your relayer: cd Relayer && npm start"
    echo "4. Run the demo: node demo-cli.js"
    echo ""
    echo -e "${GREEN}🏆 Ready for ETHGlobal Unite judging!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi