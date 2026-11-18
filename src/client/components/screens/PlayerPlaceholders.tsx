import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Player } from '../../types/game';
import { Bot, Crown, UserPlus, WifiOff } from 'lucide-react';
import { KickButton } from '../ui/KickButton';
import { seatBadges } from '../game/Seat';

interface PlayerPlaceholdersProps {
  players: Player[];
  hostId?: string | null;
  maxPlayers?: number;
  myPlayerId?: string;
  /** Set for the host: shows a remove control on players whose connection dropped. */
  onKick?: (playerId: string) => void;
}

/** Six seats around the lobby table; players drop into them as they join. */
export const PlayerPlaceholders: React.FC<PlayerPlaceholdersProps> = ({
  players,
  hostId,
  maxPlayers = 6,
  myPlayerId,
  onKick,
}) => {
  // Seat 0 is at the bottom (the creator), then clockwise.
  const angles = [90, 150, 210, 270, 330, 30].slice(0, maxPlayers);
  // the same avatar letters the table will show ("Aggressive Annie 2" → A2), so repeats read apart
  const badges = seatBadges(players);
  return (
    <>
      {angles.map((angle, index) => {
        const player = players[index];
        const rad = (angle * Math.PI) / 180;
        const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
        const x = 50 + Math.cos(rad) * (portrait ? 30 : 41);
        const y = 50 + Math.sin(rad) * (portrait ? 42 : 40);
        return (
          <div key={index} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <AnimatePresence mode="popLayout">
              {player ? (
                <motion.div
                  key={player.id}
                  className={`relative flex items-center gap-2 pl-1 pr-2.5 py-1 bg-ink/85 border ${player.id === myPlayerId ? 'border-ember' : 'border-white/15'} shadow-lg`}
                  initial={{ scale: 0.3, opacity: 0, y: -24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                >
                  <div className={`grid place-items-center w-8 h-8 font-sans tabular-nums font-extrabold text-[11px] ${player.isActive === false ? 'bg-gray-600 text-gray-300' : player.id === myPlayerId ? 'bg-ember text-ink' : 'bg-bone text-ink'}`}>
                    {player.isActive === false ? <WifiOff size={14} aria-label="Disconnected" /> : badges.get(player.id)}
                  </div>
                  <div className="leading-tight min-w-0">
                    {/* full names on a phone too: wrap to two lines instead of "Aggressive…" */}
                    <p className={`text-[12px] sm:text-[13px] leading-[1.15] font-semibold break-words line-clamp-2 w-max max-w-[92px] sm:max-w-[140px] ${player.isActive === false ? 'text-gray-400' : 'text-bone'}`}>{player.name}</p>
                    <p className="font-sans tabular-nums text-[9px] tracking-[0.15em] text-mist flex items-center gap-1">
                      {player.id === hostId && <><Crown size={10} className="text-brass" /> <span className="text-brass">HOST</span></>}
                      {player.isActive === false && <span className="text-brass">RECONNECTING…</span>}
                      {player.id !== hostId && player.isActive !== false && (player.isBot
                        ? <><Bot size={10} aria-hidden /> <span>BOT</span></>
                        : <span>{player.id === myPlayerId ? 'YOU' : 'SEATED'}</span>)}
                    </p>
                  </div>
                  {onKick && player.isActive === false && player.id !== myPlayerId && (
                    <KickButton name={player.name} onConfirm={() => onKick(player.id)} />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`empty-${index}`}
                  className="flex items-center gap-1.5 px-2.5 py-2 border border-dashed border-white/20 text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <UserPlus size={14} />
                  <span className="font-sans tabular-nums text-[10px] tracking-[0.15em]">OPEN</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
};
