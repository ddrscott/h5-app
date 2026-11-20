import React from 'react';
import { Bot } from 'lucide-react';
import BotManagerSingleton from '../bots/BotManagerSingleton';
import { PERSONA_BOTS } from '../bots/configs';
import { PERSONA_LIST, PERSONAS, THINK_CHOICES, clampThinkSeconds } from '../bots/personas';
import type { PersonaId } from '../bots/personas';
import type { Player } from '../types/game';
import { personaIcon } from './ui/personaIcon';

interface BotControlsProps {
  roomId: string;
  /** everyone seated, so a new bot gets a name nobody has */
  players: Player[];
  /** seats at the table */
  maxPlayers?: number;
}

/** The host's "Add a bot" control in the lobby: pick a personality and how long it may think, then seat it. */
export const BotControls: React.FC<BotControlsProps> = ({ roomId, players, maxPlayers = 6 }) => {
  const botManager = BotManagerSingleton.getInstance();
  const [selected, setSelected] = React.useState<PersonaId>(PERSONA_LIST[0].id);
  /** seconds a new bot may think per move; 0 means the personality's own pace */
  const [thinkSeconds, setThinkSeconds] = React.useState(0);
  const [isAdding, setIsAdding] = React.useState(false);
  const persona = PERSONAS[selected];
  const PickedIcon = personaIcon(selected);

  const addBot = async () => {
    setIsAdding(true);
    try {
      const base = PERSONA_BOTS[selected];
      // Two seats must never share a name: number a repeat ("Balanced Betty 2").
      const taken = new Set(players.map((p) => p.name));
      let name = base.name;
      for (let n = 2; taken.has(name); n++) name = `${base.name} ${n}`;
      taken.add(name);
      // Step the picker to the next personality nobody has seated, so pressing Add Bot again adds someone new.
      const ids = PERSONA_LIST.map((p) => p.id);
      const at = ids.indexOf(selected);
      const next = [...ids.slice(at + 1), ...ids.slice(0, at + 1)].find((id) => !taken.has(PERSONA_BOTS[id].name));
      if (next) setSelected(next);
      const seconds = thinkSeconds > 0 ? clampThinkSeconds(thinkSeconds, persona.thinkSeconds) : undefined;
      await botManager.createBot({ ...base, name, thinkSeconds: seconds }, roomId);
    } catch (error) {
      console.error('Failed to add bot:', error);
    }
    setIsAdding(false);
  };

  return (
    <div className="mb-5 portrait:mb-3">
      <label className="section-head block mb-2">Add a bot</label>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as PersonaId)}
          className="field flex-1 !py-2 text-sm"
          aria-label="Bot personality"
        >
          {PERSONA_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} · {PERSONA_BOTS[p.id].name}{players.some((s) => s.name === PERSONA_BOTS[p.id].name) ? ' · seated' : ''}
            </option>
          ))}
        </select>
        <button onClick={addBot} disabled={isAdding || players.length >= maxPlayers} className="btn-secondary !px-3">
          <Bot size={16} /> {isAdding ? 'Adding...' : 'Add Bot'}
        </button>
      </div>
      {/* what the picked personality is like, and how long it may think */}
      <div className="mt-2 flex items-start gap-2 text-[12px] leading-snug text-bone/80">
        <PickedIcon size={15} className="mt-0.5 shrink-0 text-paper" aria-hidden />
        <p className="flex-1">{persona.blurb}</p>
      </div>
      <label className="mt-2 flex items-center justify-between gap-2 text-[12px] text-mist">
        <span>Thinks for up to</span>
        <select
          value={thinkSeconds}
          onChange={(e) => setThinkSeconds(Number(e.target.value))}
          className="field !w-auto !py-1 text-[12px]"
          aria-label="Thinking time per move"
        >
          <option value={0}>{persona.thinkSeconds} s (its own pace)</option>
          {THINK_CHOICES.map((s) => (
            <option key={s} value={s}>{s} s</option>
          ))}
        </select>
      </label>
    </div>
  );
};
