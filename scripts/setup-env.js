const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  console.log("🔧 Setting up environment for Sepolia deployment...");
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log("✅ .env file already exists");
    return;
  }
  
  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    console.error("❌ .env.example not found!");
    return;
  }
  
  // Copy .env.example to .env
  const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
  fs.writeFileSync(envPath, exampleContent);
  
  console.log("✅ Created .env file from template");
  console.log("📋 Next steps:");
  console.log("1. Edit .env file and add your private key");
  console.log("2. Get Sepolia ETH from: https://sepoliafaucet.com/");
  console.log("3. Run: npx hardhat run scripts/deploy-sepolia.js --network sepolia");
  console.log("");
  console.log("⚠️  IMPORTANT: Never commit your .env file to git!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });