import React from 'react';
import { personaOf } from '../../bots/personas';
import { personaIcon } from './personaIcon';

interface PersonaBadgeProps {
  /** the bot's personality id, when it has one */
  persona?: string;
  /** it's this bot's turn: show that it is working on its move */
  thinking?: boolean;
  /** icon only, for a phone-sized seat */
  compact?: boolean;
  className?: string;
}

/** A bot's personality at its seat: icon and name, the one-line description on hover, and "thinking…" on its turn. */
export const PersonaBadge: React.FC<PersonaBadgeProps> = ({ persona, thinking = false, compact = false, className = '' }) => {
  const p = personaOf(persona);
  const Icon = personaIcon(persona);
  const label = p ? p.label : 'Bot';
  const title = p ? `${p.label}: ${p.blurb}` : 'A computer player';
  return (
    <span
      data-persona={p?.id ?? 'bot'}
      title={title}
      aria-label={thinking ? `${label}, thinking` : label}
      className={`inline-flex items-center gap-1 whitespace-nowrap ${thinking ? 'text-ember-hot' : 'text-bone'} ${className}`}
    >
      {/* the emblem: the personality's mark on a tilted paper tag, orange while it thinks */}
      <span aria-hidden className={`grid place-items-center w-[15px] h-[15px] -rotate-6 border-[1.5px] border-ink ${thinking ? 'bg-ember animate-pulse' : 'bg-paper'}`}
        style={{ boxShadow: '1.5px 1.5px 0 #000' }}>
        <Icon size={10} strokeWidth={2.75} className="text-ink" />
      </span>
      {/* a phone-sized seat has room for the emblem only */}
      {!compact && <span className="font-display text-[13px] leading-none tracking-[0.05em] pt-px">{thinking ? 'thinking…' : label}</span>}
    </span>
  );
};
