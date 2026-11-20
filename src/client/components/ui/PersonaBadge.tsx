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
      className={`inline-flex items-center gap-1 whitespace-nowrap ${thinking ? 'text-ember-hot' : 'text-bone/80'} ${className}`}
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden className={thinking ? 'animate-pulse' : ''} />
      {/* a phone-sized seat has room for the icon only; it pulses orange while the bot thinks */}
      {!compact && <span>{thinking ? 'thinking…' : label}</span>}
    </span>
  );
};
