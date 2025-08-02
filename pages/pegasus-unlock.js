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

export default function PegasusUnlock() {
  const router = useRouter();
  const { pegasus } = router.query;
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    // Start animation after component mounts
    setTimeout(() => {
      setShowAnimation(true);
    }, 100);
  }, []);

  const handlePageClick = () => {
    // Return to NFT page
    router.push('/nft');
  };

  const pegasusName = pegasus ? pegasus.charAt(0).toUpperCase() + pegasus.slice(1) : '';

  return (
    <div 
      className={`${geistSans.className} ${geistMono.className} min-h-screen relative cursor-pointer`} 
      style={{
        background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
      }}
      onClick={handlePageClick}
    >
      {/* Congratulations Text */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center">
        <h1 className={`text-3xl font-bold text-yellow-400 font-supercell mb-2 transition-all duration-1000 ease-out ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
        }`}>
          Congratulations!
        </h1>
        <h2 className={`text-xl font-semibold text-white font-supercell transition-all duration-1000 ease-out delay-300 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
        }`}>
          You've unlocked {pegasusName} Pegasus!
        </h2>
      </div>

      {/* NFT Card with Golden Light */}
      <div className="flex items-center justify-center h-screen pt-16 pb-12">
        <div className="relative overflow-hidden">
          {/* Legendary Aura Effect - Behind Card */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            
            {/* Core Golden Aura */}
            <div 
              className={`absolute top-1/2 left-1/2 w-80 h-80 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-2000 delay-500 ${
                showAnimation ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: 'radial-gradient(ellipse, rgba(255, 215, 0, 0.4) 0%, rgba(255, 193, 7, 0.3) 30%, rgba(255, 235, 59, 0.2) 60%, transparent 100%)',
                filter: 'blur(30px)',
                animation: showAnimation ? 'auralPulse 4s ease-in-out infinite' : 'none'
              }}
            ></div>

            {/* Fluid Ripple Layer */}
            <div 
              className={`absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-2000 delay-700 ${
                showAnimation ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: 'radial-gradient(circle, rgba(255, 223, 0, 0.25) 0%, rgba(255, 193, 7, 0.15) 40%, rgba(255, 248, 225, 0.1) 70%, transparent 100%)',
                filter: 'blur(40px)',
                animation: showAnimation ? 'fluidRipple 6s ease-in-out infinite' : 'none'
              }}
            ></div>

            {/* Airy Sparkle Layer */}
            <div 
              className={`absolute top-1/2 left-1/2 w-72 h-72 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-2000 delay-900 ${
                showAnimation ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: 'radial-gradient(ellipse 120% 80%, rgba(255, 248, 220, 0.3) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 80%)',
                filter: 'blur(20px)',
                animation: showAnimation ? 'airyShimmer 8s ease-in-out infinite' : 'none'
              }}
            ></div>

            {/* Outer Ethereal Glow */}
            <div 
              className={`absolute top-1/2 left-1/2 w-[28rem] h-[28rem] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-2000 delay-600 ${
                showAnimation ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: 'radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, rgba(255, 204, 0, 0.08) 30%, rgba(255, 235, 59, 0.05) 60%, transparent 100%)',
                filter: 'blur(50px)',
                animation: showAnimation ? 'etherealBreath 10s ease-in-out infinite' : 'none'
              }}
            ></div>

          </div>

          {/* NFT Card */}
          <div 
            className={`nft-card bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 p-2 rounded-3xl shadow-2xl relative z-10 transition-all duration-1000 ease-out delay-200 ${
              showAnimation ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="bg-gray-900 rounded-2xl p-5 w-[269px] h-[438px]">
              {/* Card Header */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-yellow-400 font-supercell mb-2">
                  {pegasusName} Pegasus
                </h3>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
              </div>
              
              {/* NFT Image */}
              <div className="w-full h-48 mb-4 bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-center">
                <img 
                  src={`/pegasus/${pegasus} pegasus.svg`}
                  alt={`${pegasusName} Pegasus`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              
              {/* NFT Name */}
              <div className="text-center">
                <h4 className="text-lg font-semibold text-white font-supercell mb-2">
                  {pegasusName} Pegasus
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Legendary NFT
                </p>
                <div className="text-sm text-yellow-400 font-supercell">
                  ✨ UNLOCKED ✨
                </div>
              </div>
              
              {/* Sparkle effects around the card */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-6 right-6 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                <div className="absolute top-12 left-8 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div className="absolute bottom-12 right-12 w-2.5 h-2.5 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 right-4 w-1 h-1 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
                <div className="absolute top-1/3 left-4 w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click instruction */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-center">
        <p className={`text-gray-300 text-sm font-supercell transition-all duration-1000 ease-out delay-1500 ${
          showAnimation ? 'opacity-100' : 'opacity-0'
        }`}>
          Click anywhere to continue
        </p>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes auralPulse {
          0%, 100% {
            opacity: 0.4;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        @keyframes fluidRipple {
          0%, 100% {
            opacity: 0.25;
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
          }
          33% {
            opacity: 0.4;
            transform: translate(-50%, -50%) scale(1.05) rotate(120deg);
          }
          66% {
            opacity: 0.15;
            transform: translate(-50%, -50%) scale(0.95) rotate(240deg);
          }
        }

        @keyframes airyShimmer {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          25% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1.08);
          }
          50% {
            opacity: 0.2;
            transform: translate(-50%, -50%) scale(0.92);
          }
          75% {
            opacity: 0.45;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }

        @keyframes etherealBreath {
          0%, 100% {
            opacity: 0.15;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.25;
            transform: translate(-50%, -50%) scale(1.03);
          }
        }
      `}</style>
    </div>
  );
}