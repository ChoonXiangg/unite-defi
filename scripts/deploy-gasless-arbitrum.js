const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("🚀 Deploying GaslessSwapStation to Arbitrum mainnet...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying from account:", deployer.address);
    
    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️  Warning: Low ETH balance. Deployment may fail.");
    }
    
    // Get contract factory
    console.log("\n📋 Getting contract factory...");
    const GaslessSwapStation = await ethers.getContractFactory("GaslessSwapStation");
    
    // Estimate deployment gas
    const deploymentData = GaslessSwapStation.getDeployTransaction();
    const gasEstimate = await deployer.estimateGas(deploymentData);
    const gasPrice = await deployer.provider.getFeeData();
    
    console.log("⛽ Estimated gas:", gasEstimate.toString());
    console.log("💵 Gas price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
    console.log("💸 Estimated cost:", 
        ethers.formatEther(gasEstimate * gasPrice.gasPrice), "ETH");
    
    // Deploy contract
    console.log("\n🔨 Deploying contract...");
    const gaslessSwapStation = await GaslessSwapStation.deploy({
        gasLimit: 3000000, // Fixed higher gas limit for complex contract
        gasPrice: gasPrice.gasPrice
    });
    
    // Wait for deployment
    console.log("⏳ Waiting for deployment transaction...");
    await gaslessSwapStation.waitForDeployment();
    
    const contractAddress = await gaslessSwapStation.getAddress();
    const deploymentTx = gaslessSwapStation.deploymentTransaction();
    
    console.log("✅ Contract deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    console.log("🔗 Transaction hash:", deploymentTx.hash);
    
    // Wait for confirmation
    console.log("\n⏳ Waiting for block confirmations...");
    const receipt = await deploymentTx.wait(3); // Wait for 3 confirmations
    
    console.log("📦 Block number:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    console.log("💰 Deployment cost:", 
        ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "ETH");
    
    // Verify contract configuration
    console.log("\n🔍 Verifying contract configuration...");
    try {
        const version = await gaslessSwapStation.version();
        const feePercent = await gaslessSwapStation.feePercent();
        const maxGasPrice = await gaslessSwapStation.maxGasPrice();
        const owner = await gaslessSwapStation.owner();
        
        console.log("📊 Contract version:", version);
        console.log("💵 Fee percentage:", feePercent.toString(), "basis points");
        console.log("⛽ Max gas price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
        console.log("👤 Owner:", owner);
    } catch (error) {
        console.log("⚠️ Could not verify configuration:", error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress: contractAddress,
        name: "GaslessSwapStation",
        description: "Truly gasless token swaps using 1inch + meta-transactions",
        version: "2.0.0-gasless",
        owner: deployer.address,
        network: "arbitrum-mainnet",
        chainId: "42161",
        deployedAt: new Date().toISOString(),
        blockNumber: receipt.blockNumber,
        txHash: deploymentTx.hash,
        gasUsed: receipt.gasUsed.toString(),
        deploymentCost: ethers.formatEther(receipt.gasUsed * receipt.gasPrice) + " ETH",
        infrastructure: {
            inchLOP: "0x111111125421cA6dc452d289314280a0f8842A65",
            eip712Domain: "GaslessSwapStation",
            domainVersion: "1"
        },
        features: {
            feeBasisPoints: 10,
            maxGasPrice: "10 gwei",
            metaTransactions: true,
            gaslessSwaps: true,
            flashLoanEnabled: false,
            eip712Signing: true
        },
        links: {
            explorer: `https://arbiscan.io/address/${contractAddress}`,
            bridge: "https://bridge.arbitrum.io/",
            inch: "https://app.1inch.io/#/42161/swap/ETH/USDC"
        }
    };
    
    // Write deployment info to file
    const filename = 'deployed-gasless-swap-station.json';
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to ${filename}`);
    
    // Display final summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📍 Contract: ${contractAddress}`);
    console.log(`🔗 Explorer: https://arbiscan.io/address/${contractAddress}`);
    console.log(`💰 Cost: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH`);
    console.log(`📋 Architecture: Meta-transactions + 1inch integration`);
    console.log(`🚫 Flash loans: Removed (no longer needed)`);
    console.log(`✅ Gasless swaps: Fully supported`);
    console.log("=".repeat(60));
    
    // Next steps
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Update frontend to use new contract address");
    console.log("2. Integrate 1inch Swap API for aggregation fallback");
    console.log("3. Test meta-transaction signing flow");
    console.log("4. Fund contract with ETH for gas costs");
    console.log("5. Configure fee parameters if needed");
    
    return {
        contractAddress,
        deploymentInfo
    };
}

// Handle errors
main()
    .then((result) => {
        console.log("\n✅ Deployment script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });