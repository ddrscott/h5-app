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
      let serverUrl: string;
      
      // For production HTTPS, don't add port (use standard 443)
      // For local development or custom ports, include the port
      if (window.location.protocol === 'https:' && window.location.port === '') {
        serverUrl = `${protocol}//${window.location.hostname}`;
      } else if (window.location.hostname === 'localhost') {
        serverUrl = `${protocol}//${window.location.hostname}:2567`;
      } else {
        const port = window.location.port || '2567';
        serverUrl = `${protocol}//${window.location.hostname}:${port}`;
      }
      
      this.instance = new BotManager(serverUrl);
      console.log('Created BotManager singleton instance with URL:', serverUrl);
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
