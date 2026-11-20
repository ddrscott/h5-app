// Test bot: never answers. Its decide() spins forever, so the sandbox has to stop it.
function decide(view) {
  for (;;) { /* thinking very hard */ }
}
