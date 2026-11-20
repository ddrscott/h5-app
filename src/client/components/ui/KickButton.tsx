import React, { useState } from 'react';
import { UserX } from 'lucide-react';

interface KickButtonProps {
  name: string;
  onConfirm: () => void;
}

/** A small "remove this player" control that asks once before it acts. */
export const KickButton: React.FC<KickButtonProps> = ({ name, onConfirm }) => {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <span className="inline-flex items-center gap-1 ml-2 font-sans not-italic">
        <button
          onClick={() => { setAsking(false); onConfirm(); }}
          className="bg-blood hover:bg-blood-deep text-paper font-display text-[13px] tracking-[0.05em] px-2 pt-0.5 border-2 border-ink"
        >
          Remove
        </button>
        <button
          onClick={() => setAsking(false)}
          className="bg-paper hover:bg-white text-ink font-display text-[13px] tracking-[0.05em] px-2 pt-0.5 border-2 border-ink"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setAsking(true)}
      className="ml-2 inline-flex items-center align-middle text-mist hover:text-blood pointer-events-auto"
      title={`Remove ${name} from the table`}
      aria-label={`Remove ${name} from the table`}
    >
      <UserX size={14} />
    </button>
  );
};
