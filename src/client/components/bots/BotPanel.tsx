import React, { useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import { Bot, Download, FileUp, Play, Trash2, X } from 'lucide-react';
import type { PilotStatus } from '../../bots/sandbox/pilot';
import { botLibrary, scriptProblem } from '../../bots/sandbox/library';
import type { SavedBot } from '../../bots/sandbox/library';
import { scriptSeats } from '../../bots/sandbox/scriptSeats';
import { BotGuide } from './BotGuide';
import { STARTER_BOT, downloadStarter } from './starter';
import { testRun } from './testRun';
import { DialogBox } from '../ui/DialogBox';

/** The bring-your-own-bot panel: saved bots, add a bot, the guide, and the consent check. */
export const BotPanel: React.FC<{
  bots: SavedBot[];
  picked: SavedBot | null;
  onPick: (id: string) => void;
  status: PilotStatus;
  canPlay: boolean;
  onToggle: (on: boolean) => void;
  onClose: () => void;
  extraSeat: string | null;
  onToast: (text: string) => void;
}> = ({ bots, picked, onPick, status, canPlay, onToggle, onClose, extraSeat, onToast }) => {
  const [tab, setTab] = useState<'bots' | 'guide'>(bots.length ? 'bots' : 'guide');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<null | (() => void)>(null);
  const [test, setTest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seated = useSyncExternalStore(scriptSeats.subscribe, () => (extraSeat ? scriptSeats.list(extraSeat).length : 0));

  const withConsent = (go: () => void) => {
    if (botLibrary.hasConsent()) go();
    else setConsent(() => go);
  };

  const save = () => {
    const problem = scriptProblem(code);
    if (problem) { setError(problem); return; }
    withConsent(() => {
      try {
        const bot = botLibrary.save(name || 'My bot', code);
        onPick(bot.id);
        setCode('');
        setName('');
        setError(null);
        setTest(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200 * 1024) { setError(`That file is ${Math.ceil(file.size / 1024)} KB. The limit is 200 KB.`); return; }
    setCode(await file.text());
    if (!name) setName(file.name.replace(/\.(m?js|txt)$/i, '').replace(/[-_]+/g, ' ').slice(0, 20));
    setError(null);
  };

  const runTest = (bot: SavedBot) => withConsent(async () => {
    setBusy(true);
    setTest(`Testing ${bot.name}…`);
    setTest(await testRun(bot.code));
    setBusy(false);
  });

  const addSeat = (bot: SavedBot) => withConsent(async () => {
    if (!extraSeat) return;
    setBusy(true);
    try {
      await scriptSeats.add(extraSeat, bot, onToast);
      onToast(`${bot.name} took a seat.`);
    } catch (err) {
      onToast(`${bot.name} couldn't join: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[85]" onClick={onClose} />
      <motion.aside
        className="fixed top-0 right-0 bottom-0 z-[86] w-[min(440px,100vw)] panel flex flex-col"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        role="dialog"
        aria-label="Your bot"
        data-testid="bot-panel"
      >
        <div className="flex items-start justify-between p-4 pb-2">
          <div>
            <p className="section-head">Bring your own bot</p>
            <h2 className="font-display text-2xl font-bold text-paper leading-tight">Let a bot play your seat</h2>
          </div>
          <button onClick={onClose} className="grid place-items-center w-9 h-9 bg-ink/80 border border-white/15 text-bone hover:border-ember" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="flex gap-1 px-4 border-b border-white/10">
          {(['bots', 'guide'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px ${tab === t ? 'border-ember text-bone' : 'border-transparent text-mist hover:text-bone'}`}
            >
              {t === 'bots' ? 'Your bots' : 'How to write a bot'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {tab === 'guide' ? (
            <>
              <BotGuide />
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={downloadStarter}><Download size={15} /> Starter bot</button>
                <button className="btn-secondary" onClick={() => { setCode(STARTER_BOT); setName('Starter Bot'); setTab('bots'); }}>Use the starter bot</button>
              </div>
            </>
          ) : (
            <>
              {bots.length > 0 && (
                <section className="space-y-2">
                  <p className="section-head">Saved in this browser</p>
                  <ul className="space-y-1.5">
                    {bots.map((b) => (
                      <li key={b.id} className={`flex items-center gap-2 px-2.5 py-2 border ${picked?.id === b.id ? 'border-ember bg-ember/10' : 'border-white/10 bg-ink/40'}`}>
                        <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                          <input type="radio" name="bot" checked={picked?.id === b.id} onChange={() => onPick(b.id)} className="accent-[#E85D00]" />
                          <span className="font-semibold text-bone truncate">{b.name}</span>
                          <span className="text-[11px] text-mist shrink-0">{Math.max(1, Math.round(b.code.length / 1024))} KB</span>
                        </label>
                        <button className="p-1.5 text-mist hover:text-bone" title={`Test ${b.name}`} aria-label={`Test ${b.name}`} disabled={busy} onClick={() => runTest(b)}><Play size={15} /></button>
                        <button className="p-1.5 text-mist hover:text-bone" title={`Delete ${b.name}`} aria-label={`Delete ${b.name}`} onClick={() => botLibrary.remove(b.id)}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                  {test && <p className="text-xs text-gray-300 bg-ink/50 border border-white/10 px-2.5 py-2" data-testid="bot-test-result">{test}</p>}

                  {picked && (
                    <div className="pt-1 space-y-2">
                      {status.enabled ? (
                        <button className="btn-secondary w-full" onClick={() => onToggle(false)}>Take my seat back</button>
                      ) : (
                        <button className="btn-primary w-full" disabled={!canPlay} onClick={() => withConsent(() => { onToggle(true); onClose(); })} data-testid="bot-play-seat">
                          <Bot size={16} /> Let {picked.name} play my seat
                        </button>
                      )}
                      <p className="text-xs text-mist">
                        {status.enabled
                          ? `Strikes this game: ${status.strikes} of 3.`
                          : 'It plays your turns until you take over. Everyone at the table sees a bot badge on your seat.'}
                      </p>
                      {extraSeat && (
                        <button className="btn-secondary w-full" disabled={busy} onClick={() => addSeat(picked)} data-testid="bot-extra-seat">
                          Seat {picked.name} as an extra player{seated ? ` (${seated} seated)` : ''}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}

              <section className="space-y-2">
                <p className="section-head">Add a bot</p>
                <input className="field" placeholder="Bot name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} aria-label="Bot name" />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Choose file</button>
                  <button className="btn-secondary flex-1" onClick={() => { setCode(STARTER_BOT); if (!name) setName('Starter Bot'); }}>Starter bot</button>
                </div>
                <input ref={fileRef} type="file" accept=".js,.mjs,.txt,text/javascript" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} data-testid="bot-file" />
                <textarea
                  className="field bot-code-input h-40 resize-y"
                  placeholder="…or paste your bot's code here"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(null); }}
                  aria-label="Bot code"
                  data-testid="bot-code"
                />
                {error && <p className="text-sm text-[#FF9C66]" role="alert">{error}</p>}
                <button className="btn-primary w-full" disabled={!code.trim()} onClick={save} data-testid="bot-save">Save bot</button>
              </section>
            </>
          )}
        </div>
      </motion.aside>

      {consent && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[90]" />
          <DialogBox className="max-w-sm z-[91]">
            <p className="section-head mb-2">Before it runs</p>
            <h3 className="font-display text-2xl font-bold mb-2">This runs code in your browser</h3>
            <p className="text-gray-300 mb-2 text-sm">
              A bot is a program. It runs on this device, inside a locked-down sandbox with no network, no storage and no
              access to this page or your seat.
            </p>
            <p className="text-gray-300 mb-5 text-sm">Only load bots you wrote or trust. It can still use up your battery if it misbehaves.</p>
            <div className="flex gap-3">
              <button className="btn-primary flex-1" onClick={() => { botLibrary.giveConsent(); const go = consent; setConsent(null); go(); }} data-testid="bot-consent-yes">Run it</button>
              <button className="btn-secondary flex-1" onClick={() => setConsent(null)}>Cancel</button>
            </div>
          </DialogBox>
        </>
      )}
    </>
  );
};
