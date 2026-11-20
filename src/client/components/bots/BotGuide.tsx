import React from 'react';

const SAMPLE = `function decide(view) {
  // view.legalMoves lists every move you may make
  const plays = view.legalMoves.filter((m) => m.cards);
  if (!view.table) return plays[0];   // leading: lowest card
  return view.legalMoves.find((m) => m.pass) ?? plays[0];
}`;

const VIEW = `{
  me: "a1b2",                    // your seat
  hand: ["3C", "3D", "9H", "TS", "5H"],
  legalMoves: [{ cards: ["9H"] }, { cards: ["TS"] }, { pass: true }],
  table: { cards: ["8S"], type: "SINGLE", by: "c3d4" },  // null when you lead
  players: [{ id, name, cards, out, passed }, ...],     // seat order
  history: [{ by: "c3d4", cards: ["8S"] }, { by: "e5f6", pass: true }],
  timeBudgetMs: 2000
}`;

/** The one-screen "how to write a bot" doc. */
export const BotGuide: React.FC = () => (
  <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
    <p>
      A bot is a plain JavaScript file with one function, <b className="text-bone">decide(view)</b>. On each of your
      turns it gets what you can see and returns a move:
    </p>
    <pre className="bot-code">{SAMPLE}</pre>
    <p>The <b className="text-bone">view</b> looks like this:</p>
    <pre className="bot-code">{VIEW}</pre>
    <ul className="list-disc pl-5 space-y-1">
      <li>
        Return <b className="text-bone">{'{ cards: [...] }'}</b> to play cards from your hand, or{' '}
        <b className="text-bone">{'{ pass: true }'}</b> to pass. You can't pass when you lead.
      </li>
      <li>
        Cards are codes: rank then suit. Ranks run 3 4 5 6 7 8 9 T J Q K A 2, suits are C D H S, and the jokers are
        jj and JJ. The Heart 5 (5H) beats any single.
      </li>
      <li>
        Picking from <b className="text-bone">legalMoves</b> is always safe. Anything that isn't a legal move becomes a
        pass, or your lowest card when you lead.
      </li>
      <li>
        You get 2 seconds a move. Run over, or crash, and the bot is stopped and restarted; three strikes in a game and
        you get your seat back. decide may be async, and variables at the top of the file last between turns.
      </li>
      <li>
        It runs in a locked-down worker: no network, no storage, no page. console.log shows up in your browser's
        devtools. Scripts can be up to 200 KB, with no import or export.
      </li>
    </ul>
  </div>
);
