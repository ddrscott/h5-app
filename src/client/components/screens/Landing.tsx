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
            <p className="mt-7 text-center text-[17px] lg:text-xl font-semibold text-bone max-w-xl mx-auto leading-snug">
              Race to empty your hand with singles, pairs, straights and bombs. One card beats
              them all: the Heart of Five.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-7 max-w-md mx-auto">
              <Link to="/play" className="btn-primary h-14 !text-[24px] px-10">
                <Play size={20} strokeWidth={2.75} /> Play Now
              </Link>
              <button onClick={() => setShowTutor(true)} className="btn-secondary h-14 px-7">
                <BookOpen size={16} /> Learn How to Play
              </button>
            </div>
          </div>
        </div>

      {/* What is Heart of Five Section */}
      <div className="relative bg-paper text-ink border-y-[6px] border-ink py-16 overflow-hidden">
        {/* screentone shading in one corner of the page */}
        <div aria-hidden className="tone absolute -right-10 -top-10 w-72 h-72 text-ink/15 rotate-12" />
        <div className="relative container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <p className="section-head !bg-ink !text-paper mx-auto mb-3">The game</p>
            <h2 className="font-display text-5xl lg:text-6xl leading-none tracking-[0.03em] text-ink text-center mb-10">
              What is Heart of Five?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-[17px] font-medium text-ink/90">
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
                  <Card suit="H" rank={5} className="w-32 h-48 transform -rotate-6 absolute top-0 left-0 drop-shadow-[5px_6px_0_rgba(0,0,0,.9)]" />
                  <Card suit="D" rank={15} className="w-32 h-48 transform rotate-3 absolute top-4 left-8 drop-shadow-[5px_6px_0_rgba(0,0,0,.9)]" />
                  <Card suit="C" rank={13} className="w-32 h-48 transform rotate-12 relative top-8 left-16 drop-shadow-[5px_6px_0_rgba(0,0,0,.9)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Features */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <p className="section-head mx-auto mb-3">Why it sticks</p>
          <h2 className="font-display text-5xl lg:text-6xl leading-none tracking-[0.03em] text-paper text-center mb-12">
            Why you'll keep playing
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="panel text-center space-y-3 p-6 -rotate-1">
              <Zap size={38} strokeWidth={2.5} className="mx-auto mb-2 text-ember" />
              <h3 className="font-display text-4xl leading-none text-paper">Fast</h3>
              <p className="text-mist">
                Quick games with no set limit - play one game or many in a session
              </p>
            </div>
            
            <div className="panel text-center space-y-3 p-6 rotate-1">
              <Brain size={38} strokeWidth={2.5} className="mx-auto mb-2 text-ember" />
              <h3 className="font-display text-4xl leading-none text-paper">Sneaky</h3>
              <p className="text-mist">
                Decide when to play powerful combinations and when to hold back
              </p>
            </div>
            
            <div className="panel text-center space-y-3 p-6 -rotate-1">
              <Users size={38} strokeWidth={2.5} className="mx-auto mb-2 text-ember" />
              <h3 className="font-display text-4xl leading-none text-paper">Loud</h3>
              <p className="text-mist">
                Play with 2-6 friends online, perfect for game nights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Preview */}
      <div className="bg-ink border-y-[6px] border-paper py-16" id="how-to-play">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <p className="section-head mx-auto mb-3">Quick start</p>
            <h2 className="font-display text-5xl lg:text-6xl leading-none tracking-[0.03em] text-paper text-center mb-10">
              Learn it in a minute
            </h2>
            
            <div className="space-y-6">
              <div className="panel p-6">
                <h3 className="font-display text-3xl leading-none text-paper mb-4">Basic rules</h3>
                <ul className="space-y-2 text-bone/85">
                  <li className="flex items-start">
                    <span className="text-blood mr-2 font-bold">♥</span>
                    Be the first to play all your cards to win the game
                  </li>
                  <li className="flex items-start">
                    <span className="text-blood mr-2 font-bold">♥</span>
                    Play singles, pairs, three of a kind, or special combinations
                  </li>
                  <li className="flex items-start">
                    <span className="text-blood mr-2 font-bold">♥</span>
                    Higher ranks beat lower ranks (3 is lowest, 2 is highest)
                  </li>
                  <li className="flex items-start">
                    <span className="text-blood mr-2 font-bold">♥</span>
                    The Heart 5 beats everything - use it wisely!
                  </li>
                  <li className="flex items-start">
                    <span className="text-blood mr-2 font-bold">♥</span>
                    Last player with cards loses - track wins/losses across games
                  </li>
                </ul>
              </div>
              
              <div className="panel p-6">
                <h3 className="font-display text-3xl leading-none text-paper mb-4">Special combinations</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-display text-[22px] leading-none tracking-[0.04em] text-paper mb-1">Runs</p>
                    <p className="text-sm text-mist">5+ consecutive singles (e.g., 7-8-9-10-J)</p>
                  </div>
                  <div>
                    <p className="font-display text-[22px] leading-none tracking-[0.04em] text-paper mb-1">Sisters</p>
                    <p className="text-sm text-mist">3+ consecutive pairs (e.g., 77-88-99)</p>
                  </div>
                  <div>
                    <p className="font-display text-[22px] leading-none tracking-[0.04em] text-paper mb-1">Full House</p>
                    <p className="text-sm text-mist">Three of a kind + a pair</p>
                  </div>
                  <div>
                    <p className="font-display text-[22px] leading-none tracking-[0.04em] text-paper mb-1">Bomb</p>
                    <p className="text-sm text-mist">Four of a kind beats most hands</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <Link
                to="/play"
                className="btn-primary h-14 !text-[24px] px-10"
              >
                Start Playing
              </Link>
            </div>
          </div>
        </div>
      </div>

        {/* Footer */}
        <div className="py-8 border-t-[3px] border-paper/20">
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
                <span className="inline-flex items-center gap-1.5">Built for loud family card nights <Heart size={13} className="text-blood" fill="currentColor" aria-hidden /></span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* iPhone SE iframe - fixed to right side on medium screens and up */}
      <div className="hidden md:block fixed top-0 right-0 h-full w-[400px] bg-ink border-l-[4px] border-paper">
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="space-y-2">
            <div 
              className="bg-black overflow-hidden border-[3px] border-paper shadow-[7px_7px_0_0_#E85D00]"
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
              className="text-center font-display text-[20px] tracking-[0.05em] text-bone hover:text-ember transition-colors block pt-2"
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
