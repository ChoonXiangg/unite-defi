# Etherlink Escrow Contracts Deployment

This directory contains the deployment configuration and scripts for deploying 1inch Fusion+ escrow contracts on Etherlink (Tezos EVM).

## Overview

The escrow contracts enable cross-chain atomic swaps on Etherlink through 1inch's Fusion+ relayer infrastructure. This implementation includes:

- **EscrowFactory**: Main factory contract for creating escrow instances
- **EscrowSrc**: Source escrow contract for locking funds
- **EscrowDst**: Destination escrow contract for receiving funds
- **BaseEscrow**: Base contract with common functionality

## Configuration

### Network Details

- **Chain ID**: 128123
- **RPC URL (Mainnet)**: https://node.etherlink.com
- **RPC URL (Testnet)**: https://node.etherlink-testnet.com
- **Explorer (Mainnet)**: https://explorer.etherlink.com
- **Explorer (Testnet)**: https://explorer.etherlink-testnet.com

### Contract Addresses

| Contract | Address |
|----------|---------|
| Limit Order Protocol | `0x111111125421cA6dc452d289314280a0f8842A65` |
| Access Token | `0xACCe550000159e70908C0499a1119D04e7039C28` |
| Create3 Deployer | `0x65B3Db8bAeF0215A1F9B14c506D2a3078b2C84AE` |
| Fee Token | `0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C` (Placeholder) |

### Timelock Settings

- **Rescue Delay (Src)**: 691200 seconds (8 days)
- **Rescue Delay (Dst)**: 691200 seconds (8 days)

## Deployment

### Prerequisites

1. Install Foundry:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. Set environment variables:
   ```bash
   export DEPLOYER_ADDRESS="0xYourDeployerAddress"
   export ETHERSCAN_API_KEY="YourEtherscanAPIKey"  # Optional for verification
   ```

### Deploy to Testnet

```bash
./scripts/deploy-etherlink.sh testnet
```

### Deploy to Mainnet

```bash
./scripts/deploy-etherlink.sh mainnet
```

### Manual Deployment

```bash
# Build contracts
forge build --profile etherlink

# Deploy EscrowFactory
forge script script/DeployEscrowFactoryEtherlink.s.sol:DeployEscrowFactoryEtherlink \
    --rpc-url https://node.etherlink-testnet.com \
    --broadcast \
    --verify \
    --profile etherlink
```

## Testing

### Run Tests

```bash
# Run all tests
forge test --profile etherlink

# Run Etherlink specific tests
forge test --match-contract EtherlinkEscrowFactoryTest -vv

# Run with gas reporting
forge test --match-contract EtherlinkEscrowFactoryTest --gas-report
```

### Verify Configuration

```bash
node scripts/verify-etherlink.js
```

## Integration with 1inch Fusion+

### Prerequisites

1. **1inch Limit Order Protocol**: Must be deployed on Etherlink
2. **Access Token**: Required for public withdrawal/cancellation
3. **Fee Token**: Token used for protocol fees (USDC recommended)

### Integration Steps

1. **Deploy EscrowFactory**:
   ```solidity
   EscrowFactory factory = new EscrowFactory(
       limitOrderProtocol,
       feeToken,
       accessToken,
       owner,
       rescueDelaySrc,
       rescueDelayDst
   );
   ```

2. **Register with 1inch Fusion+**:
   - Contact 1inch team to register the deployed EscrowFactory
   - Provide the deployed contract address
   - Configure cross-chain routing parameters

3. **Test Cross-Chain Swaps**:
   - Create test orders on Etherlink
   - Verify escrow creation and execution
   - Test withdrawal and cancellation flows

### Contract Interaction

#### Creating an Escrow

```solidity
// Called by 1inch Limit Order Protocol
factory.postInteraction(
    order,
    maker,
    taker,
    token,
    amount,
    safetyDeposit,
    timelocks
);
```

#### Withdrawing from Escrow

```solidity
// Private withdrawal (taker only)
escrowSrc.withdraw(secret, immutables);

// Public withdrawal (access token holder)
escrowSrc.publicWithdraw(secret, immutables);
```

#### Cancelling Escrow

```solidity
// Private cancellation (taker only)
escrowSrc.cancel(immutables);

// Public cancellation (access token holder)
escrowSrc.publicCancel(immutables);
```

## Security Considerations

1. **Timelock Verification**: Ensure timelock values are appropriate for Etherlink's block time
2. **Access Control**: Verify access token holder permissions
3. **Secret Management**: Implement secure secret generation and verification
4. **Gas Optimization**: Monitor gas costs on Etherlink network
5. **Emergency Procedures**: Test rescue mechanisms thoroughly

## Monitoring

### Key Events to Monitor

- `EscrowCreated`: New escrow contract deployment
- `EscrowWithdrawal`: Successful withdrawal with secret
- `EscrowCancelled`: Cancellation of escrow
- `AccessTokenTransferred`: Changes in access token ownership

### Health Checks

1. **Contract Balance**: Monitor escrow contract balances
2. **Gas Usage**: Track gas consumption patterns
3. **Error Rates**: Monitor failed transactions
4. **Timelock Compliance**: Verify timelock enforcement

## Troubleshooting

### Common Issues

1. **Deployment Fails**:
   - Check RPC URL connectivity
   - Verify deployer address has sufficient balance
   - Ensure all dependencies are properly linked

2. **Tests Fail**:
   - Verify Foundry installation
   - Check contract compilation
   - Ensure test environment is properly configured

3. **Integration Issues**:
   - Verify 1inch LOP address is correct
   - Check access token permissions
   - Ensure fee token is properly configured

### Support

For issues related to:
- **Deployment**: Check deployment logs and gas estimation
- **Integration**: Contact 1inch team for Fusion+ integration
- **Etherlink**: Refer to Etherlink documentation and support

## Files Structure

```
deployments/etherlink/
├── README.md              # This file
├── config.json            # Network configuration
└── EscrowFactory.json     # Deployment artifacts (after deployment)
```

## License

MIT License - see main project license for details. 