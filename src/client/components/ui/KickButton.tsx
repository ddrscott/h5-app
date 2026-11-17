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
          className="bg-red-600 hover:bg-red-700 text-white text-xs rounded px-2 py-0.5"
        >
          Remove
        </button>
        <button
          onClick={() => setAsking(false)}
          className="bg-gray-600 hover:bg-gray-700 text-white text-xs rounded px-2 py-0.5"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setAsking(true)}
      className="ml-2 inline-flex items-center align-middle text-gray-400 hover:text-red-400 pointer-events-auto"
      title={`Remove ${name} from the table`}
      aria-label={`Remove ${name} from the table`}
    >
      <UserX size={14} />
    </button>
  );
};
