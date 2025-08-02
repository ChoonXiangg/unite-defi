import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function ChestOpen() {
  const router = useRouter();
  const [isChestOpen, setIsChestOpen] = useState(false);
  const [drawnNFT, setDrawnNFT] = useState(null);
  const [showNFTCard, setShowNFTCard] = useState(false);

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

  // TEST-MODE: seed drawnNFTs so only rainbow parts remain
  useEffect(() => {
    if (!localStorage.getItem('initialPresetComplete')) return;
    const drawn = JSON.parse(localStorage.getItem('drawnNFTs') || '[]');
    if (drawn.length === 0) {
      // mark all non-rainbow parts as already drawn
      const defaultDrawn = drawableNFTs.filter(nft => !nft.startsWith('rainbow '));
      localStorage.setItem('drawnNFTs', JSON.stringify(defaultDrawn));
    }
  }, []);

  const drawRandomNFT = () => {
    // Get drawn NFTs from localStorage
    const drawnNFTsStored = JSON.parse(localStorage.getItem('drawnNFTs') || '[]');
    
    // Filter out already drawn NFTs
    const availableNFTs = drawableNFTs.filter(nft => !drawnNFTsStored.includes(nft));
    
    if (availableNFTs.length === 0) {
      // All NFTs have been drawn
      return null;
    }
    
    // Pick random NFT from available ones
    const randomIndex = Math.floor(Math.random() * availableNFTs.length);
    const selectedNFT = availableNFTs[randomIndex];
    
    // Add to drawn NFTs in localStorage
    const updatedDrawnNFTs = [...drawnNFTsStored, selectedNFT];
    localStorage.setItem('drawnNFTs', JSON.stringify(updatedDrawnNFTs));
    
    return selectedNFT;
  };

  const handleChestClick = () => {
    if (!isChestOpen) {
      // Opening chest - draw an NFT
      const newNFT = drawRandomNFT();
      if (newNFT) {
        setDrawnNFT(newNFT);
        setIsChestOpen(true);
        
        // Show NFT card after chest opens
        setTimeout(() => {
          setShowNFTCard(true);
        }, 500);
      } else {
        // All NFTs have been collected
        alert('🎉 Congratulations! You have collected everything in the collection! All NFTs have been unlocked!');
      }
    }
  };

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
      
      console.log(`Chest: ${pegasusType} pegasus: ${collectedParts.length}/6 parts collected`, collectedParts);
      
      if (collectedParts.length === 6) {
        console.log(`🎉 Chest: Unlocking ${pegasusType} pegasus!`);
        // All parts collected! Unlock the pegasus
        const newUnlockedPegasus = [...unlockedPegasus, `${pegasusType} pegasus.svg`];
        localStorage.setItem('unlockedPegasus', JSON.stringify(newUnlockedPegasus));
        
        // Add pegasus to owned collection
        const updatedOwnedNFTs = [...ownedNFTsList, `${pegasusType} pegasus.svg`];
        localStorage.setItem('ownedNFTs', JSON.stringify(updatedOwnedNFTs));
        
        // Navigate to unlock celebration page instead of NFT page
        console.log(`Chest: Navigating to: /pegasus-unlock?pegasus=${pegasusType}`);
        router.push(`/pegasus-unlock?pegasus=${pegasusType}`);
        return true; // Indicate that unlock happened
      }
    }
    
    return false; // No unlock happened
  };

  const handlePageClick = (e) => {
    // Close NFT card and return to NFT page if clicking anywhere except the chest or NFT card
    if (showNFTCard && !e.target.closest('.chest-container') && !e.target.closest('.nft-card')) {
      // Add NFT to owned collection in localStorage
      if (drawnNFT) {
        const ownedNFTs = JSON.parse(localStorage.getItem('ownedNFTs') || '[]');
        const updatedOwnedNFTs = [...ownedNFTs, drawnNFT];
        localStorage.setItem('ownedNFTs', JSON.stringify(updatedOwnedNFTs));
        
        // Check for pegasus unlocks before returning
        const unlockHappened = checkForPegasusUnlocks(updatedOwnedNFTs);
        
        // Only return to NFT page if no unlock happened
        if (!unlockHappened) {
          router.push('/nft');
        }
      } else {
        // Return to NFT page if no NFT was drawn
        router.push('/nft');
      }
    }
  };

  return (
    <div 
      className={`${geistSans.className} ${geistMono.className} min-h-screen relative`} 
      style={{
        background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
      }}
      onClick={handlePageClick}
    >
      {/* Chest Container - Middle Bottom */}
<div className="flex items-end justify-center min-h-screen pb-16">
        <div 
          className={`chest-container relative w-80 h-60 cursor-pointer ${!isChestOpen ? 'animate-bounce-slow' : ''}`}
          onClick={handleChestClick}
        >
          {/* Closed chest */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
              isChestOpen ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <img 
              src="/close-chest-original.svg" 
              alt="Closed Chest" 
              className="w-72 h-54 object-contain"
            />
          </div>
          
          {/* Open chest */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
              isChestOpen ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img 
              src="/open-chest-original.svg" 
              alt="Open Chest" 
              className="w-72 h-54 object-contain"
            />
          </div>
          
          {/* Glow effect when open */}
          <div 
            className={`absolute inset-0 rounded-full transition-opacity duration-500 ease-in-out ${
              isChestOpen ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              background: 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)',
              filter: 'blur(8px)',
              transform: 'scale(1.2)'
            }}
          ></div>
        </div>
      </div>

      {/* NFT Card Popup - Above Chest */}
      {drawnNFT && (
        <div 
          className={`absolute bottom-[26rem] left-1/2 transform -translate-x-1/2 pointer-events-none transition-all duration-700 ease-out ${
            showNFTCard 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-8 scale-75'
          }`}
        >
          <div className="nft-card bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 p-1 rounded-2xl shadow-2xl pointer-events-auto" style={{ transform: 'scale(1.2)' }}>
            <div className="bg-gray-900 rounded-xl p-4 w-[196px]">
              {/* Card Header */}
              <div className="text-center mb-3">
                <h3 className="text-lg font-bold text-yellow-400 font-supercell mb-1">
                  NFT Acquired!
                </h3>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
              </div>
              
              {/* NFT Image */}
              <div className="aspect-square mb-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                <img 
                  src={`/pegasus/${drawnNFT}`}
                  alt={drawnNFT.replace('.svg', '').replace(/\b\w/g, l => l.toUpperCase())}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              
              {/* NFT Name */}
              <div className="text-center">
                <h4 className="text-sm font-semibold text-white font-supercell mb-1">
                  {drawnNFT.replace('.svg', '').replace(/\b\w/g, l => l.toUpperCase())}
                </h4>
                <p className="text-xs text-gray-400">
                  Pegasus Collection
                </p>
              </div>
              
              {/* Sparkle effect */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping"></div>
                <div className="absolute top-6 left-4 w-1 h-1 bg-white rounded-full animate-pulse"></div>
                <div className="absolute bottom-4 right-6 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-3 left-3 w-0.5 h-0.5 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        .chest-container {
          transition: all 0.3s ease-in-out;
        }
        
        .chest-container:hover {
          transform: scale(1.05);
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }
        
        @keyframes bounce-slow {
          0%, 20%, 53%, 80%, 100% {
            transform: translateY(0);
          }
          40%, 43% {
            transform: translateY(-15px);
          }
          70% {
            transform: translateY(-8px);
          }
          90% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  );
}