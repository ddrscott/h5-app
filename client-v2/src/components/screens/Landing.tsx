import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Tutor } from './Tutor';

export const Landing: React.FC = () => {
  const [showTutor, setShowTutor] = useState(false);
  
  // Enable scrolling for landing page
  useEffect(() => {
    // Store original styles
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlTouchAction = document.documentElement.style.touchAction;
    const originalBodyTouchAction = document.body.style.touchAction;
    
    // Enable scrolling
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.documentElement.style.touchAction = 'auto';
    document.body.style.touchAction = 'auto';
    
    // Cleanup function to restore original styles
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.touchAction = originalHtmlTouchAction;
      document.body.style.touchAction = originalBodyTouchAction;
    };
  }, []);
  return (
    <div className="min-h-screen felt-texture">
      {/* Main content - add right padding on md screens to make room for iframe */}
      <div className="overflow-y-auto md:pr-[400px]">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="container mx-auto px-4 py-12 lg:py-20">
            <div className="text-center space-y-6">
            {/* Title with cards animation */}
            <div className="relative">
              <h1 className="text-5xl lg:text-7xl font-bold text-gold mb-4">
                Heart of Five
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300">
                红心五 • The Ultimate Card Shedding Game
              </p>
              
              {/* Decorative cards */}
              <div className="absolute -top-10 -left-20 opacity-20 transform -rotate-12 hidden lg:block">
                <Card suit="H" rank={5} className="w-24 h-36" />
              </div>
              <div className="absolute -top-10 -right-20 opacity-20 transform rotate-12 hidden lg:block">
                <Card suit="S" rank={14} className="w-24 h-36" />
              </div>
            </div>

            {/* Tagline */}
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              A thrilling strategic card game where the first to empty their hand wins. 
              Master the power of the legendary Heart 5!
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Link
                to="/play"
                className="btn-primary text-lg px-8 py-3 transform hover:scale-105 transition-transform"
              >
                Play Now
              </Link>
              <button
                onClick={() => setShowTutor(true)}
                className="btn-secondary text-lg px-8 py-3"
              >
                Learn How to Play
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* What is Heart of Five Section */}
      <div className="bg-gray-900/50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gold text-center mb-8">
              What is Heart of Five?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-gray-300">
                <p>
                  Heart of Five (红心五) is a popular Chinese card shedding game that combines 
                  strategy, memory, and a bit of luck. Players race to be the first to play 
                  all their cards using various combinations.
                </p>
                <p>
                  What makes this game unique is the Heart 5 - the most powerful card that 
                  can beat any other combination. This twist adds exciting strategic depth 
                  as players must decide when to use this trump card.
                </p>
                <p>
                  Each game continues until all players except one are out of cards. The first 
                  player out wins, while the last player with cards loses. You can play multiple 
                  games in a session with cumulative win/loss tracking - play as long as you want!
                </p>
              </div>
              
              {/* Card showcase */}
              <div className="flex justify-center">
                <div className="relative">
                  <Card suit="H" rank={5} className="w-32 h-48 transform -rotate-6 absolute top-0 left-0 shadow-xl" />
                  <Card suit="D" rank={15} className="w-32 h-48 transform rotate-3 absolute top-4 left-8 shadow-xl" />
                  <Card suit="C" rank={13} className="w-32 h-48 transform rotate-12 relative top-8 left-16 shadow-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Features */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gold text-center mb-12">
            Why You'll Love It
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center space-y-3">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-gold">Fast-Paced</h3>
              <p className="text-gray-400">
                Quick games with no set limit - play one game or many in a session
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold text-gold">Strategic Depth</h3>
              <p className="text-gray-400">
                Decide when to play powerful combinations and when to hold back
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-gold">Social Fun</h3>
              <p className="text-gray-400">
                Play with 2-6 friends online, perfect for game nights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Preview */}
      <div className="bg-gray-900/50 py-16" id="how-to-play">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gold text-center mb-8">
              Quick Start Guide
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gold mb-3">Basic Rules</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    Be the first to play all your cards to win the game
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    Play singles, pairs, three of a kind, or special combinations
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    Higher ranks beat lower ranks (3 is lowest, 2 is highest)
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    The Heart 5 beats everything - use it wisely!
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    Last player with cards loses - track wins/losses across games
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gold mb-3">Special Combinations</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-gray-300">Runs</p>
                    <p className="text-sm text-gray-400">5+ consecutive singles (e.g., 7-8-9-10-J)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-300">Sisters</p>
                    <p className="text-sm text-gray-400">3+ consecutive pairs (e.g., 77-88-99)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-300">Full House</p>
                    <p className="text-sm text-gray-400">Three of a kind + a pair</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-300">Bomb</p>
                    <p className="text-sm text-gray-400">Four of a kind beats most hands</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <Link
                to="/play"
                className="btn-primary text-lg px-8 py-3 inline-block"
              >
                Start Playing
              </Link>
            </div>
          </div>
        </div>
      </div>

        {/* Footer */}
        <div className="py-8 border-t border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
              <div className="flex gap-4">
                <Link to="/cards" className="hover:text-gold transition-colors">
                  View All Cards
                </Link>
                <a 
                  href="https://github.com/spierce5" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  GitHub
                </a>
              </div>
              <p>
                Made with ♥️ for card game enthusiasts
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* iPhone SE iframe - fixed to right side on medium screens and up */}
      <div className="hidden md:block fixed top-0 right-0 h-full w-[400px] bg-gray-900 border-l border-gray-800">
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="space-y-2">
            <div 
              className="bg-black rounded-lg overflow-hidden shadow-2xl"
              style={{ width: '375px', height: '667px' }}
            >
              <iframe
                src="/play"
                className="w-full h-full"
                title="Play Game"
                style={{ border: 'none' }}
              />
            </div>
            <Link 
              to="/play" 
              className="text-center text-sm text-gray-400 hover:text-gold transition-colors block"
            >
              Play directly here →
            </Link>
          </div>
        </div>
      </div>
      
      {/* Tutor Modal */}
      {showTutor && <Tutor onClose={() => setShowTutor(false)} />}
    </div>
  );
};
