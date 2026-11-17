import React from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import type { ConnectionStatus, ConnectionInfo } from '../../net/rooms';

interface ConnectionOverlayProps {
  status: ConnectionStatus;
  lost: ConnectionInfo | null;
  /** Leave the room on purpose and go back to the home page. */
  onHome: () => void;
}

/**
 * Tells the player what the socket is doing: a banner while it tries to take the seat back, and a
 * panel when it gives up. "Try again" reloads the page, which resumes the saved seat if it still exists.
 */
export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = ({ status, lost, onHome }) => {
  if (status === 'reconnecting') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/95 shadow-lg" role="status" aria-live="polite">
        <div className="flex items-center justify-center gap-2 py-2 px-4">
          <Loader2 size={16} className="animate-spin text-white" />
          <p className="text-white font-medium text-sm">Reconnecting… your seat is saved.</p>
        </div>
      </div>
    );
  }

  if (status !== 'lost') return null;

  const seatGone = !!lost?.seatGone;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="alertdialog" aria-labelledby="lost-title">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-2 mb-3">
          <WifiOff size={20} className="text-red-500" />
          <h2 id="lost-title" className="text-lg font-bold text-red-500">Lost connection</h2>
        </div>
        <p className="text-gray-300 mb-1">{lost?.reason || 'Lost connection to the game'}</p>
        <p className="text-sm text-gray-400 mb-4">
          {seatGone
            ? 'Your seat at that table is gone.'
            : 'Try again to take your seat back.'}
        </p>
        <div className="space-y-3">
          {!seatGone && (
            <button onClick={() => window.location.reload()} className="btn-primary w-full">
              Try again
            </button>
          )}
          <button onClick={onHome} className={seatGone ? 'btn-primary w-full' : 'btn-secondary w-full'}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};
