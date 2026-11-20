// Starter bot for Heart of Five.
//
// A bot is one function, decide(view), that returns a move:
//   { cards: ["9S", "9H"] }  to play those cards from your hand
//   { pass: true }           to pass (not allowed when you lead)
//
// view.legalMoves already lists every move you may make right now, lowest plays first,
// so the simplest bot just picks one. This one sheds low cards and saves its bombs.

const RANKS = "3456789TJQKA2"; // low to high; "jj" and "JJ" are the jokers

function rank(code) {
  if (code === "jj") return 13;
  if (code === "JJ") return 14;
  return RANKS.indexOf(code.slice(0, -1));
}

// Four of a kind, or a run of 5+ in one suit (a straight flush), beats almost anything.
function isBomb(cards) {
  const sameRank = cards.length === 4 && cards.every((c) => rank(c) === rank(cards[0]));
  const oneSuit = cards.length >= 5 && cards.every((c) => c.slice(-1) === cards[0].slice(-1));
  return sameRank || oneSuit;
}

function decide(view) {
  const plays = view.legalMoves.filter((m) => m.cards);
  const canPass = view.legalMoves.some((m) => m.pass);

  if (plays.length === 0) return { pass: true };

  // Leading: play the lowest single (legalMoves come smallest and lowest first).
  if (!view.table) return plays[0];

  // Following: beat the table as cheaply as we can, but don't burn a bomb on it.
  const cheap = plays.filter((m) => !isBomb(m.cards));
  if (cheap.length > 0) return cheap[0];
  return canPass ? { pass: true } : plays[0];
}
