import { BASE } from '../../base';
import React from 'react';
import type { Player } from '../../types/game';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, Link2, LogOut, Play } from 'lucide-react';
import { MuteButton } from '../ui/MuteButton';
import { sfx } from '../../fx/sound';
import { PlayerPlaceholders } from './PlayerPlaceholders';
import BotManagerSingleton from '../../bots/BotManagerSingleton';
import { DialogBox } from '../ui/DialogBox';
import { BotControls } from '../BotControls';

interface LobbyProps {
  roomId: string;
  players: Player[];
  isHost: boolean;
  hostId: string | null;
  hostName: string;
  lastError?: string | null;
  myPlayerId?: string;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  /** Host only: remove a player whose connection dropped. */
  onKick?: (playerId: string) => void;
  /** Extra buttons for the header, left of the mute switch (the bring-your-own-bot button). */
  headerExtra?: React.ReactNode;
}

export const Lobby: React.FC<LobbyProps> = ({
  roomId,
  players,
  isHost,
  hostId,
  hostName,
  lastError,
  myPlayerId,
  onStartGame,
  onLeaveRoom,
  onKick,
  headerExtra,
}) => {
  const canStart = players.length >= 2 && players.length <= 6;
  const [copiedText, setCopiedText] = React.useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  
  // Get singleton instance of BotManager
  const botManager = BotManagerSingleton.getInstance();
  
  // Track previous room ID to detect actual room changes
  const previousRoomIdRef = React.useRef<string>(roomId);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    sfx.select(4);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleLeaveRoom = () => {
    // Clean up bots when explicitly leaving the room
    const botsInRoom = botManager.getBotsInRoom(roomId);
    if (botsInRoom.length > 0) {
      console.log(`Leaving room ${roomId}: removing ${botsInRoom.length} bots`);
      botsInRoom.forEach(bot => botManager.removeBot(bot.id));
    }
    onLeaveRoom();
  };

  // A soft tick when someone takes a seat.
  const seatCount = React.useRef(players.length);
  React.useEffect(() => {
    if (players.length > seatCount.current) sfx.land(1);
    seatCount.current = players.length;
  }, [players.length]);

  // Only cleanup bots when we actually change rooms
  React.useEffect(() => {
    const previousRoomId = previousRoomIdRef.current;
    
    // If room changed, clean up bots from the previous room
    if (previousRoomId && previousRoomId !== roomId) {
      const botsInPreviousRoom = botManager.getBotsInRoom(previousRoomId);
      if (botsInPreviousRoom.length > 0) {
        console.log(`Leaving room ${previousRoomId}: removing ${botsInPreviousRoom.length} bots`);
        botsInPreviousRoom.forEach(bot => botManager.removeBot(bot.id));
      }
    }
    
    // Update ref for next render
    previousRoomIdRef.current = roomId;
    
    // Cleanup on actual unmount (when user navigates away)
    return () => {
      // This cleanup will be called by StrictMode, but we only want to clean up
      // when the component is truly unmounting (navigating away from the game)
      // The BotManagerSingleton persists across re-renders, so bots will stay connected
    };
  }, [roomId]); // Only depend on roomId

  const shareUrl = `${window.location.origin + BASE}/play?room=${roomId}`;

  return (
    <div className="h-dvh felt-texture p-3 sm:p-5 flex flex-col relative overflow-y-auto">
      <AnimatePresence>
        {copiedText && (
          <motion.div
            className="fixed top-4 left-1/2 z-50 flex items-center gap-2 px-3 py-2 panel text-sm text-bone"
            initial={{ x: '-50%', y: -16, opacity: 0 }}
            animate={{ x: '-50%', y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Check size={15} className="text-ember" /> {copiedText} copied
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="font-seal grid place-items-center w-9 h-9 bg-cinnabar text-paper font-black text-[11px] leading-[1.05] text-center -rotate-3 shadow-[inset_0_0_0_2px_rgba(246,240,226,.5)]" aria-hidden>红心<br />五</div>
          <div>
            <p className="section-head">Lobby</p>
            <h1 className="font-display font-black text-xl text-paper leading-none">Pull up a chair</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {headerExtra}
          <MuteButton />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="grid place-items-center w-10 h-10 bg-ink/80 border border-white/15 text-bone hover:border-ember transition-colors"
            title="Leave Room"
            aria-label="Leave room"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-5 portrait:gap-3 portrait:flex-col max-w-6xl w-full mx-auto">
        {/* The table, seen from above */}
        <div className="relative w-full flex-1 aspect-[4/3] max-h-[70vh] min-h-[300px] portrait:aspect-auto portrait:max-h-none portrait:min-h-[240px]">
          <div
            className="absolute inset-[13%] rounded-[50%]"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, #276457 0%, #154038 55%, #0C2723 100%)',
              boxShadow: '0 0 0 6px #3A2414, 0 0 0 8px #D6A54A55, 0 24px 60px -10px rgba(0,0,0,.7), inset 0 0 40px rgba(0,0,0,.45)',
            }}
          />
          <PlayerPlaceholders players={players} hostId={hostId} myPlayerId={myPlayerId} onKick={isHost ? onKick : undefined} />

          {/* Room code in the middle of the table */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="section-head mb-1.5">Room code</p>
            <button
              onClick={() => copyToClipboard(roomId, 'Room code')}
              className="group flex items-center gap-2 px-3 py-2 bg-ink/85 border border-brass/40 hover:border-ember transition-colors"
              title="Copy room code"
            >
              <span className="font-sans tabular-nums font-extrabold text-2xl sm:text-3xl tracking-[0.25em] text-brass-light">{roomId}</span>
              <Copy size={16} className="text-mist group-hover:text-ember" />
            </button>
            <button
              onClick={() => copyToClipboard(shareUrl, 'Share link')}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-mist hover:text-ember transition-colors"
            >
              <Link2 size={13} /> Copy share link
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 w-full max-w-sm portrait:max-w-md">
          <div className="panel p-5 portrait:p-4">
            {isHost ? (
              <>
                {players.length < 6 && (
                  <BotControls roomId={roomId} players={players} />
                )}
                <button onClick={onStartGame} disabled={!canStart} className="btn-primary w-full h-12 text-[15px]">
                  {!canStart ? `Need ${2 - players.length} more player` : <><Play size={17} /> Start Game</>}
                </button>
                {!canStart && <p className="text-xs text-mist text-center mt-2">Two players or more. Bots count.</p>}
              </>
            ) : (
              <div className="text-center py-2">
                <div className="flex justify-center gap-1.5 mb-3" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-2 h-2 bg-ember" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
                <p className="text-bone">Waiting for <span className="font-semibold text-brass-light">{hostName}</span> to start</p>
              </div>
            )}
          </div>
          {lastError && <p role="alert" className="text-sm text-cinnabar text-center pt-3">{lastError}</p>}
          <p className="font-sans tabular-nums text-[11px] tracking-[0.15em] text-mist text-center pt-3">
            {players.length}/6 SEATED · {players.length === 6 ? 'TABLE FULL' : `${6 - players.length} OPEN`}
          </p>
        </div>
      </div>

      {showLeaveConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setShowLeaveConfirm(false)} />
          <DialogBox className="max-w-sm">
            <p className="section-head mb-2">Leave room</p>
            <h3 className="font-display text-2xl font-bold mb-2">Leave the room?</h3>
            <p className="text-gray-300 mb-5 text-sm">Your bots leave with you.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowLeaveConfirm(false); handleLeaveRoom(); }} className="btn-primary flex-1">Leave</button>
              <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1">Stay</button>
            </div>
          </DialogBox>
        </>
      )}
    </div>
  );
};
