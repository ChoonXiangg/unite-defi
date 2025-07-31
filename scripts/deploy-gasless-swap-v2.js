const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying GaslessSwapStationV2 to Arbitrum Mainnet...\n");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deploying with account:", deployer.address);
    
    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️  Warning: Low ETH balance for deployment");
    }
    
    // Get network info
    const network = await deployer.provider.getNetwork();
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    if (network.chainId !== 42161n) {
        console.error("❌ Wrong network! Please connect to Arbitrum Mainnet (Chain ID: 42161)");
        process.exit(1);
    }
    
    console.log("\n⏳ Deploying contract...");
    
    // Deploy the contract
    const GaslessSwapStationV2 = await ethers.getContractFactory("GaslessSwapStationV2");
    
    // Estimate gas for deployment
    const deployTx = await GaslessSwapStationV2.getDeployTransaction();
    const gasEstimate = await deployer.estimateGas(deployTx);
    console.log("⛽ Estimated gas:", gasEstimate.toString());
    
    // Deploy with gas settings
    const contract = await GaslessSwapStationV2.deploy({
        gasLimit: gasEstimate + 100000n, // Add 100k gas buffer
        gasPrice: ethers.parseUnits("0.1", "gwei") // Low gas price for Arbitrum
    });
    
    console.log("📝 Transaction hash:", contract.deploymentTransaction().hash);
    console.log("⏳ Waiting for deployment confirmation...");
    
    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log("✅ Contract deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    
    // Get deployment details
    const deployTxReceipt = await contract.deploymentTransaction().wait();
    console.log("🧾 Block number:", deployTxReceipt.blockNumber);
    console.log("⛽ Gas used:", deployTxReceipt.gasUsed.toString());
    console.log("💸 Gas price:", ethers.formatUnits(deployTxReceipt.gasPrice, "gwei"), "gwei");
    
    const deploymentCost = deployTxReceipt.gasUsed * deployTxReceipt.gasPrice;
    console.log("💰 Deployment cost:", ethers.formatEther(deploymentCost), "ETH");
    
    // Verify contract configuration
    console.log("\n🔍 Verifying contract configuration...");
    
    try {
        const version = await contract.version();
        const owner = await contract.owner();
        const feePercent = await contract.feePercent();
        const maxGasPrice = await contract.maxGasPrice();
        const domainSeparator = await contract.getDomainSeparator();
        
        console.log("  📋 Version:", version);
        console.log("  👤 Owner:", owner);
        console.log("  💸 Fee Percent:", feePercent.toString(), `(${Number(feePercent) / 100}%)`);
        console.log("  ⛽ Max Gas Price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
        console.log("  🔏 Domain Separator:", domainSeparator);
        
        // Check 1inch integration addresses
        const INCH_LOP = await contract.INCH_LOP();
        const INCH_ROUTER = await contract.INCH_ROUTER();
        const WETH = await contract.WETH();
        
        console.log("  🔗 1inch LOP:", INCH_LOP);
        console.log("  🔗 1inch Router:", INCH_ROUTER);
        console.log("  🔗 WETH:", WETH);
        
    } catch (error) {
        console.log("⚠️  Could not verify contract configuration:", error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress: contractAddress,
        name: "GaslessSwapStationV2",
        description: "Gasless token swaps using 1inch LOP and liquidity pools",
        version: "2.1.0-gasless-with-1inch",
        owner: deployer.address,
        network: "arbitrum-mainnet",
        chainId: "42161",
        deployedAt: new Date().toISOString(),
        blockNumber: deployTxReceipt.blockNumber,
        txHash: contract.deploymentTransaction().hash,
        gasUsed: deployTxReceipt.gasUsed.toString(),
        deploymentCost: ethers.formatEther(deploymentCost) + " ETH",
        infrastructure: {
            inchLOP: "0x111111125421cA6dc452d289314280a0f8842A65",
            inchRouter: "0x1111111254EEB25477B68fb85Ed929f73A960582",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            eip712Domain: "GaslessSwapStation",
            domainVersion: "2"
        },
        features: {
            feeBasisPoints: 10,
            maxGasPrice: "10 gwei",
            metaTransactions: true,
            gaslessSwaps: true,
            oneInchLOP: true,
            oneInchRouter: true,
            eip712Signing: true
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
        'deployed-gasless-swap-station-v2.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n💾 Deployment info saved to: deployed-gasless-swap-station-v2.json");
    
    console.log("\n🎉 Deployment Summary:");
    console.log("=".repeat(50));
    console.log("Contract Address:", contractAddress);
    console.log("Explorer URL:", deploymentInfo.links.explorer);
    console.log("Version:", deploymentInfo.version);
    console.log("Features: 1inch LOP + Router integration");
    console.log("Gas Cost:", deploymentInfo.deploymentCost);
    console.log("=".repeat(50));
    
    console.log("\n📋 Next Steps:");
    console.log("1. Update frontend with new contract address");
    console.log("2. Update ABI to use struct-based function signature");
    console.log("3. Test gasless swaps end-to-end");
    console.log("4. Consider verifying contract on Arbiscan");
}

main()
    .then(() => {
        console.log("\n✅ Deployment completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });