const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying GasStationExtension to Etherlink...");

  // Get the deployer account
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No signers found!");
    console.error("📋 To fix this:");
    console.error("1. Create a .env file in the project root");
    console.error("2. Add your private key: PRIVATE_KEY=your_private_key_here");
    console.error("3. Get Etherlink XTZ from: https://faucet.etherlink.com/");
    console.error("4. See .env.example for template");
    throw new Error("No signers found. Please check your PRIVATE_KEY in .env file");
  }
  
  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "XTZ");
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low balance. Make sure you have enough XTZ for deployment.");
    console.warn("🔗 Get testnet XTZ from: https://faucet.etherlink.com/");
  }

  // Check network
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  
  if (network.chainId !== 42793n && network.chainId !== 128123n) {
    console.warn("⚠️  Warning: Not connected to Etherlink network");
    console.warn("Expected Chain ID: 42793 (mainnet) or 128123 (testnet)");
    console.warn("Current Chain ID:", network.chainId.toString());
  }

  // Deploy GasStationExtension with custom configuration for Etherlink
  // Note: Since Etherlink doesn't have Aave yet, we'll deploy a basic version
  console.log("\n📦 Deploying GasStationExtension...");
  
  const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
  
  // For Etherlink, we'll use zero addresses initially since infrastructure is limited
  // This will use fallback mechanisms in the contract
  const gasStation = await GasStationExtension.deploy(
    ethers.ZeroAddress, // No Aave pool yet on Etherlink
    ethers.ZeroAddress  // No WXTZ deployed yet
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
    console.log("💰 Deployment cost:", ethers.formatEther(receipt.gasUsed * deployTx.gasPrice), "XTZ");
  }

  // Verify basic functionality
  console.log("\n🔍 Verifying deployment...");
  const version = await gasStation.version();
  const owner = await gasStation.owner();
  
  console.log("Contract version:", version);
  console.log("Contract owner:", owner);

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
      150000 // 150k gas limit
    );
    console.log("Sample gas cost estimate:", ethers.formatEther(estimatedCost), "XTZ");
    
  } catch (error) {
    console.warn("⚠️  Some functions may not work without full infrastructure");
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.chainId === 42793n ? "etherlink-mainnet" : "etherlink-testnet",
    chainId: network.chainId.toString(),
    gasStationExtension: gasStationAddress,
    deployer: deployer.address,
    blockNumber: await deployer.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    txHash: deployTx?.hash,
    gasUsed: deployTx ? (await deployTx.wait()).gasUsed.toString() : "unknown"
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Next steps
  console.log("\n📝 Next Steps:");
  console.log("1. The contract is deployed but has limited functionality");
  console.log("2. Etherlink ecosystem is still developing - flash loan providers needed");
  console.log("3. Consider building custom flash loan mechanism or waiting for infrastructure");
  console.log("4. Test basic order pairing functionality");
  console.log("5. Monitor Etherlink ecosystem for DeFi infrastructure development");
  
  console.log("\n🔗 Useful Links:");
  console.log("- Explorer:", network.chainId === 42793n ? 
    `https://explorer.etherlink.com/address/${gasStationAddress}` :
    `https://testnet.explorer.etherlink.com/address/${gasStationAddress}`);
  console.log("- Faucet: https://faucet.etherlink.com/");
  console.log("- Docs: https://docs.etherlink.com/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });