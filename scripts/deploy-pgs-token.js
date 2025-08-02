// PGS Token Deployment Script
// This script deploys the UniteRewardToken contract (PGS Token)
// Can be used for local testing, testnet, and mainnet deployment

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting PGS Token Deployment...");
  
  // Get the network we're deploying to
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deploying with account: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  // Get the contract factory
  console.log("📝 Getting UniteRewardToken contract factory...");
  const PgsToken = await ethers.getContractFactory("UniteRewardToken");
  
  // Deploy the contract
  console.log("⚡ Deploying PGS Token contract...");
  const pgsToken = await PgsToken.deploy();

  // Wait for deployment to be mined
  console.log("⏳ Waiting for deployment transaction to be mined...");
  await pgsToken.waitForDeployment();
  
  // Get the deployed contract address
  const contractAddress = await pgsToken.getAddress();
  console.log(`✅ PGS Token deployed to: ${contractAddress}`);
  
  // Verify the deployment by calling contract functions
  console.log("🔍 Verifying deployment...");
  const tokenName = await pgsToken.name();
  const tokenSymbol = await pgsToken.symbol();
  const tokenDecimals = await pgsToken.decimals();
  const totalSupply = await pgsToken.totalSupply();
  const owner = await pgsToken.owner();
  const minter = await pgsToken.minter();
  
  console.log("📊 Contract Details:");
  console.log(`   Name: ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  console.log(`   Decimals: ${tokenDecimals}`);
  console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Minter: ${minter}`);
  
  // Test the reward calculation function with dynamic pricing
  console.log("🧮 Testing dynamic pricing system...");
  
  // Get current pricing info
  const [currentMultiplier, totalSwapped, nextHalveningAt, halvenings, tokensPerDollar] = 
    await pgsToken.getPricingInfo();
  
  console.log("📊 Dynamic Pricing Status:");
  console.log(`   Current rate: 1 PGS = $${Number(currentMultiplier).toFixed(2)}`);
  console.log(`   Total USD swapped: $${ethers.formatEther(totalSwapped)}`);
  console.log(`   Next halvening at: $${ethers.formatEther(nextHalveningAt)}`);
  console.log(`   Halvenings completed: ${halvenings.toString()}`);
  console.log(`   Tokens per $1: ${ethers.formatEther(tokensPerDollar)}`);
  
  // Test reward calculation
  const testUsdCents = 10000; // $100.00
  const expectedReward = await pgsToken.calculateReward(testUsdCents);
  console.log(`   $100 swap = ${ethers.formatEther(expectedReward)} ${tokenSymbol} tokens (at current rate)`);
  
  // Save deployment info for frontend integration  
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    tokenName: tokenName,
    tokenSymbol: tokenSymbol,
    tokenDecimals: tokenDecimals.toString(),
    deploymentTimestamp: new Date().toISOString(),
    deploymentBlockNumber: (await ethers.provider.getBlockNumber()).toString(),
    contractABI: [
      // Essential ABI for frontend integration with dynamic pricing
      "function name() view returns (string)",
      "function symbol() view returns (string)", 
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      
      // Token generation with dynamic pricing
      "function mintRewardForSwapSimple(address to, uint256 usdCents)",
      "function calculateReward(uint256 usdCents) view returns (uint256)",
      
      // Dynamic pricing functions
      "function getPricingInfo() view returns (uint256, uint256, uint256, uint256, uint256)",
      "function simulateTotalSupply(uint256 targetUsdSwapped) view returns (uint256)",
      "function totalUsdSwapped() view returns (uint256)",
      "function currentPriceMultiplier() view returns (uint256)",
      "function halveningCount() view returns (uint256)",
      "function manualHalvening()",
      
      // Token usage functions
      "function spendTokens(uint256 amount, string memory itemName)",
      "function transferToUser(address to, uint256 amount, string memory message)",
      
      // Access control
      "function owner() view returns (address)",
      "function minter() view returns (address)",
      "function setMinter(address newMinter)",
      "function paused() view returns (bool)",
      "function pause()",
      "function unpause()",
      
      // Events
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Mint(address indexed to, uint256 amount, string reason)",
      "event UserTransfer(address indexed from, address indexed to, uint256 amount, string message)",
      "event Halvening(uint256 indexed halveningNumber, uint256 newPriceMultiplier, uint256 totalUsdSwapped)",
      "event SwapProcessed(address indexed user, uint256 usdAmount, uint256 tokensEarned, uint256 currentMultiplier)"
    ]
  };
  
  // Create deployment-info directory in public folder for frontend access
  const deploymentDir = path.join(__dirname, "..", "public", "deployment-info");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Save deployment info to file (use chainId for consistent naming)
  const networkName = network.chainId === 421614n ? 'arbitrumSepolia' : network.name;
  const deploymentFile = path.join(deploymentDir, `pgs-deployment-${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentFile}`);
  
  // Display summary
  console.log("\n🎉 Deployment Summary:");
  console.log("================================");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Network: ${network.name}`);
  console.log(`Token: ${tokenName} (${tokenSymbol})`);
  console.log(`Owner/Minter: ${deployer.address}`);
  console.log(`Initial Rate: 1 PGS = $${Number(currentMultiplier).toFixed(2)}`);
  console.log(`Dynamic Pricing: ✅ Enabled`);
  console.log(`Supply Control: ✅ Approaching ~2000 PGS`);
  
  if (network.name === "localhost" || network.chainId === 31337n) {
    console.log("\n🔧 Next Steps for Local Testing:");
    console.log("1. Update your frontend to use this contract address");
    console.log("2. Make sure your local Hardhat node is running");
    console.log("3. Connect MetaMask to localhost:8545");
    console.log("4. Test token generation in your frontend");
  } else {
    console.log(`\n🌐 View on Block Explorer: ${getBlockExplorerUrl(network.chainId, contractAddress)}`);
  }
  
  return {
    contractAddress,
    deploymentInfo
  };
}

// Helper function to get block explorer URL
function getBlockExplorerUrl(chainId, address) {
  const explorers = {
    421614: `https://sepolia.arbiscan.io/address/${address}`, // Arbitrum Sepolia
    42161: `https://arbiscan.io/address/${address}`, // Arbitrum One
    11155111: `https://sepolia.etherscan.io/address/${address}`, // Ethereum Sepolia
    1: `https://etherscan.io/address/${address}`, // Ethereum Mainnet
  };
  
  return explorers[chainId] || `Unknown network (${chainId})`;
}

// Handle errors properly
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });