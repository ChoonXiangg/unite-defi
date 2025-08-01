// API endpoint to get current PGS token dynamic pricing information
// Returns halvening status, current rates, and supply projections

import { ethers } from 'ethers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 Fetching PGS token pricing information...');

    // Load contract address from deployment info
    let contractAddress;
    try {
      // Try Arbitrum One (mainnet) first
      let response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/deployment-info/pgs-deployment-arbitrumOne.json`);
      
      if (!response.ok) {
        // Fallback to Arbitrum Sepolia
        response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/deployment-info/pgs-deployment-arbitrumSepolia.json`);
      }
      
      if (!response.ok) {
        // Final fallback to regular sepolia
        response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/deployment-info/pgs-deployment-sepolia.json`);
      }
      
      if (response.ok) {
        const deploymentInfo = await response.json();
        contractAddress = deploymentInfo.contractAddress;
      } else {
        throw new Error('Deployment info not found');
      }
    } catch (error) {
      return res.status(500).json({
        error: 'Contract deployment info not found',
        message: 'Please deploy the contract first'
      });
    }

    // Create provider (Arbitrum One)
    const provider = new ethers.JsonRpcProvider(
      process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
    );

    // Contract ABI for pricing functions
    const contractABI = [
      "function getPricingInfo() view returns (uint256, uint256, uint256, uint256, uint256)",
      "function totalSupply() view returns (uint256)",
      "function simulateTotalSupply(uint256 targetUsdSwapped) view returns (uint256)",
      "function name() view returns (string)",
      "function symbol() view returns (string)"
    ];

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Get current pricing information
    const [currentMultiplier, totalSwapped, nextHalveningAt, halvenings, tokensPerDollar] = 
      await contract.getPricingInfo();
    
    const currentSupply = await contract.totalSupply();

    // Calculate progress to next halvening
    const progressAmount = totalSwapped;
    const targetAmount = nextHalveningAt;
    const progressPercentage = targetAmount > 0n ? 
      (Number(progressAmount * 10000n / targetAmount) / 100).toFixed(2) : '0.00';

    // Simulate total supply at key milestones
    const projections = [];
    const milestones = [100000, 200000, 300000, 400000, 500000, 1000000]; // USD amounts
    
    for (const milestone of milestones) {
      try {
        const targetUsdWei = ethers.parseEther(milestone.toString());
        const projectedSupply = await contract.simulateTotalSupply(targetUsdWei);
        projections.push({
          usdSwapped: milestone,
          estimatedSupply: ethers.formatEther(projectedSupply),
          halveningNumber: Math.floor(milestone / 100000)
        });
      } catch (error) {
        console.warn(`Failed to calculate projection for ${milestone}:`, error.message);
      }
    }

    // Format the response
    const pricingInfo = {
      contract: {
        address: contractAddress,
        name: await contract.name(),
        symbol: await contract.symbol()
      },
      currentState: {
        priceMultiplier: currentMultiplier.toString(),
        currentRate: `1 PGS = $${(Number(currentMultiplier) / 100).toFixed(2)}`,
        tokensPerDollar: ethers.formatEther(tokensPerDollar),
        totalUsdSwapped: ethers.formatEther(totalSwapped),
        currentSupply: ethers.formatEther(currentSupply),
        halveningCount: halvenings.toString()
      },
      progress: {
        current: ethers.formatEther(progressAmount),
        target: ethers.formatEther(targetAmount),
        percentage: progressPercentage,
        remaining: ethers.formatEther(targetAmount - progressAmount)
      },
      nextHalvening: {
        at: ethers.formatEther(nextHalveningAt),
        newRate: `1 PGS = $${(Number(currentMultiplier) * 2 / 100).toFixed(2)}`,
        newMultiplier: (Number(currentMultiplier) * 2).toString()
      },
      projections,
      algorithm: {
        description: "Every 100k USD swapped triggers a halvening (2x price increase)",
        pattern: "1000 + 500 + 250 + 125 + ... ≈ 2000 PGS total supply",
        halveningThreshold: "100,000 USD"
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Pricing information fetched successfully');
    console.log(`   Current Rate: ${pricingInfo.currentState.currentRate}`);
    console.log(`   Total Swapped: $${pricingInfo.currentState.totalUsdSwapped}`);
    console.log(`   Progress: ${pricingInfo.progress.percentage}%`);

    return res.status(200).json({
      success: true,
      data: pricingInfo
    });

  } catch (error) {
    console.error('❌ Error fetching pricing information:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch pricing information',
      message: error.message
    });
  }
}