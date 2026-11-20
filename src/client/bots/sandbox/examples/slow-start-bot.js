// Test bot: never finishes loading. The top level spins forever, before decide() is even defined.
for (;;) { /* warming up */ }
function decide(view) {
  return view.legalMoves[0];
}
