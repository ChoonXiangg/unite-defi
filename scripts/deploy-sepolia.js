const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying GasStationExtension to Sepolia testnet...");

  // Get the deployer account
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No signers found!");
    console.error("📋 To fix this:");
    console.error("1. Create a .env file in the project root");
    console.error("2. Add your private key: PRIVATE_KEY=your_private_key_here");
    console.error("3. Get Sepolia ETH from: https://sepoliafaucet.com/");
    console.error("4. See .env.example for template");
    throw new Error("No signers found. Please check your PRIVATE_KEY in .env file");
  }
  
  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. Make sure you have enough Sepolia ETH for deployment.");
  }

  // Deploy GasStationExtension (use zero addresses for Sepolia defaults)
  const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
  const gasStation = await GasStationExtension.deploy(
    ethers.ZeroAddress, // Use Sepolia default Aave Pool
    ethers.ZeroAddress  // Use Sepolia default WETH
  );
  await gasStation.waitForDeployment();

  const gasStationAddress = await gasStation.getAddress();
  console.log("GasStationExtension deployed to:", gasStationAddress);

  // Verify configuration
  console.log("\n=== Configuration Verification ===");
  const aavePool = await gasStation.getAavePool();
  const weth = await gasStation.getWETH();
  const version = await gasStation.version();
  const supportedTokens = await gasStation.getSupportedTokens();

  console.log("Aave Pool:", aavePool);
  console.log("WETH:", weth);
  console.log("Version:", version);
  console.log("Supported tokens:", supportedTokens);

  // Test token support
  console.log("\n=== Token Support Test ===");
  const ethSupported = await gasStation.isTokenSupported(ethers.ZeroAddress);
  const wethSupported = await gasStation.isTokenSupported(weth);
  console.log("Native ETH supported:", ethSupported);
  console.log("WETH supported:", wethSupported);

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    gasStationExtension: gasStationAddress,
    aavePool: aavePool,
    weth: weth,
    deployer: deployer.address,
    blockNumber: await deployer.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Complete ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${gasStationAddress}`);
  console.log("\n2. Test flash loan functionality (make sure you have testnet ETH):");
  console.log("   - Register order pairs");
  console.log("   - Initiate flash loan swaps");
  console.log("\n3. Get testnet tokens from faucets:");
  console.log("   - ETH: https://sepoliafaucet.com/");
  console.log("   - USDC/USDT: Use Aave testnet faucet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });