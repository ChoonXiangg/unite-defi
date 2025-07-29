const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Read the compiled contract
const contractPath = path.join(__dirname, 'lib', 'contracts', 'CustomNFT.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

// Manual deployment script
async function deployContract() {
  console.log('🚀 Starting manual NFT contract deployment...');
  
  // Get your wallet private key (you'll need to enter this)
  const privateKey = process.env.DEPLOY_PRIVATE_KEY || prompt('Enter your wallet private key: ');
  
  if (!privateKey) {
    console.error('❌ Private key required for deployment');
    return;
  }
  
  try {
    // Connect to Sepolia
    const provider = new ethers.JsonRpcProvider('https://sepolia.drpc.org');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📍 Deploying from address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance < ethers.parseEther('0.01')) {
      console.error('❌ Insufficient ETH for deployment. Need at least 0.01 ETH');
      console.log('Get Sepolia ETH from: https://sepoliafaucet.com/');
      return;
    }
    
    // Contract details
    const contractDetails = {
      name: 'Unite DeFi NFT',
      symbol: 'UNITE',
      description: 'Unite DeFi NFT Collection',
      baseURI: '',
      royaltyReceiver: wallet.address,
      royaltyFeeBps: 500 // 5%
    };
    
    console.log('📄 Contract details:', contractDetails);
    
    // For this demo, we'll create a simple deployment
    // You can use Hardhat or compile the contract manually
    console.log('⚠️  Manual compilation step required:');
    console.log('1. Install Hardhat: npm install --save-dev hardhat');
    console.log('2. Initialize Hardhat project: npx hardhat');
    console.log('3. Place your CustomNFT.sol in contracts/');
    console.log('4. Run: npx hardhat compile');
    console.log('5. Create deployment script in scripts/');
    
    // Create hardhat config
    const hardhatConfig = `require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: "https://sepolia.drpc.org",
      accounts: ["${privateKey}"]
    }
  }
};`;

    fs.writeFileSync('hardhat.config.js', hardhatConfig);
    
    // Create deployment script
    const deployScript = `const hre = require("hardhat");

async function main() {
  console.log("Deploying Unite DeFi NFT contract...");
  
  const CustomNFT = await hre.ethers.getContractFactory("CustomNFT");
  const nft = await CustomNFT.deploy(
    "Unite DeFi NFT",
    "UNITE",
    "",
    "Unite DeFi NFT Collection",
    "${wallet.address}",
    500
  );
  
  await nft.waitForDeployment();
  const address = await nft.getAddress();
  
  console.log("✅ Contract deployed to:", address);
  console.log("📝 Save this address for your application!");
  
  // Save contract info
  const contractInfo = {
    contractAddress: address,
    name: "Unite DeFi NFT",
    symbol: "UNITE",
    description: "Unite DeFi NFT Collection",
    baseURI: "",
    owner: "${wallet.address}",
    network: "sepolia",
    deployedAt: new Date().toISOString(),
    royaltyReceiver: "${wallet.address}",
    royaltyFeeBps: 500,
    totalSupply: 0
  };
  
  require('fs').writeFileSync('deployed-contract.json', JSON.stringify(contractInfo, null, 2));
  console.log("💾 Contract info saved to deployed-contract.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`;

    if (!fs.existsSync('scripts')) {
      fs.mkdirSync('scripts');
    }
    fs.writeFileSync('scripts/deploy.js', deployScript);
    
    console.log('\n📋 Next steps:');
    console.log('1. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
    console.log('2. Copy your CustomNFT.sol to contracts/ folder');
    console.log('3. npx hardhat compile');
    console.log('4. npx hardhat run scripts/deploy.js --network sepolia');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  deployContract();
}

module.exports = { deployContract };