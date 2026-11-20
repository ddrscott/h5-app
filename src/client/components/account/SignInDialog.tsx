import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Modal } from './Modal';
import { startSignIn, verifyCode } from '../../net/account';

interface Props {
  initialEmail?: string;
  initialError?: string;
  onClose: () => void;
  onSignedIn: () => void | Promise<void>;
}

/** Email, then the 6-digit code from the email (or the one-click link in it). */
export const SignInDialog: React.FC<Props> = ({ initialEmail = '', initialError, onClose, onSignedIn }) => {
  const [step, setStep] = useState<'email' | 'code'>(initialEmail ? 'code' : 'email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await startSignIn(email.trim());
      setDevCode(r.devCode ?? null);
      setCode(r.devCode ?? '');
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim(), code.trim());
      await onSignedIn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal label="Your account" title="Keep your stats" onClose={onClose}>
      {step === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <p className="text-sm text-bone/80 mb-4">
            Sign in with your email and every game you finish is saved: wins, losses and places, against people and against the computer. No password. We'll email you a code.
          </p>
          <label htmlFor="signin-email" className="section-head block mb-2">Email</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field text-base"
            autoComplete="email"
            autoFocus
            required
          />
          {error && <p className="mt-3 text-sm text-cinnabar" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !email.trim()} className="btn-primary w-full h-12 mt-4">
            <Mail size={17} /> {busy ? 'Sending…' : 'Email me a code'}
          </button>
          <p className="mt-3 text-[13px] text-mist text-center">Guests can still play. They just don't keep stats.</p>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }}>
          <p className="text-sm text-bone/80 mb-4">
            We sent a 6-digit code to <span className="text-paper font-semibold break-all">{email}</span>. Type it here, or tap the link in the email.
          </p>
          {devCode && (
            <p className="mb-4 px-3 py-2 border border-brass/40 bg-brass/10 text-sm text-brass-light">
              Local dev, so no email went out. Your code is <span className="font-bold tabular-nums tracking-[0.2em]">{devCode}</span>
            </p>
          )}
          <label htmlFor="signin-code" className="section-head block mb-2">Code</label>
          <input
            id="signin-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="field text-center text-2xl tabular-nums tracking-[0.4em] placeholder:tracking-[0.4em]"
            autoFocus
          />
          {error && <p className="mt-3 text-sm text-cinnabar" role="alert">{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full h-12 mt-4">
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="mt-3 flex justify-between gap-3 text-[13px] text-mist">
            <button type="button" onClick={() => { setStep('email'); setError(null); setCode(''); setDevCode(null); }} className="hover:text-ember transition-colors">
              Use a different email
            </button>
            <button type="button" onClick={() => void send()} disabled={busy} className="hover:text-ember transition-colors">
              Send a new code
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
