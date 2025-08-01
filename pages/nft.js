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
  const [isChestOpen, setIsChestOpen] = useState(false);
  
  // Wallet states
  const [walletService] = useState(() => new WalletService());
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

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
    
    checkWalletConnection();
  }, [walletService]);

  const handleChestClick = () => {
    setIsChestOpen(!isChestOpen);
  };

  return (
    <div className={`${geistSans.className} ${geistMono.className} min-h-screen relative`} style={{
      background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
    }}>
      
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
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-8">
        <div className="text-center">
          {/* Chest Container */}
          <div className="relative">
            <div 
              className="chest-container relative w-64 h-48 mx-auto cursor-pointer"
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
                  className="w-40 h-30 object-contain"
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
                  className="w-40 h-30 object-contain"
                  style={{ transform: 'scale(1.05)' }}
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
        
        @media (max-width: 768px) {
          .chest-container {
            width: 200px !important;
            height: 150px !important;
          }
          
          .chest-container img {
            width: 120px !important;
            height: 90px !important;
          }
        }
        
        @media (max-width: 480px) {
          .chest-container {
            width: 160px !important;
            height: 120px !important;
          }
          
          .chest-container img {
            width: 100px !important;
            height: 75px !important;
          }
        }
      `}</style>
    </div>
  );
}