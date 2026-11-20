import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Modal } from './Modal';
import { useAccount } from '../../contexts/AccountContext';
import { BUCKETS, BUCKET_LABEL, fetchStats } from '../../net/account';
import type { BucketStats, Stats } from '../../net/account';

const ROWS: { label: string; value: (s: BucketStats) => string }[] = [
  { label: 'Games', value: (s) => String(s.games) },
  { label: 'Wins', value: (s) => String(s.wins) },
  { label: 'Losses', value: (s) => String(s.losses) },
  { label: 'Win rate', value: (s) => (s.games ? `${Math.round(s.winRate * 100)}%` : '–') },
  { label: 'Avg place', value: (s) => (s.avgPlace == null ? '–' : s.avgPlace.toFixed(1)) },
];

/** Totals for each bucket, the display name, and sign out. */
export const StatsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { account, openSignIn, signOut, saveName } = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(account?.name ?? '');
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!account) return;
    fetchStats().then(setStats, (e: Error) => setError(e.message));
  }, [account]);

  if (account === null) {
    return (
      <Modal label="Your stats" title="Sign in to keep your stats" onClose={onClose}>
        <p className="text-sm text-bone/80 mb-4">Guests play the same game. Signing in just keeps your results for good, on any device.</p>
        <button onClick={openSignIn} className="btn-primary w-full h-12">Sign in</button>
      </Modal>
    );
  }

  const save = async () => {
    setNameState('saving');
    try {
      await saveName(name);
      setNameState('saved');
    } catch (e) {
      setError((e as Error).message);
      setNameState('idle');
    }
  };

  const total = stats ? BUCKETS.reduce((n, b) => n + stats[b].games, 0) : 0;

  return (
    <Modal label="Your stats" title={account?.name ? `${account.name}'s record` : 'Your record'} onClose={onClose}>
      <div className="border border-white/10 mb-2">
        <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] px-3 py-2 border-b border-white/10 section-head !text-[10px] leading-tight">
          <span />
          {BUCKETS.map((b) => <span key={b} className="text-right">{BUCKET_LABEL[b]}</span>)}
        </div>
        {ROWS.map((row) => (
          <div key={row.label} className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] items-baseline px-3 py-2 border-b border-white/5 last:border-b-0" data-stat={row.label}>
            <span className="text-[13px] text-mist">{row.label}</span>
            {BUCKETS.map((b) => (
              <span key={b} className="text-right tabular-nums text-[16px] font-bold text-bone" data-bucket={b}>
                {stats ? row.value(stats[b]) : '·'}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[12px] text-mist mb-5">
        {stats && total === 0
          ? 'Finish a game and it shows up here.'
          : 'Vs people: every seat a person. Mixed: two or more people with bots. Vs computer: just you and bots.'}
      </p>
      {error && <p className="mb-3 text-sm text-cinnabar" role="alert">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label htmlFor="display-name" className="section-head block mb-2">Display name</label>
        <div className="flex gap-2">
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameState('idle'); }}
            placeholder="Your name at the table"
            className="field flex-1 min-w-0 text-base"
            maxLength={20}
            autoComplete="nickname"
          />
          <button type="submit" disabled={!name.trim() || nameState === 'saving' || name.trim() === (account?.name ?? '')} className="btn-secondary px-4 shrink-0">
            {nameState === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      </form>

      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
        <p className="text-[13px] text-mist min-w-0 truncate">Signed in as <span className="text-bone">{account?.email}</span></p>
        <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-[13px] text-mist hover:text-ember transition-colors shrink-0">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </Modal>
  );
};
