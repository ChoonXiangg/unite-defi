const { ethers } = require('ethers');

async function verifyContract() {
  const contractAddress = '0x2Dd87c65Dc14E084eFEfDc9EA76b8162354590B9';
  const provider = new ethers.JsonRpcProvider('https://sepolia.drpc.org');
  
  try {
    // Check if address has code (indicates it's a contract)
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      console.log('❌ No contract found at this address');
      return;
    }
    
    console.log('✅ Contract found!');
    console.log('Contract bytecode length:', code.length);
    
    // Get contract creation details
    const balance = await provider.getBalance(contractAddress);
    console.log('Contract balance:', ethers.formatEther(balance), 'ETH');
    
    // Try to get transaction count (number of transactions from this address)
    const txCount = await provider.getTransactionCount(contractAddress);
    console.log('Transaction count:', txCount);
    
  } catch (error) {
    console.error('Error verifying contract:', error);
  }
}

verifyContract();