import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useMuted } from '../../fx/prefs';
import { sfx } from '../../fx/sound';

/** One switch for sound and vibration, remembered across visits (storageKey('muted')). */
export const MuteButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [muted, setMuted] = useMuted();
  return (
    <button
      onClick={() => { setMuted(!muted); if (muted) setTimeout(() => sfx.select(3), 30); }}
      className={`icon-btn ${className}`}
      title={muted ? 'Sound and vibration off' : 'Sound and vibration on'}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
};

