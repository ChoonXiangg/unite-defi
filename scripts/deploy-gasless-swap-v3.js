const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying GaslessSwapStationV3 (Production) to Arbitrum Mainnet...\n");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deploying with account:", deployer.address);
    
    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    
    // Get network info
    const network = await deployer.provider.getNetwork();
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    if (network.chainId !== 42161n) {
        console.error("❌ Wrong network! Please connect to Arbitrum Mainnet (Chain ID: 42161)");
        process.exit(1);
    }
    
    console.log("\n⏳ Deploying production contract with real 1inch integration...");
    
    // Deploy the contract
    const GaslessSwapStationV3 = await ethers.getContractFactory("GaslessSwapStationV3");
    
    // Estimate gas for deployment
    const deployTx = await GaslessSwapStationV3.getDeployTransaction();
    const gasEstimate = await deployer.estimateGas(deployTx);
    console.log("⛽ Estimated gas:", gasEstimate.toString());
    
    // Deploy with gas settings
    const contract = await GaslessSwapStationV3.deploy({
        gasLimit: gasEstimate + 100000n,
        gasPrice: ethers.parseUnits("0.1", "gwei")
    });
    
    console.log("📝 Transaction hash:", contract.deploymentTransaction().hash);
    console.log("⏳ Waiting for deployment confirmation...");
    
    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log("✅ Production contract deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    
    // Get deployment details
    const deployTxReceipt = await contract.deploymentTransaction().wait();
    console.log("🧾 Block number:", deployTxReceipt.blockNumber);
    console.log("⛽ Gas used:", deployTxReceipt.gasUsed.toString());
    console.log("💸 Gas price:", ethers.formatUnits(deployTxReceipt.gasPrice, "gwei"), "gwei");
    
    const deploymentCost = deployTxReceipt.gasUsed * deployTxReceipt.gasPrice;
    console.log("💰 Deployment cost:", ethers.formatEther(deploymentCost), "ETH");
    
    // Verify contract configuration
    console.log("\n🔍 Verifying production contract...");
    
    try {
        const version = await contract.version();
        const owner = await contract.owner();
        const feePercent = await contract.feePercent();
        const maxGasPrice = await contract.maxGasPrice();
        const domainSeparator = await contract.getDomainSeparator();
        const paused = await contract.paused();
        
        console.log("  📋 Version:", version);
        console.log("  👤 Owner:", owner);
        console.log("  💸 Fee Percent:", feePercent.toString(), `(${Number(feePercent) / 100}%)`);
        console.log("  ⛽ Max Gas Price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
        console.log("  🔏 Domain Separator:", domainSeparator);
        console.log("  ⏸️  Paused:", paused);
        
        // Check integration addresses
        const INCH_ROUTER = await contract.INCH_ROUTER();
        const WETH = await contract.WETH();
        const ETH = await contract.ETH();
        
        console.log("  🔗 1inch Router:", INCH_ROUTER);
        console.log("  🔗 WETH:", WETH);
        console.log("  🔗 ETH Placeholder:", ETH);
        
    } catch (error) {
        console.log("⚠️  Could not verify contract configuration:", error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress: contractAddress,
        name: "GaslessSwapStationV3",
        description: "Production gasless token swaps with real 1inch Router integration",
        version: "3.0.0-production-1inch",
        owner: deployer.address,
        network: "arbitrum-mainnet",
        chainId: "42161",
        deployedAt: new Date().toISOString(),
        blockNumber: deployTxReceipt.blockNumber,
        txHash: contract.deploymentTransaction().hash,
        gasUsed: deployTxReceipt.gasUsed.toString(),
        deploymentCost: ethers.formatEther(deploymentCost) + " ETH",
        infrastructure: {
            inchRouter: "0x1111111254EEB25477B68fb85Ed929f73A960582",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            eip712Domain: "GaslessSwapStation",
            domainVersion: "3"
        },
        features: {
            feeBasisPoints: 10,
            maxGasPrice: "10 gwei",
            metaTransactions: true,
            gaslessSwaps: true,
            oneInchUnoswap: true,
            oneInchCustomData: true,
            emergencyPause: true,
            eip712Signing: true,
            realLiquidity: true
        },
        links: {
            explorer: `https://arbiscan.io/address/${contractAddress}`,
            bridge: "https://bridge.arbitrum.io/",
            inch: "https://app.1inch.io/#/42161/swap/ETH/USDC"
        }
    };
    
    // Write deployment info to file
    const fs = require('fs');
    fs.writeFileSync(
        'deployed-gasless-swap-station-v3.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n💾 Deployment info saved to: deployed-gasless-swap-station-v3.json");
    
    console.log("\n🎉 Production Deployment Summary:");
    console.log("=".repeat(60));
    console.log("Contract Address:", contractAddress);
    console.log("Explorer URL:", deploymentInfo.links.explorer);
    console.log("Version:", deploymentInfo.version);
    console.log("Features: Real 1inch Router + Unoswap integration");
    console.log("Emergency Pause: Available");
    console.log("Gas Cost:", deploymentInfo.deploymentCost);
    console.log("=".repeat(60));
    
    console.log("\n📋 Next Steps:");
    console.log("1. Update frontend with new V3 contract address");
    console.log("2. Update EIP-712 domain version to '3'");
    console.log("3. Test USDC → ETH swaps with real liquidity");
    console.log("4. Monitor swap success rates");
    console.log("5. Consider contract verification on Arbiscan");
}

main()
    .then(() => {
        console.log("\n✅ Production deployment completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Production deployment failed:", error);
        process.exit(1);
    });