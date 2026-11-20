import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchMe, signOut as apiSignOut, saveName as apiSaveName, verifyCode } from '../net/account';
import type { Account } from '../net/account';
import { SignInDialog } from '../components/account/SignInDialog';
import { StatsDialog } from '../components/account/StatsDialog';

interface AccountContextType {
  /** undefined while loading, null when signed out. */
  account: Account | null | undefined;
  openSignIn: () => void;
  openStats: () => void;
  signOut: () => Promise<void>;
  saveName: (name: string) => Promise<void>;
  /** Called after a sign-in succeeds anywhere, e.g. to take the seat back so the room sees the account. */
  onSignedIn: (fn: () => void) => () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

/** Safe outside the provider (the FX lab): signed out, and the buttons do nothing. */
export const useAccount = (): AccountContextType =>
  useContext(AccountContext) ?? {
    account: null,
    openSignIn: () => {},
    openStats: () => {},
    signOut: async () => {},
    saveName: async () => {},
    onSignedIn: () => () => {},
  };

/** The emailed link lands on /h5/?email=…&code=…; the page submits it, so a mail scanner's GET can't burn it. */
function linkParams(): { email: string; code: string } | null {
  const p = new URLSearchParams(window.location.search);
  const email = p.get('email');
  const code = p.get('code');
  return email && code ? { email, code } : null;
}

function clearLinkParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete('email');
  url.searchParams.delete('code');
  window.history.replaceState(window.history.state, '', url.toString());
}

export const AccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [dialog, setDialog] = useState<'signin' | 'stats' | null>(null);
  const [linkError, setLinkError] = useState<{ email: string; error: string } | null>(null);
  const [listeners] = useState(() => new Set<() => void>());

  const refresh = useCallback(async () => {
    try {
      setAccount(await fetchMe());
    } catch {
      setAccount(null);
    }
  }, []);

  const signedIn = useCallback(async () => {
    await refresh();
    listeners.forEach((fn) => fn());
  }, [refresh, listeners]);

  useEffect(() => {
    const link = linkParams();
    if (!link) {
      void refresh();
      return;
    }
    clearLinkParams();
    verifyCode(link.email, link.code)
      .then(async () => {
        await signedIn();
        setDialog('stats');
      })
      .catch((e: Error) => {
        void refresh();
        setLinkError({ email: link.email, error: e.message });
        setDialog('signin');
      });
  }, [refresh, signedIn]);

  const value: AccountContextType = {
    account,
    openSignIn: () => { setLinkError(null); setDialog('signin'); },
    openStats: () => setDialog('stats'),
    signOut: async () => {
      await apiSignOut().catch(() => {});
      setAccount(null);
      setDialog(null);
    },
    saveName: async (name: string) => {
      setAccount(await apiSaveName(name));
    },
    onSignedIn: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
      {dialog === 'signin' && (
        <SignInDialog
          initialEmail={linkError?.email}
          initialError={linkError?.error}
          onClose={() => setDialog(null)}
          onSignedIn={async () => { await signedIn(); setDialog(null); }}
        />
      )}
      {dialog === 'stats' && <StatsDialog onClose={() => setDialog(null)} />}
    </AccountContext.Provider>
  );
};
