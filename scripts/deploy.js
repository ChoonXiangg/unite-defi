const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Unite DeFi NFT contract...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Wallet balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance < hre.ethers.parseEther("0.01")) {
    console.error("❌ Insufficient ETH for deployment. Need at least 0.01 ETH");
    console.log("Get Sepolia ETH from: https://sepoliafaucet.com/");
    return;
  }
  
  // Deploy contract
  const CustomNFT = await hre.ethers.getContractFactory("CustomNFT");
  const nft = await CustomNFT.deploy(
    "Unite DeFi NFT",      // name
    "UNITE",               // symbol
    "",                    // baseURI
    "Unite DeFi NFT Collection", // description
    deployer.address,      // royaltyReceiver
    500                    // royaltyFeeBps (5%)
  );
  
  await nft.waitForDeployment();
  const address = await nft.getAddress();
  
  console.log("✅ Contract deployed to:", address);
  // Determine explorer URL based on network
  const network = hre.network.name;
  let explorerUrl;
  if (network === 'arbitrum') {
    explorerUrl = `https://arbiscan.io/address/${address}`;
  } else if (network === 'arbitrumSepolia') {
    explorerUrl = `https://sepolia.arbiscan.io/address/${address}`;
  } else {
    explorerUrl = `https://sepolia.etherscan.io/address/${address}`;
  }
  
  console.log("🔍 Verify on block explorer:", explorerUrl);
  
  // Save contract info for the application
  const contractInfo = {
    contractAddress: address,
    name: "Unite DeFi NFT",
    symbol: "UNITE",
    description: "Unite DeFi NFT Collection",
    baseURI: "",
    owner: deployer.address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    royaltyReceiver: deployer.address,
    royaltyFeeBps: 500,
    totalSupply: 0
  };
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '..', 'data', 'nft-contracts');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Save contract info
  fs.writeFileSync(
    path.join(dataDir, `${address}.json`), 
    JSON.stringify(contractInfo, null, 2)
  );
  
  // Also save to root for reference
  fs.writeFileSync('deployed-contract.json', JSON.stringify(contractInfo, null, 2));
  
  console.log("💾 Contract info saved to data/nft-contracts/ and deployed-contract.json");
  console.log("🎉 Deployment complete! You can now use this contract for minting NFTs.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});