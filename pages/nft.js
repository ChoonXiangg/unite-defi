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
  const [expandedPegasus, setExpandedPegasus] = useState(null);
  const [equippedPegasus, setEquippedPegasus] = useState(null);
  const [pgsBalance, setPgsBalance] = useState(0);

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
  const elementOrder = ['air','earth','fire','rainbow','water'];
  const partOrder    = ['head','body','horn','leg','tail','wing'];

  // Separate owned NFTs into Pegasus and body parts
  const ownedPegasusRaw = ownedNFTs.filter(nft => nft.includes('pegasus.svg'));
  const ownedBodyParts = ownedNFTs.filter(nft => !nft.includes('pegasus.svg'));
  
  // Order Pegasus with equipped one first
  const ownedPegasus = ownedPegasusRaw.sort((a, b) => {
    if (equippedPegasus === a) return -1;
    if (equippedPegasus === b) return 1;
    return 0;
  });


  const unownedNFTs = allNFTs
    .filter(nft => !ownedNFTs.includes(nft))
    .sort((a, b) => {
      const [elemA, partA] = a.split(' ');
      const [elemB, partB] = b.split(' ');
      const isPegasusA = partA === 'pegasus.svg';
      const isPegasusB = partB === 'pegasus.svg';
      // Pegasus first
      if (isPegasusA !== isPegasusB) return isPegasusA ? -1 : 1;
      // Then by element order
      const elemIndexA = elementOrder.indexOf(elemA);
      const elemIndexB = elementOrder.indexOf(elemB);
      if (elemIndexA !== elemIndexB) return elemIndexA - elemIndexB;
      // Then body-part order
      return partOrder.indexOf(partA.replace('.svg','')) 
           - partOrder.indexOf(partB.replace('.svg',''));
    });

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
      // --- TEST-MODE PRESET: only run once ---
      if (!localStorage.getItem('initialPresetComplete')) {
        // 1) Own everything except rainbow
        const defaultOwned = allNFTs.filter(nft => !nft.startsWith('rainbow '));
        localStorage.setItem('ownedNFTs', JSON.stringify(defaultOwned));

        // 2) Mark all non-rainbow Pegasi as already unlocked
        const defaultUnlocked = defaultOwned.filter(nft => nft.includes('pegasus.svg'));
        localStorage.setItem('unlockedPegasus', JSON.stringify(defaultUnlocked));

        // 3) Mark all non-rainbow parts as already drawn (so only rainbow parts remain)
        const defaultDrawnParts = drawableNFTs.filter(nft => !nft.startsWith('rainbow '));
        localStorage.setItem('drawnNFTs', JSON.stringify(defaultDrawnParts));

        // 4) Flag so we don't overwrite again
        localStorage.setItem('initialPresetComplete', 'true');

        // Initialize state and bail out
        setOwnedNFTs(defaultOwned);
        
        // Load PGS balance from localStorage
        const storedBalance = localStorage.getItem('pgsBalance');
        if (storedBalance) {
          setPgsBalance(parseFloat(storedBalance));
        }
        
        return;
      }

      // 🎯 Existing behavior for subsequent loads
      const ownedNFTsStored = JSON.parse(localStorage.getItem('ownedNFTs') || '[]');
      
      // Clean up any incorrect "horm" entries from localStorage
      const cleanedOwnedNFTs = ownedNFTsStored.filter(nft => nft !== 'air horm.svg');
      
      // Update localStorage if we removed any incorrect entries
      if (cleanedOwnedNFTs.length !== ownedNFTsStored.length) {
        localStorage.setItem('ownedNFTs', JSON.stringify(cleanedOwnedNFTs));
      }
      
      setOwnedNFTs(cleanedOwnedNFTs);
      
      // Load equipped Pegasus from localStorage
      const equippedStored = localStorage.getItem('equippedPegasus');
      if (equippedStored && cleanedOwnedNFTs.includes(equippedStored)) {
        setEquippedPegasus(equippedStored);
      }
      
      // Load PGS balance from localStorage
      const storedBalance = localStorage.getItem('pgsBalance');
      if (storedBalance) {
        setPgsBalance(parseFloat(storedBalance));
      }
      
      // Check for pegasus unlocks
      checkForPegasusUnlocks(cleanedOwnedNFTs);
    };
    
    checkWalletConnection();
    loadOwnedNFTs();
  }, [walletService]);

  const handleOpenChest = () => {
    // Check if user has enough PGS
    if (pgsBalance < 5) {
      alert('Sorry, you don\'t have enough PGS to buy the chest');
      return;
    }

    // Check if all NFTs have been collected
    const drawnNFTsStored = JSON.parse(localStorage.getItem('drawnNFTs') || '[]');
    const availableNFTs = drawableNFTs.filter(nft => !drawnNFTsStored.includes(nft));
    
    if (availableNFTs.length === 0) {
      // All NFTs have been collected
      alert('🎉 Congratulations! You have collected everything in the collection! All NFTs have been unlocked!');
    } else {
      // Deduct 5 PGS and update localStorage
      const newBalance = pgsBalance - 5;
      setPgsBalance(newBalance);
      localStorage.setItem('pgsBalance', newBalance.toString());
      
      // Still have NFTs to collect, go to chest page
      window.location.href = '/chest-open';
    }
  };

  const handleEquipPegasus = (pegasusItem) => {
    if (equippedPegasus === pegasusItem) {
      // Unequip if clicking the same equipped Pegasus
      setEquippedPegasus(null);
      localStorage.removeItem('equippedPegasus');
      setExpandedPegasus(null);
    } else {
      // Equip new Pegasus (automatically unequips previous)
      setEquippedPegasus(pegasusItem);
      localStorage.setItem('equippedPegasus', pegasusItem);
      setExpandedPegasus(pegasusItem);
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white font-supercell">Owned</h3>
                  <span className="text-sm text-gray-400">{ownedNFTs.length} nft</span>
                </div>
                
                {/* Pegasus Subsection */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-300 font-supercell ml-2">Pegasus</h4>
                    <span className="text-xs text-gray-500">{ownedPegasus.length} nft</span>
                  </div>
                <div className="collections-grid grid grid-cols-5 gap-4 mb-4">
                  {ownedPegasus.map((item, index) => {
                    const rawName = item.replace('.svg', '');
                    const nameMap = {
                      'fire pegasus': 'Blaze',
                      'earth pegasus': 'Granite',
                      'water pegasus': 'Aqua',
                      'air pegasus': 'Zephyra',
                      'rainbow pegasus': 'Prism',
                    };
                    const itemName = nameMap[rawName] || rawName.replace(/\b\w/g, l => l.toUpperCase());
                    const isExpanded = expandedPegasus === item;
                    const isEquipped = equippedPegasus === item;
                    const shouldShowButton = isExpanded || isEquipped;
                    
                    return (
                      <div key={`pegasus-${index}`} className="relative" style={{ marginBottom: shouldShowButton ? '48px' : '0' }}>
                        <div className="pegasus-card-wrapper">
                          <div 
                            className="pegasus-card bg-gray-700/50 rounded-lg border border-gray-600/30 p-3 hover:bg-gray-600/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedPegasus(isExpanded ? null : item)}
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
                          <div className="pegasus-item-name text-gray-300 text-center font-supercell">
                            {itemName}
                          </div>
                          </div>
                        </div>
                        {shouldShowButton && (
                          <button 
                            className={`equip-button ${isEquipped ? 'equipped' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEquipPegasus(item);
                            }}
                          >
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Body Parts Subsection */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-300 font-supercell ml-2">Body Parts</h4>
                    <span className="text-xs text-gray-500">{ownedBodyParts.length} nft</span>
                  </div>
                <div className="collections-grid grid [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] gap-3 mb-4">
                  {ownedBodyParts.map((item, index) => {
                    const itemName = item.replace('.svg', '').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <div 
                        key={`bodypart-${index}`}
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
              </div>

              {/* Unowned Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white font-supercell">Unowned</h3>
                  <span className="text-sm text-gray-400">{unownedNFTs.length} nft</span>
                </div>
                <div className="collections-grid grid [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] gap-3">
                  {unownedNFTs.map((item, index) => {
                    const rawName = item.replace('.svg', '');
                    const nameMap = {
                      'fire pegasus': 'Blaze',
                      'earth pegasus': 'Granite',
                      'water pegasus': 'Aqua',
                      'air pegasus': 'Zephyra',
                      'rainbow pegasus': 'Prism',
                    };
                    const itemName = nameMap[rawName] || rawName.replace(/\b\w/g, l => l.toUpperCase());
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

        {/* Right Side - Split Panel */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Top 60% - Equipped Pegasus Display */}
          <div className="h-[60%] flex items-center justify-center">
            {/* Equipped Pegasus Visual */}
            <div className="w-full max-w-md flex items-center justify-center mb-2">
              <div className="w-96 h-96">
                {equippedPegasus ? (
                  <img
                    src={`/pegasus/${equippedPegasus}`}
                    alt="Equipped Pegasus"
                    className="w-full h-full object-contain scale-110"
                  />
                ) : (
                  <img
                    src="/pegasus.svg"
                    alt="Default Pegasus"
                    className="w-full h-full object-contain scale-110"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bottom 40% - Chest Opening */}
          <div className="h-[40%] flex items-center justify-center">
            <div className="text-center">
              <div className="bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl p-6">
                <h2 className="text-xl font-bold text-white mb-3 font-supercell">Open a Chest</h2>
                <p className="text-gray-300 mb-4 font-supercell text-sm">
                  Discover rare NFTs from the Pegasus Collection!
                </p>
                <button
                  onClick={handleOpenChest}
                  className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 hover:from-yellow-500 hover:via-orange-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl text-base font-supercell transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  5 PGS
                </button>
                <p className="text-sm text-gray-300 mt-3 font-supercell">
                  You have: {pgsBalance.toFixed(2)} PGS
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for smooth transitions */}
      <style jsx>{`
        .pegasus-card-wrapper {
          transform: scale(1.10);
          transition: transform 0.3s;
        }

        .pegasus-card {
          border-radius: 0.5rem;
          transition: all 0.3s ease-in-out;
        }

        .equip-button {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -38px;
          width: 80px;
          height: 32px;
          background: linear-gradient(135deg, #FFD700 0%, #FF8C00 50%, #FFA500 100%);
          color: white;
          font-family: 'Bangers', 'Supercell-Magic', Arial Black, sans-serif;
          font-weight: 900;
          font-size: 11px;
          text-transform: uppercase;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.6);
          letter-spacing: 0.5px;
          border: 3px solid #1E40AF;
          border-radius: 12px 12px 4px 4px;
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.3),
            0 0 12px rgba(255,215,0,0.4),
            inset 0 2px 4px rgba(255,255,255,0.3),
            inset 0 -2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          z-index: 10;
          overflow: hidden;
        }

        .equip-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          transition: left 0.5s;
        }

        .equip-button:hover {
          transform: translateX(-50%) scale(1.05);
          box-shadow: 
            0 8px 16px rgba(0,0,0,0.4),
            0 0 20px rgba(255,215,0,0.6),
            inset 0 2px 4px rgba(255,255,255,0.4),
            inset 0 -2px 4px rgba(0,0,0,0.2);
          background: linear-gradient(135deg, #FFE55C 0%, #FF9500 50%, #FFB84D 100%);
        }

        .equip-button:hover::before {
          left: 100%;
        }

        .equip-button:active {
          transform: translateX(-50%) scale(0.95);
          background: linear-gradient(135deg, #E6C200 0%, #E67E00 50%, #E69500 100%);
          box-shadow: 
            0 2px 6px rgba(0,0,0,0.4),
            inset 0 2px 6px rgba(0,0,0,0.3);
        }

        .equip-button.equipped {
          background: linear-gradient(135deg, #475569 0%, #334155 50%, #1E293B 100%);
          color: white;
          border-color: #64748B;
          box-shadow: 
            0 2px 4px rgba(0,0,0,0.3),
            inset 0 1px 2px rgba(255,255,255,0.2),
            inset 0 -1px 2px rgba(0,0,0,0.3);
          opacity: 0.9;
        }

        .equip-button.equipped:hover {
          background: linear-gradient(135deg, #475569 0%, #334155 50%, #1E293B 100%);
          transform: translateX(-50%) scale(1.02);
          box-shadow: 
            0 3px 6px rgba(0,0,0,0.3),
            inset 0 1px 2px rgba(255,255,255,0.2),
            inset 0 -1px 2px rgba(0,0,0,0.3);
        }

        .equip-button.equipped:active {
          transform: translateX(-50%) scale(0.98);
        }

        .pegasus-item-name {
          white-space: normal;
          word-wrap: break-word;
          text-align: center;
          font-size: 0.65rem;
          line-height: 1.2;
        }

        .regular-item-name {
          font-size: 0.8rem;
        }

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