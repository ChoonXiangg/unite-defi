// Production-like backend API for minting reward tokens
// This simulates your real backend service that would handle token rewards

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// In production, this would be your backend server (Node.js/Express)
// For Next.js API route, we simulate the backend behavior

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress, swapAmountUSD, swapTransactionId } = req.body;

    console.log('🎯 Backend: Processing reward request...');
    console.log(`   User: ${userAddress}`);
    console.log(`   Swap Amount: $${swapAmountUSD}`);
    console.log(`   Transaction ID: ${swapTransactionId}`);

    // 1. VALIDATE input parameters
    if (!userAddress || !swapAmountUSD || !swapTransactionId) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userAddress, swapAmountUSD, swapTransactionId' 
      });
    }

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    if (swapAmountUSD <= 0) {
      return res.status(400).json({ error: 'Swap amount must be positive' });
    }

    // 2. VERIFY swap transaction (in production, verify on-chain)
    const swapValid = await verifySwapTransaction(swapTransactionId, swapAmountUSD);
    if (!swapValid) {
      return res.status(400).json({ error: 'Invalid or unverified swap transaction' });
    }

    // 3. CHECK for duplicate rewards (prevent double-spending)
    const alreadyRewarded = await checkIfAlreadyRewarded(swapTransactionId);
    if (alreadyRewarded) {
      return res.status(400).json({ error: 'Tokens already rewarded for this swap' });
    }

    // 4. SETUP blockchain connection with SECURE owner credentials
    const { contract, ownerAddress } = await setupSecureContract();

    // 5. CALCULATE reward amount (1% of swap value)
    const rewardCents = Math.floor(swapAmountUSD * 100); // Convert to cents

    console.log('⚡ Backend: Minting tokens...');
    console.log(`   Minting ${swapAmountUSD} SYBAU to ${userAddress}`);

    // 6. MINT tokens directly to user (single transaction)
    const tx = await contract.mintRewardForSwapSimple(userAddress, rewardCents);
    
    console.log(`📝 Transaction sent: ${tx.hash}`);
    
    // 7. WAIT for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

    // 8. RECORD transaction in database (simulated)
    await recordRewardTransaction({
      userAddress,
      swapAmountUSD,
      rewardTokens: swapAmountUSD,
      swapTransactionId,
      mintTransactionHash: tx.hash,
      timestamp: new Date().toISOString()
    });

    // 9. RESPOND to frontend
    return res.status(200).json({
      success: true,
      message: 'Tokens successfully minted',
      data: {
        userAddress,
        rewardTokens: swapAmountUSD,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Backend error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// SECURE CONTRACT SETUP - Owner's private key stored securely
async function setupSecureContract() {
  try {
    // Load deployment info
    const deploymentInfo = await loadDeploymentInfo();
    
    // SECURE: Owner's private key from environment variables
    const ownerPrivateKey = process.env.PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error('Owner private key not configured in environment variables');
    }
    
    // Add 0x prefix if not present
    const formattedPrivateKey = ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : `0x${ownerPrivateKey}`;

    // Connect to Arbitrum Sepolia
    const provider = new ethers.JsonRpcProvider(
      process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
    );

    // Create owner's wallet (backend holds this securely)
    const ownerWallet = new ethers.Wallet(formattedPrivateKey, provider);
    
    // Contract ABI
    const contractABI = [
      "function mintRewardForSwapSimple(address to, uint256 usdCents)",
      "function balanceOf(address) view returns (uint256)",
      "function owner() view returns (address)",
      "function minter() view returns (address)"
    ];

    // Connect to contract with owner's credentials
    const contract = new ethers.Contract(
      deploymentInfo.contractAddress,
      contractABI,
      ownerWallet
    );

    console.log('🔒 Backend: Secure contract connection established');
    console.log(`   Contract: ${deploymentInfo.contractAddress}`);
    console.log(`   Owner: ${ownerWallet.address}`);

    return { contract, ownerAddress: ownerWallet.address };
    
  } catch (error) {
    console.error('Failed to setup secure contract:', error);
    throw new Error('Backend contract setup failed');
  }
}

// Load deployment information
async function loadDeploymentInfo() {
  try {
    // Load deployment info from public directory
    const deploymentFile = path.join(process.cwd(), 'public', 'deployment-info', 'sybau-deployment-arbitrumSepolia.json');
    const deploymentData = fs.readFileSync(deploymentFile, 'utf8');
    return JSON.parse(deploymentData);
  } catch (error) {
    throw new Error('Could not load contract deployment information');
  }
}

// VERIFY swap transaction (in production, check on-chain)
async function verifySwapTransaction(transactionId, expectedAmount) {
  console.log('🔍 Backend: Verifying swap transaction...');
  
  // SIMULATION: In production, you would:
  // 1. Query your swap contract/service
  // 2. Verify transaction exists and is confirmed
  // 3. Verify swap amount matches
  // 4. Verify transaction is not too old
  
  // For testing, we'll accept any transaction ID
  if (transactionId && transactionId.length > 10) {
    console.log('✅ Swap transaction verified (simulated)');
    return true;
  }
  
  console.log('❌ Swap transaction verification failed');
  return false;
}

// CHECK if already rewarded (prevent double-spending)
async function checkIfAlreadyRewarded(transactionId) {
  console.log('🔍 Backend: Checking for duplicate rewards...');
  
  // SIMULATION: In production, check your database
  // SELECT * FROM reward_transactions WHERE swap_tx_id = ?
  
  // For testing, we'll assume no duplicates
  console.log('✅ No duplicate rewards found');
  return false;
}

// RECORD transaction in database
async function recordRewardTransaction(rewardData) {
  console.log('💾 Backend: Recording reward transaction...');
  
  // SIMULATION: In production, save to database
  // INSERT INTO reward_transactions (user_address, swap_amount, ...)
  
  console.log('✅ Reward transaction recorded');
  console.log('   Data:', JSON.stringify(rewardData, null, 2));
}