const { ethers } = require('ethers');
require('dotenv').config();

async function checkBalance() {
  const rpcUrls = [
    'https://sepolia-rollup.arbitrum.io/rpc',
    'https://arbitrum-sepolia.blockpi.network/v1/rpc/public',
    'https://arbitrum-sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  ];
  
  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`\n🔍 Checking ${rpcUrl}...`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      
      console.log('Wallet address:', wallet.address);
      
      const balance = await provider.getBalance(wallet.address);
      console.log('Balance:', ethers.formatEther(balance), 'ETH');
      
      const network = await provider.getNetwork();
      console.log('Network:', network.name, 'Chain ID:', network.chainId);
      
      if (parseFloat(ethers.formatEther(balance)) > 0) {
        console.log('✅ Found balance! You can deploy now.');
        return;
      }
      
    } catch (error) {
      console.log('❌ RPC failed:', error.message);
    }
  }
  
  console.log('\n💡 If balance is still 0, try these faucets:');
  console.log('1. https://faucet.quicknode.com/arbitrum/sepolia');
  console.log('2. https://www.alchemy.com/faucets/arbitrum-sepolia');
  console.log('3. https://chainlink.faucet.dev/arbitrum-sepolia');
}

checkBalance().catch(console.error);