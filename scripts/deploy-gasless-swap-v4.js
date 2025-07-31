const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying GaslessSwapStationV4 (Uniswap V3) to Arbitrum Mainnet...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deploying with account:", deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    
    const network = await deployer.provider.getNetwork();
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    if (network.chainId !== 42161n) {
        console.error("❌ Wrong network! Please connect to Arbitrum Mainnet");
        process.exit(1);
    }
    
    console.log("\n⏳ Deploying V4 contract with Uniswap V3 integration...");
    
    const GaslessSwapStationV4 = await ethers.getContractFactory("GaslessSwapStationV4");
    
    const deployTx = await GaslessSwapStationV4.getDeployTransaction();
    const gasEstimate = await deployer.estimateGas(deployTx);
    console.log("⛽ Estimated gas:", gasEstimate.toString());
    
    const contract = await GaslessSwapStationV4.deploy({
        gasLimit: gasEstimate + 100000n,
        gasPrice: ethers.parseUnits("0.1", "gwei")
    });
    
    console.log("📝 Transaction hash:", contract.deploymentTransaction().hash);
    console.log("⏳ Waiting for deployment confirmation...");
    
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log("✅ V4 Contract deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    
    const deployTxReceipt = await contract.deploymentTransaction().wait();
    console.log("🧾 Block number:", deployTxReceipt.blockNumber);
    console.log("⛽ Gas used:", deployTxReceipt.gasUsed.toString());
    
    const deploymentCost = deployTxReceipt.gasUsed * deployTxReceipt.gasPrice;
    console.log("💰 Deployment cost:", ethers.formatEther(deploymentCost), "ETH");
    
    // Verify contract
    console.log("\n🔍 Verifying V4 contract...");
    
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
        
        const UNISWAP_V3_ROUTER = await contract.UNISWAP_V3_ROUTER();
        const WETH = await contract.WETH();
        const ETH = await contract.ETH();
        
        console.log("  🦄 Uniswap V3 Router:", UNISWAP_V3_ROUTER);
        console.log("  🔗 WETH:", WETH);
        console.log("  🔗 ETH Placeholder:", ETH);
        
        // Test Uniswap V3 Router connectivity
        const routerCode = await deployer.provider.getCode(UNISWAP_V3_ROUTER);
        console.log("  🧪 Uniswap V3 Router code size:", routerCode.length, "bytes");
        
        if (routerCode.length > 2) {
            console.log("  ✅ Uniswap V3 Router is accessible");
        } else {
            console.log("  ❌ Uniswap V3 Router not found");
        }
        
    } catch (error) {
        console.log("⚠️  Could not verify contract:", error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress: contractAddress,
        name: "GaslessSwapStationV4",
        description: "Gasless token swaps using Uniswap V3 (reliable and battle-tested)",
        version: "4.0.0-uniswap-v3",
        owner: deployer.address,
        network: "arbitrum-mainnet",
        chainId: "42161",
        deployedAt: new Date().toISOString(),
        blockNumber: deployTxReceipt.blockNumber,
        txHash: contract.deploymentTransaction().hash,
        gasUsed: deployTxReceipt.gasUsed.toString(),
        deploymentCost: ethers.formatEther(deploymentCost) + " ETH",
        infrastructure: {
            uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            eip712Domain: "GaslessSwapStation",
            domainVersion: "4"
        },
        features: {
            feeBasisPoints: 10,
            maxGasPrice: "20 gwei",
            metaTransactions: true,
            gaslessSwaps: true,
            uniswapV3: true,
            multipleFeeTeirs: true,
            emergencyPause: true,
            eip712Signing: true,
            deepLiquidity: true
        },
        links: {
            explorer: `https://arbiscan.io/address/${contractAddress}`,
            uniswap: "https://app.uniswap.org/#/swap?chain=arbitrum"
        }
    };
    
    const fs = require('fs');
    fs.writeFileSync(
        'deployed-gasless-swap-station-v4.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n💾 Deployment info saved to: deployed-gasless-swap-station-v4.json");
    
    console.log("\n🎉 V4 Deployment Summary:");
    console.log("=".repeat(60));
    console.log("Contract Address:", contractAddress);
    console.log("Explorer URL:", deploymentInfo.links.explorer);
    console.log("Version:", deploymentInfo.version); 
    console.log("DEX: Uniswap V3 (deep liquidity)");
    console.log("Fee Tiers: 0.05%, 0.3%, 1% (automatic fallback)");
    console.log("Gas Cost:", deploymentInfo.deploymentCost);
    console.log("=".repeat(60));
    
    console.log("\n📋 Next Steps:");
    console.log("1. Update frontend with V4 contract address");
    console.log("2. Update EIP-712 domain version to '4'");
    console.log("3. Test USDC → ETH swaps (should work now!)");
    console.log("4. Monitor successful swap transactions");
}

main()
    .then(() => {
        console.log("\n✅ V4 deployment completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ V4 deployment failed:", error);
        process.exit(1);
    });