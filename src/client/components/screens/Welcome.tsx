import { storageKey } from '../../base';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BarChart3, BookOpen, Dice5, Home, Layers, Plus } from 'lucide-react';
import { useAccount } from '../../contexts/AccountContext';
import { Banner } from '../ui/Banner';
import { Tutor } from './Tutor';
import { MuteButton } from '../ui/MuteButton';

interface WelcomeProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
  getAvailableRooms?: () => Promise<any[]>;
  onViewCards?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showTutor, setShowTutor] = useState(false);
  const { account, openSignIn, openStats, saveName } = useAccount();

  // A signed-in player's display name fills the field.
  useEffect(() => {
    if (account?.name) setPlayerName(account.name);
  }, [account?.name]);

  // Check URL for room parameter and load saved name on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) setRoomCode(roomFromUrl);
    const savedName = localStorage.getItem(storageKey('playerName'));
    if (savedName) setPlayerName(savedName);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setPlayerName(newName);
    if (newName.trim()) localStorage.setItem(storageKey('playerName'), newName.trim());
  };

  /** A signed-in player with no display name yet keeps the first name they play under. */
  const join = (roomId?: string) => {
    if (account && !account.name) void saveName(playerName.trim()).catch(() => {});
    onJoinGame(playerName, roomId);
  };
  const handleCreateRoom = () => { if (playerName.trim()) join(); };
  const handleJoinSpecificRoom = () => { if (playerName.trim() && roomCode.trim()) join(roomCode); };
  const handleJoinRandomRoom = () => { if (playerName.trim()) join(''); };

  const named = !!playerName.trim();

  return (
    <div className="min-h-screen felt-texture flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute top-3 right-3 z-10"><MuteButton /></div>
      <div className="flex items-center gap-6 lg:gap-14 portrait:flex-col max-w-6xl mx-auto w-full py-6">
        <Banner className="flex-1 w-full" />

        <motion.div
          className="flex-1 w-full max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.3 }}
        >
          <div className="panel p-5 sm:p-6">
            <label htmlFor="player-name" className="section-head block mb-2">Your name</label>
            <input
              id="player-name"
              type="text"
              value={playerName}
              onChange={handleNameChange}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoom(); }}
              placeholder="Enter your name"
              className="field text-base"
              maxLength={20}
              autoComplete="nickname"
            />

            <div className="flex flex-col gap-2.5 mt-4">
              <button onClick={handleCreateRoom} disabled={!named} className="btn-primary h-12">
                <Plus size={18} /> Create New Room
              </button>
              <button onClick={handleJoinRandomRoom} disabled={!named} className="btn-secondary h-11">
                <Dice5 size={17} /> Join Random Room
              </button>

              <div className="flex items-center gap-3 my-1.5">
                <div className="h-px flex-1 bg-white/10" />
                <span className="section-head">Or join a table</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoinSpecificRoom(); }}
                  placeholder="Room code"
                  aria-label="Room code"
                  className="field flex-1 min-w-0 text-center tracking-[0.3em] uppercase placeholder:tracking-[0.12em]"
                  maxLength={10}
                />
                <button onClick={handleJoinSpecificRoom} disabled={!named || !roomCode.trim()} className="btn-primary px-5 shrink-0">
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-[24px] flex items-center justify-center gap-4 text-[13px] text-mist" data-account={account ? 'signed-in' : account === null ? 'guest' : 'loading'}>
            {account === null && (
              <button onClick={openSignIn} className="text-bone/90 underline underline-offset-4 decoration-white/25 hover:text-ember hover:decoration-ember transition-colors">
                Sign in to keep your stats
              </button>
            )}
            {account && (
              <>
                <span className="min-w-0 truncate">Signed in as <span className="text-bone">{account.name || account.email}</span></span>
                <button onClick={openStats} className="inline-flex items-center gap-1.5 text-bone hover:text-ember transition-colors shrink-0">
                  <BarChart3 size={14} /> Your stats
                </button>
              </>
            )}
          </div>

          <div className="mt-2 flex justify-center gap-5 text-[13px] text-mist">
            <button onClick={() => setShowTutor(true)} className="inline-flex items-center gap-1.5 hover:text-ember transition-colors">
              <BookOpen size={14} /> How to Play
            </button>
            <Link to="/cards" className="inline-flex items-center gap-1.5 hover:text-ember transition-colors">
              <Layers size={14} /> View Cards
            </Link>
            <Link to="/" className="inline-flex items-center gap-1.5 hover:text-ember transition-colors">
              <Home size={14} /> Back to Home
            </Link>
          </div>
        </motion.div>
      </div>

      {showTutor && <Tutor onClose={() => setShowTutor(false)} />}
    </div>
  );
};
