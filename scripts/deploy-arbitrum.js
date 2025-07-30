const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying GasStationExtension to Arbitrum Sepolia...");

  // Get the deployer account
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No signers found!");
    console.error("📋 To fix this:");
    console.error("1. Create a .env file in the project root");
    console.error("2. Add your private key: PRIVATE_KEY=your_private_key_here");
    console.error("3. Get Arbitrum Sepolia ETH from: https://bridge.arbitrum.io/");
    throw new Error("No signers found. Please check your PRIVATE_KEY in .env file");
  }
  
  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. Make sure you have enough ETH for deployment.");
    console.warn("🔗 Get testnet ETH from: https://bridge.arbitrum.io/");
  }

  // Check network
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  
  if (network.chainId !== 421614n && network.chainId !== 42161n) {
    console.warn("⚠️  Warning: Not connected to Arbitrum network");
    console.warn("Expected Chain ID: 42161 (mainnet) or 421614 (sepolia)");
    console.warn("Current Chain ID:", network.chainId.toString());
  }

  // Deploy GasStationExtension with Arbitrum configuration
  console.log("\n📦 Deploying GasStationExtension...");
  
  const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
  
  // Use Arbitrum defaults (pass zero addresses to use ArbitrumConfig defaults)
  const gasStation = await GasStationExtension.deploy(
    ethers.ZeroAddress, // Use ArbitrumConfig.AAVE_POOL
    ethers.ZeroAddress, // Use ArbitrumConfig.WETH  
    ethers.ZeroAddress  // Use ArbitrumConfig.INCH_LOP
  );
  
  console.log("⏳ Waiting for deployment transaction...");
  await gasStation.waitForDeployment();

  const gasStationAddress = await gasStation.getAddress();
  console.log("✅ GasStationExtension deployed to:", gasStationAddress);

  // Get deployment transaction for gas analysis
  const deployTx = gasStation.deploymentTransaction();
  if (deployTx) {
    const receipt = await deployTx.wait();
    console.log("⛽ Gas used for deployment:", receipt.gasUsed.toString());
    console.log("💰 Deployment cost:", ethers.formatEther(receipt.gasUsed * deployTx.gasPrice), "ETH");
  }

  // Verify basic functionality
  console.log("\n🔍 Verifying deployment...");
  const version = await gasStation.version();
  const owner = await gasStation.owner();
  const aavePool = await gasStation.getAavePool();
  const weth = await gasStation.getWETH();
  
  console.log("Contract version:", version);
  console.log("Contract owner:", owner);
  console.log("Aave Pool:", aavePool);
  console.log("WETH:", weth);

  // Test basic functions
  console.log("\n🧪 Testing basic functionality...");
  try {
    const feePoints = await gasStation.GAS_STATION_FEE_BASIS_POINTS();
    const maxGasPrice = await gasStation.MAX_GAS_PRICE();
    
    console.log("Fee basis points:", feePoints.toString());
    console.log("Max gas price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
    
    // Test gas estimation
    const estimatedCost = await gasStation.estimateGasCost(
      ethers.parseUnits("1", "gwei"), // 1 gwei gas price
      260000 // 260k gas limit for dual swap
    );
    console.log("Dual swap gas cost estimate:", ethers.formatEther(estimatedCost), "ETH");
    
    // Test supported tokens
    const supportedTokens = await gasStation.getSupportedTokens();
    console.log("Supported tokens count:", supportedTokens.length);
    
  } catch (error) {
    console.warn("⚠️  Some functions may not work:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.chainId === 42161n ? "arbitrum-mainnet" : "arbitrum-sepolia",
    chainId: network.chainId.toString(),
    gasStationExtension: gasStationAddress,
    deployer: deployer.address,
    blockNumber: await deployer.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    txHash: deployTx?.hash,
    gasUsed: deployTx ? (await deployTx.wait()).gasUsed.toString() : "unknown",
    aavePool: aavePool,
    weth: weth
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Next steps
  console.log("\n📝 Next Steps:");
  console.log("1. ✅ Contract deployed with real Arbitrum infrastructure");
  console.log("2. ✅ Aave V3 integration ready for ETH flash loans");
  console.log("3. ✅ 1inch Limit Order Protocol integration ready");
  console.log("4. 🔄 Add 1inch order execution functions");
  console.log("5. 🧪 Test flash loan + 1inch swap integration");
  
  console.log("\n🔗 Useful Links:");
  console.log("- Explorer:", network.chainId === 42161n ? 
    `https://arbiscan.io/address/${gasStationAddress}` :
    `https://sepolia.arbiscan.io/address/${gasStationAddress}`);
  console.log("- Bridge: https://bridge.arbitrum.io/");
  console.log("- Faucet: https://faucet.quicknode.com/arbitrum/sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });