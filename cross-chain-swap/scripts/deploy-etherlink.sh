#!/bin/bash

# Deploy EscrowFactory to Etherlink
# Usage: ./scripts/deploy-etherlink.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}
DEPLOYER_ADDRESS=${DEPLOYER_ADDRESS:-""}

if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "Error: DEPLOYER_ADDRESS environment variable is required"
    echo "Usage: DEPLOYER_ADDRESS=0x... ./scripts/deploy-etherlink.sh [testnet|mainnet]"
    exit 1
fi

echo "Deploying to Etherlink $NETWORK..."
echo "Deployer address: $DEPLOYER_ADDRESS"

# Set RPC URL based on network
if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://node.etherlink.com"
    CHAIN_ID="128123"
    echo "Deploying to Etherlink Mainnet"
elif [ "$NETWORK" = "testnet" ]; then
    RPC_URL="https://node.ghostnet.etherlink.com"
    CHAIN_ID="128123"
    echo "Deploying to Etherlink Testnet"
else
    echo "Error: Invalid network. Use 'testnet' or 'mainnet'"
    exit 1
fi

# Export environment variables
export DEPLOYER_ADDRESS
export RPC_URL
export CHAIN_ID

# Build contracts
echo "Building contracts..."
forge build --profile etherlink

# Deploy EscrowFactory
echo "Deploying EscrowFactory..."
forge script script/DeployEscrowFactoryEtherlink.s.sol:DeployEscrowFactoryEtherlink \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --profile etherlink

echo "Deployment completed!"
echo "Check the broadcast folder for deployment details" 