import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot } from 'lucide-react';
import type { Room } from '../../net/rooms';
import { SeatPilot } from '../../bots/sandbox/pilot';
import type { PilotStatus } from '../../bots/sandbox/pilot';
import { useSavedBots } from '../../bots/sandbox/library';
import { BotPanel } from './BotPanel';
import { storageKey } from '../../base';

const PICKED_KEY = storageKey('my-bot-picked');
const readPicked = () => { try { return localStorage.getItem(PICKED_KEY); } catch { return null; } };

interface BotDockProps {
  room: Room | null;
  myPlayerId: string | null;
  roomId: string | null;
  isHost: boolean;
  inLobby: boolean;
}

/**
 * Bring your own bot. One button in the table's header opens a panel to upload or paste a bot,
 * test it, hand it your seat, and (for the host, in the lobby) seat it as an extra player. While
 * it plays for you a strip at the top says so and gives you the seat back with one tap.
 */
export function useBotDock({ room, myPlayerId, roomId, isHost, inLobby }: BotDockProps) {
  const bots = useSavedBots();
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(readPicked);
  const picked = bots.find((b) => b.id === pickedId) ?? bots[0] ?? null;
  const [pilot, setPilot] = useState<SeatPilot | null>(null);
  const [status, setStatus] = useState<PilotStatus>({ enabled: false, thinking: false, strikes: 0, note: null });
  const [toast, setToast] = useState<string | null>(null);

  // one pilot per seat; it listens to the room all the time so the bot's history is complete
  useEffect(() => {
    if (!room || !myPlayerId) return;
    const p = new SeatPilot(room, myPlayerId, { onStrikeOut: (why) => setToast(why) });
    setPilot(p);
    const off = p.subscribe(setStatus);
    return () => { off(); p.dispose(); setPilot(null); };
  }, [room, myPlayerId]);

  useEffect(() => { pilot?.setBot(picked ? { name: picked.name, code: picked.code } : null); }, [pilot, picked?.id, picked?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!status.note || !status.enabled) return;
    setToast(status.note);
  }, [status.note, status.enabled]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = (id: string) => {
    setPickedId(id);
    try { localStorage.setItem(PICKED_KEY, id); } catch { /* fine */ }
  };

  const button = (
    <button
      onClick={() => setOpen(true)}
      className={`relative grid place-items-center w-10 h-10 bg-ink/80 border text-bone hover:border-ember transition-colors ${status.enabled ? 'border-ember text-ember' : 'border-white/15'}`}
      title={status.enabled ? `${picked?.name} is playing for you` : 'Your bot'}
      aria-label="Your bot"
      data-testid="bot-dock-button"
    >
      <Bot size={18} />
      {status.enabled && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ember" aria-hidden />}
    </button>
  );

  const overlay = (
    <>
      <AnimatePresence>
        {status.enabled && picked && (
          <motion.div
            className="fixed top-14 left-1/2 z-[60] flex items-center gap-3 pl-3 pr-1 py-1 panel text-sm text-bone"
            initial={{ x: '-50%', y: -10, opacity: 0 }}
            animate={{ x: '-50%', y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="autopilot-strip"
          >
            <Bot size={15} className={status.thinking ? 'text-ember animate-pulse' : 'text-ember'} />
            <span><b>{picked.name}</b> is playing for you</span>
            <button className="px-2.5 py-1 bg-gray-800 border border-white/15 text-xs font-bold uppercase tracking-wide hover:border-ember" onClick={() => pilot?.setEnabled(false)}>
              Take over
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed top-28 left-1/2 z-[61] max-w-[min(92vw,460px)] px-3 py-2 panel text-sm text-bone"
            initial={{ x: '-50%', y: -10, opacity: 0 }}
            animate={{ x: '-50%', y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            data-testid="bot-toast"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      {open && (
        <BotPanel
          bots={bots}
          picked={picked}
          onPick={pick}
          status={status}
          canPlay={!!room}
          onToggle={(on) => pilot?.setEnabled(on)}
          onClose={() => setOpen(false)}
          extraSeat={isHost && inLobby && roomId ? roomId : null}
          onToast={setToast}
        />
      )}
    </>
  );

  return { button, overlay };
}
