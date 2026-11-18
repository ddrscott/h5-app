import { BASE } from '../../base';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { BookOpen, Brain, Heart, Play, Users, Zap } from 'lucide-react';
import { Banner } from '../ui/Banner';
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
        {/* Hero: the same fanned hand as the table's welcome screen */}
        <div className="relative overflow-hidden">
          <div className="container mx-auto px-4 pt-10 pb-12 lg:pt-16 lg:pb-20">
            <Banner />
            <p className="mt-6 text-center text-[15px] lg:text-lg text-bone/80 max-w-xl mx-auto leading-relaxed">
              Race to empty your hand with singles, pairs, straights and bombs. One card outranks
              them all: the Heart of Five.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-7 max-w-md mx-auto">
              <Link to="/play" className="btn-primary h-12 text-[15px] px-8">
                <Play size={17} /> Play Now
              </Link>
              <button onClick={() => setShowTutor(true)} className="btn-secondary h-12 px-6">
                <BookOpen size={16} /> Learn How to Play
              </button>
            </div>
          </div>
        </div>

      {/* What is Heart of Five Section */}
      <div className="bg-ink/50 border-y border-white/5 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <p className="section-head text-center mb-2">The game</p>
            <h2 className="font-display font-black text-3xl lg:text-4xl text-paper text-center mb-8">
              What is Heart of Five?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-bone/85">
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
          <p className="section-head text-center mb-2">Why it sticks</p>
          <h2 className="font-display font-black text-3xl lg:text-4xl text-paper text-center mb-12">
            Why You'll Love It
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center space-y-3">
              <Zap size={34} className="mx-auto mb-4 text-ember" />
              <h3 className="font-display text-xl font-bold text-brass-light">Fast-Paced</h3>
              <p className="text-mist">
                Quick games with no set limit - play one game or many in a session
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <Brain size={34} className="mx-auto mb-4 text-ember" />
              <h3 className="font-display text-xl font-bold text-brass-light">Strategic Depth</h3>
              <p className="text-mist">
                Decide when to play powerful combinations and when to hold back
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <Users size={34} className="mx-auto mb-4 text-ember" />
              <h3 className="font-display text-xl font-bold text-brass-light">Social Fun</h3>
              <p className="text-mist">
                Play with 2-6 friends online, perfect for game nights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Preview */}
      <div className="bg-ink/50 border-y border-white/5 py-16" id="how-to-play">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <p className="section-head text-center mb-2">Quick start</p>
            <h2 className="font-display font-black text-3xl lg:text-4xl text-paper text-center mb-8">
              Quick Start Guide
            </h2>
            
            <div className="space-y-6">
              <div className="panel p-6">
                <h3 className="font-display text-xl font-bold text-brass-light mb-3">Basic Rules</h3>
                <ul className="space-y-2 text-bone/85">
                  <li className="flex items-start">
                    <span className="text-cinnabar mr-2">♥</span>
                    Be the first to play all your cards to win the game
                  </li>
                  <li className="flex items-start">
                    <span className="text-cinnabar mr-2">♥</span>
                    Play singles, pairs, three of a kind, or special combinations
                  </li>
                  <li className="flex items-start">
                    <span className="text-cinnabar mr-2">♥</span>
                    Higher ranks beat lower ranks (3 is lowest, 2 is highest)
                  </li>
                  <li className="flex items-start">
                    <span className="text-cinnabar mr-2">♥</span>
                    The Heart 5 beats everything - use it wisely!
                  </li>
                  <li className="flex items-start">
                    <span className="text-cinnabar mr-2">♥</span>
                    Last player with cards loses - track wins/losses across games
                  </li>
                </ul>
              </div>
              
              <div className="panel p-6">
                <h3 className="font-display text-xl font-bold text-brass-light mb-3">Special Combinations</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-bone/85">Runs</p>
                    <p className="text-sm text-mist">5+ consecutive singles (e.g., 7-8-9-10-J)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-bone/85">Sisters</p>
                    <p className="text-sm text-mist">3+ consecutive pairs (e.g., 77-88-99)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-bone/85">Full House</p>
                    <p className="text-sm text-mist">Three of a kind + a pair</p>
                  </div>
                  <div>
                    <p className="font-semibold text-bone/85">Bomb</p>
                    <p className="text-sm text-mist">Four of a kind beats most hands</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <Link
                to="/play"
                className="btn-primary h-12 text-[15px] px-8"
              >
                Start Playing
              </Link>
            </div>
          </div>
        </div>
      </div>

        {/* Footer */}
        <div className="py-8 border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-mist">
              <div className="flex gap-4">
                <Link to="/cards" className="hover:text-ember transition-colors">
                  View All Cards
                </Link>
                <a 
                  href="https://github.com/spierce5" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-ember transition-colors"
                >
                  GitHub
                </a>
              </div>
              <p>
                <span className="inline-flex items-center gap-1.5">Made with <Heart size={13} className="text-cinnabar" fill="currentColor" aria-label="love" /> for family card nights</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* iPhone SE iframe - fixed to right side on medium screens and up */}
      <div className="hidden md:block fixed top-0 right-0 h-full w-[400px] bg-ink border-l border-white/10">
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="space-y-2">
            <div 
              className="bg-black overflow-hidden shadow-2xl border border-white/10"
              style={{ width: '375px', height: '667px' }}
            >
              <iframe
                src={`${BASE}/play`}
                className="w-full h-full"
                title="Play Game"
                style={{ border: 'none' }}
              />
            </div>
            <Link 
              to="/play" 
              className="text-center text-sm text-mist hover:text-ember transition-colors block"
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
