import { useState, useEffect } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { WalletService } from "../utils/walletUtils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function NFT() {
  // Wallet states
  const [walletService] = useState(() => new WalletService());
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

  // Owned NFTs (colored/normal display)
  const [ownedNFTs, setOwnedNFTs] = useState([]);

  // Drawable NFTs (excludes pegasus NFTs)
  const drawableNFTs = [
    // Air element parts
    'air body.svg',
    'air head.svg',
    'air horn.svg',
    'air leg.svg',
    'air tail.svg',
    'air wing.svg',
    
    // Earth element parts
    'earth body.svg',
    'earth head.svg',
    'earth horn.svg',
    'earth leg.svg',
    'earth tail.svg',
    'earth wing.svg',
    
    // Fire element parts
    'fire body.svg',
    'fire head.svg',
    'fire horn.svg',
    'fire leg.svg',
    'fire tail.svg',
    'fire wing.svg',
    
    // Rainbow element parts
    'rainbow body.svg',
    'rainbow head.svg',
    'rainbow horn.svg',
    'rainbow leg.svg',
    'rainbow tail.svg',
    'rainbow wing.svg',
    
    // Water element parts
    'water body.svg',
    'water head.svg',
    'water horn.svg',
    'water leg.svg',
    'water tail.svg',
    'water wing.svg'
  ];

  // All possible NFTs in the collection
  const allNFTs = [
    'fire pegasus.svg',
    'air body.svg',
    'water head.svg',
    'rainbow wing.svg',
    'air pegasus.svg',
    'earth pegasus.svg', 
    'rainbow pegasus.svg',
    'water pegasus.svg',
    'air head.svg',
    'air horn.svg',
    'air leg.svg',
    'air tail.svg',
    'air wing.svg',
    'earth body.svg',
    'earth head.svg',
    'earth horn.svg',
    'earth leg.svg',
    'earth tail.svg',
    'earth wing.svg',
    'fire body.svg',
    'fire head.svg',
    'fire horn.svg',
    'fire leg.svg',
    'fire tail.svg',
    'fire wing.svg',
    'rainbow body.svg',
    'rainbow head.svg',
    'rainbow horn.svg',
    'rainbow leg.svg',
    'rainbow tail.svg',
    'water body.svg',
    'water horn.svg',
    'water leg.svg',
    'water tail.svg',
    'water wing.svg'
  ];

  // Filter unowned NFTs dynamically
  const unownedNFTs = allNFTs.filter(nft => !ownedNFTs.includes(nft));

  // Pegasus unlock detection
  const checkForPegasusUnlocks = (ownedNFTsList) => {
    const pegasusTypes = ['air', 'earth', 'fire', 'rainbow', 'water'];
    const requiredParts = ['body', 'head', 'horn', 'leg', 'tail', 'wing'];
    
    // Get already unlocked pegasus from localStorage
    const unlockedPegasus = JSON.parse(localStorage.getItem('unlockedPegasus') || '[]');
    
    for (const pegasusType of pegasusTypes) {
      // Skip if already unlocked
      if (unlockedPegasus.includes(`${pegasusType} pegasus.svg`)) {
        continue;
      }
      
      // Check if all parts are collected
      const collectedParts = requiredParts.filter(part => 
        ownedNFTsList.includes(`${pegasusType} ${part}.svg`)
      );
      
      console.log(`${pegasusType} pegasus: ${collectedParts.length}/6 parts collected`, collectedParts);
      
      if (collectedParts.length === 6) {
        console.log(`🎉 Unlocking ${pegasusType} pegasus!`);
        // All parts collected! Unlock the pegasus
        const newUnlockedPegasus = [...unlockedPegasus, `${pegasusType} pegasus.svg`];
        localStorage.setItem('unlockedPegasus', JSON.stringify(newUnlockedPegasus));
        
        // Add pegasus to owned collection
        const updatedOwnedNFTs = [...ownedNFTsList, `${pegasusType} pegasus.svg`];
        localStorage.setItem('ownedNFTs', JSON.stringify(updatedOwnedNFTs));
        setOwnedNFTs(updatedOwnedNFTs);
        
        // Navigate to unlock celebration page
        console.log(`Navigating to: /pegasus-unlock?pegasus=${pegasusType}`);
        setTimeout(() => {
          window.location.href = `/pegasus-unlock?pegasus=${pegasusType}`;
        }, 500);
        return; // Exit the function after first unlock
      }
    }
  };

  useEffect(() => {
    // Check if wallet is already connected
    const checkWalletConnection = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const { address } = await walletService.connectWallet();
          setWalletConnected(true);
          setWalletAddress(address);
        } catch (error) {
          console.log('Wallet auto-connection failed:', error);
        }
      }
    };
    
    // Load owned NFTs from localStorage
    const loadOwnedNFTs = () => {
      const ownedNFTsStored = JSON.parse(localStorage.getItem('ownedNFTs') || '[]');
      
      // Clean up any incorrect "horm" entries from localStorage
      const cleanedOwnedNFTs = ownedNFTsStored.filter(nft => nft !== 'air horm.svg');
      
      // Update localStorage if we removed any incorrect entries
      if (cleanedOwnedNFTs.length !== ownedNFTsStored.length) {
        localStorage.setItem('ownedNFTs', JSON.stringify(cleanedOwnedNFTs));
      }
      
      setOwnedNFTs(cleanedOwnedNFTs);
      
      // Check for pegasus unlocks
      checkForPegasusUnlocks(cleanedOwnedNFTs);
    };
    
    checkWalletConnection();
    loadOwnedNFTs();
  }, [walletService]);

  const handleOpenChest = () => {
    // Check if all NFTs have been collected
    const drawnNFTsStored = JSON.parse(localStorage.getItem('drawnNFTs') || '[]');
    const availableNFTs = drawableNFTs.filter(nft => !drawnNFTsStored.includes(nft));
    
    if (availableNFTs.length === 0) {
      // All NFTs have been collected
      alert('🎉 Congratulations! You have collected everything in the collection! All NFTs have been unlocked!');
    } else {
      // Still have NFTs to collect, go to chest page
      window.location.href = '/chest-open';
    }
  };

  return (
    <div 
      className={`${geistSans.className} ${geistMono.className} min-h-screen relative`} 
      style={{
        background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
      }}
    >
      
      {/* Navbar with same styling as other pages */}
      <nav className="bg-gray-800/90 backdrop-blur-md border-b border-gray-600/50 sticky top-0 z-50 shadow-xl">
        <div className="max-w-full px-40 py-6">
          <div className="flex items-center justify-between h-12">
            {/* Left side - Title and Nav Links */}
            <div className="flex items-center gap-20">
              {/* Title */}
              <img 
                src="/title.svg"
                alt="PegaSwap"
                onClick={() => window.location.href = '/main'}
                className="h-12 scale-150 cursor-pointer hover:opacity-80 transition-opacity duration-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <h1 
                onClick={() => window.location.href = '/main'}
                className="text-4xl font-bold text-white cursor-pointer hover:text-gray-200 transition-colors hidden"
              >
                PegaSwap
              </h1>
              
              {/* Navigation Links */}
              <div className="flex items-center gap-8 transform translate-y-1">
                <a 
                  href="/portfolio"
                  className="text-xl font-semibold text-gray-300 hover:text-white hover:scale-[1.02] transition-all duration-200 font-supercell"
                >
                  Portfolio
                </a>
                <a 
                  href="/nft"
                  className="text-xl font-semibold text-white hover:scale-[1.02] transition-all duration-200 font-supercell"
                >
                  NFT
                </a>
              </div>
            </div>
            
            {/* Wallet & Settings - Right */}
            <div className="flex items-center gap-4">
              {/* Wallet Address Box */}
              <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-600 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${walletConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-mono text-gray-300">
                    {walletConnected 
                      ? `${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`
                      : 'Not Connected'
                    }
                  </span>
                </div>
              </div>
              
              {/* Settings Icon */}
              <button className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-2 border border-gray-600 shadow-sm hover:bg-gray-600/90 transition-colors">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="main-content flex min-h-[calc(100vh-120px)] p-8 gap-8 relative">
        {/* Left Side - Collections */}
        <div className="collections-sidebar w-1/2">
          <div className="bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white mb-2 font-supercell">Collections</h2>
            </div>
            <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              
              {/* Owned Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white font-supercell">Owned</h3>
                  <span className="text-sm text-gray-400">{ownedNFTs.length} nft</span>
                </div>
                <div className="collections-grid grid grid-cols-4 gap-3 mb-4">
                  {ownedNFTs.map((item, index) => {
                    const itemName = item.replace('.svg', '').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <div 
                        key={`owned-${index}`}
                        className="bg-gray-700/50 rounded-lg border border-gray-600/30 p-3 hover:bg-gray-600/50 transition-colors cursor-pointer"
                      >
                        <div className="aspect-square mb-2">
                          <img 
                            src={`/pegasus/${item}`}
                            alt={itemName}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-300 text-center font-supercell truncate">
                          {itemName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unowned Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white font-supercell">Unowned</h3>
                  <span className="text-sm text-gray-400">{unownedNFTs.length} nft</span>
                </div>
                <div className="collections-grid grid grid-cols-4 gap-3">
                  {unownedNFTs.map((item, index) => {
                    const itemName = item.replace('.svg', '').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <div 
                        key={`unowned-${index}`}
                        className="bg-gray-700/50 rounded-lg border border-gray-600/30 p-3 hover:bg-gray-600/50 transition-colors cursor-pointer"
                      >
                        <div className="aspect-square mb-2">
                          <img 
                            src={`/pegasus/${item}`}
                            alt={itemName}
                            className="w-full h-full object-contain"
                            style={{ filter: 'grayscale(100%)' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-300 text-center font-supercell truncate">
                          {itemName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Content Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-4 font-supercell">Open a Chest</h2>
              <p className="text-gray-300 mb-6 font-supercell">
                Discover rare NFTs from the Pegasus Collection!
              </p>
              <button
                onClick={handleOpenChest}
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 hover:from-yellow-500 hover:via-orange-600 hover:to-red-700 text-white font-bold py-4 px-8 rounded-xl text-lg font-supercell transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                5 PGS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for smooth transitions */}
      <style jsx>{`
        .chest-container {
          transition: all 0.3s ease-in-out;
        }
        
        .chest-container:hover {
          transform: scale(1.05);
        }
        
        @media (max-width: 1024px) {
          .main-content {
            flex-direction: column;
          }
          
          .collections-sidebar {
            width: 100% !important;
            margin-bottom: 2rem;
          }
          
          .collections-grid {
            grid-template-columns: repeat(5, 1fr) !important;
          }
        }
        
        @media (max-width: 768px) {
          .chest-container {
            width: 240px !important;
            height: 180px !important;
          }
          
          .chest-container img {
            width: 144px !important;
            height: 108px !important;
          }
          
          .collections-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          
          .nft-card {
            transform: scale(0.8) !important;
          }
        }
        
        @media (max-width: 480px) {
          .chest-container {
            width: 192px !important;
            height: 144px !important;
          }
          
          .chest-container img {
            width: 120px !important;
            height: 90px !important;
          }
          
          .collections-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          
          .nft-card {
            transform: scale(0.7) !important;
          }
        }
      `}</style>
    </div>
  );
}