const { ethers } = require('ethers');

// Transaction data from the error (second transaction - actual swap)
const txData = "0xde2a4c360000000000000000000000007184b01a8a9ac24428bb8d3925701d151920c9ce000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000ed60cc49500000000000000000000000000000000000000000000000000000000000688b87b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000004128eb53615ba07a5b74bff8c382a45787333092f14a5f8f33dc9c25d0cb5ddfff5153fbca636e9bfa91a93e423837b5c9c16de970122d4cf3660ecd5f218dd2b11b00000000000000000000000000000000000000000000000000000000000000";

// ABI for decoding
const abi = [
  'function executeGaslessSwap(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce, bytes signature)'
];

try {
  const iface = new ethers.Interface(abi);
  const decoded = iface.parseTransaction({ data: txData });
  
  console.log('🔍 Decoded transaction parameters:');
  console.log('Function:', decoded.name);
  console.log('Parameters:');
  console.log('  user:', decoded.args[0]);
  console.log('  fromToken:', decoded.args[1]);
  console.log('  toToken:', decoded.args[2]);
  console.log('  fromAmount:', decoded.args[3].toString());
  console.log('  minToAmount:', decoded.args[4].toString());
  console.log('  deadline:', decoded.args[5].toString());
  console.log('  nonce:', decoded.args[6].toString());
  console.log('  signature length:', decoded.args[7].length);
  console.log('  signature:', decoded.args[7]);
  
  // Convert amounts to human readable
  console.log('\n📊 Human readable amounts:');
  console.log('  fromAmount (USDC):', ethers.formatUnits(decoded.args[3], 6));
  console.log('  minToAmount (ETH):', ethers.formatUnits(decoded.args[4], 18));
  console.log('  deadline (timestamp):', new Date(Number(decoded.args[5]) * 1000).toLocaleString());
  
} catch (error) {
  console.error('Error decoding transaction:', error);
}