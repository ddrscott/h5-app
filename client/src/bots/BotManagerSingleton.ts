import { BotManager } from './BotManager';

/**
 * Singleton instance of BotManager to persist across React re-renders
 * This prevents bots from being destroyed during React StrictMode double-renders
 */
class BotManagerSingleton {
  private static instance: BotManager | null = null;
  
  static getInstance(): BotManager {
    if (!this.instance) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const serverUrl = `${protocol}//${window.location.hostname}:2567`;
      this.instance = new BotManager(serverUrl);
      console.log('Created BotManager singleton instance');
    }
    return this.instance;
  }
  
  static reset(): void {
    if (this.instance) {
      this.instance.removeAllBots();
      this.instance = null;
      console.log('Reset BotManager singleton instance');
    }
  }
}

export default BotManagerSingleton;