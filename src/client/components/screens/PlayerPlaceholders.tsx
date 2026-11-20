import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Player } from '../../types/game';
import { Crown, UserPlus, WifiOff } from 'lucide-react';
import { PersonaBadge } from '../ui/PersonaBadge';
import { PersonaEmblem } from '../ui/PersonaEmblem';
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
                  className="relative flex items-center"
                  style={{ filter: `drop-shadow(4px 4px 0 ${player.id === myPlayerId ? '#E85D00' : '#000'})` }}
                  initial={{ scale: 0.3, opacity: 0, y: -24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                >
                  {/* the plate leans; the portrait frame overlaps it, tilted, like the table seats */}
                  <span aria-hidden className="absolute inset-0 left-5" style={{ background: player.id === myPlayerId ? '#E85D00' : '#FAFAF7', clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }} />
                  <span aria-hidden className="absolute inset-[3px] left-[23px]" style={{ background: '#0B0B0D', clipPath: 'polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)' }} />
                  <div className="relative z-10 -rotate-[4deg] shrink-0 w-11 h-[52px] mr-1">
                    <span aria-hidden className="absolute inset-0 bg-paper" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 76% 100%, 0 100%)' }} />
                    <span aria-hidden className="absolute inset-[2.5px] bg-ink" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 76% 100%, 0 100%)' }} />
                    <span className={`absolute inset-[4.5px] grid place-items-center font-display text-[18px] leading-none pt-0.5 ${player.isActive === false ? 'bg-gray-600 text-gray-300' : player.id === myPlayerId ? 'bg-ember text-ink' : 'bg-paper text-ink'}`}
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 76% 100%, 0 100%)' }}>
                      {player.isActive === false ? <WifiOff size={14} aria-label="Disconnected" /> : player.isBot ? <PersonaEmblem persona={player.persona} size={26} /> : badges.get(player.id)}
                    </span>
                  </div>
                  <div className="relative leading-tight min-w-0 pl-1 pr-3 py-1.5">
                    {/* full names on a phone too: wrap to two lines instead of "Aggressive…" */}
                    <p className={`text-[12px] sm:text-[13px] leading-[1.15] font-semibold break-words line-clamp-2 w-max max-w-[92px] sm:max-w-[140px] ${player.isActive === false ? 'text-gray-400' : 'text-bone'}`}>{player.name}</p>
                    <p className="font-display text-[12px] leading-none tracking-[0.06em] text-mist flex items-center gap-1 mt-0.5">
                      {player.id === hostId && <><Crown size={10} className="text-paper" /> <span className="text-paper">HOST</span></>}
                      {player.isActive === false && <span className="text-paper">RECONNECTING…</span>}
                      {player.id !== hostId && player.isActive !== false && (player.isBot
                        ? <PersonaBadge persona={player.persona} className="!text-mist" />
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
                  className="flex items-center gap-1.5 px-2.5 py-2 border-2 border-dashed border-white/25 text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <UserPlus size={14} />
                  <span className="font-display text-[14px] leading-none tracking-[0.08em]">OPEN</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
};
