import starterBot from '../../bots/sandbox/examples/starter-bot.js?raw';

/** The starter bot players can download or load from the panel. */
export const STARTER_BOT = starterBot;

/** Saves the starter bot as a file. */
export function downloadStarter() {
  const url = URL.createObjectURL(new Blob([STARTER_BOT], { type: 'text/javascript' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'starter-bot.js';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
