// SYBAU Token Deployment Script
// This script deploys the UniteRewardToken contract and renames it to SYBAU
// Can be used for local testing, testnet, and mainnet deployment

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting SYBAU Token Deployment...");
  
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
  const SybauToken = await ethers.getContractFactory("UniteRewardToken");
  
  // Deploy the contract
  console.log("⚡ Deploying SYBAU Token contract...");
  const sybauToken = await SybauToken.deploy();

  // Wait for deployment to be mined
  console.log("⏳ Waiting for deployment transaction to be mined...");
  await sybauToken.waitForDeployment();
  
  // Get the deployed contract address
  const contractAddress = await sybauToken.getAddress();
  console.log(`✅ SYBAU Token deployed to: ${contractAddress}`);
  
  // Verify the deployment by calling contract functions
  console.log("🔍 Verifying deployment...");
  const tokenName = await sybauToken.name();
  const tokenSymbol = await sybauToken.symbol();
  const tokenDecimals = await sybauToken.decimals();
  const totalSupply = await sybauToken.totalSupply();
  const owner = await sybauToken.owner();
  const minter = await sybauToken.minter();
  
  console.log("📊 Contract Details:");
  console.log(`   Name: ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  console.log(`   Decimals: ${tokenDecimals}`);
  console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Minter: ${minter}`);
  
  // Test the reward calculation function
  console.log("🧮 Testing reward calculation...");
  const testUsdCents = 10000; // $100.00
  const expectedReward = await sybauToken.calculateReward(testUsdCents);
  console.log(`   $100 swap = ${ethers.formatEther(expectedReward)} ${tokenSymbol} tokens`);
  
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
      // Essential ABI for frontend integration
      "function name() view returns (string)",
      "function symbol() view returns (string)", 
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function mintRewardForSwapSimple(address to, uint256 usdCents)",
      "function calculateReward(uint256 usdCents) view returns (uint256)",
      "function spendTokens(uint256 amount, string memory itemName)",
      "function transferToUser(address to, uint256 amount, string memory message)",
      "function owner() view returns (address)",
      "function minter() view returns (address)",
      "function setMinter(address newMinter)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Mint(address indexed to, uint256 amount, string reason)",
      "event UserTransfer(address indexed from, address indexed to, uint256 amount, string message)"
    ]
  };
  
  // Create deployment-info directory in public folder for frontend access
  const deploymentDir = path.join(__dirname, "..", "public", "deployment-info");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Save deployment info to file (use chainId for consistent naming)
  const networkName = network.chainId === 421614n ? 'arbitrumSepolia' : network.name;
  const deploymentFile = path.join(deploymentDir, `sybau-deployment-${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentFile}`);
  
  // Display summary
  console.log("\n🎉 Deployment Summary:");
  console.log("================================");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Network: ${network.name}`);
  console.log(`Token: ${tokenName} (${tokenSymbol})`);
  console.log(`Owner/Minter: ${deployer.address}`);
  console.log(`Reward Rate: $100 = 1.0 ${tokenSymbol}`);
  
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