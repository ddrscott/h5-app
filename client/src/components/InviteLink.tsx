import React, { useState, useEffect } from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { Copy, Check } from 'lucide-react';

export const InviteLink: React.FC = () => {
  const { room } = useColyseus();
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!room) return;

    // Listen for welcome message with invite URL
    room.onMessage('welcome', (data: { inviteUrl?: string }) => {
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
      }
    });

    // Generate client-side URL as fallback
    if (!inviteUrl && room.roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', room.roomId);
      setInviteUrl(url.toString());
    }
  }, [room]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!inviteUrl) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-base-content/70 mb-1">Invite friends:</p>
        <p className="text-sm font-mono truncate">{inviteUrl}</p>
      </div>
      <button
        onClick={copyToClipboard}
        className="btn btn-sm btn-ghost"
        title="Copy invite link"
      >
        {copied ? (
          <Check size={16} className="text-success" />
        ) : (
          <Copy size={16} />
        )}
      </button>
    </div>
  );
};