import type { BotConfig, BotStrategy } from './types';
import { BotClient } from './BotClient';
import { createStrategyForConfig } from './strategies';
import { ROOKIE_RICKY, BALANCED_BETTY, EXPERT_EMMA } from './configs';
import { QuickBots } from './templates';
import { storageKey } from '../base';

/** Bot seats, by room, so a host who reloads the page brings their bots back (sessionStorage, per tab). */
const BOTS_KEY = storageKey('bots');
interface SavedBot {
  roomId: string;
  sessionId: string;
  token: string;
  config: BotConfig;
}

function loadSavedBots(): SavedBot[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(BOTS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Manages multiple bot instances
 */
export class BotManager {
  private bots: Map<string, BotClient> = new Map();
  private serverUrl: string;

  constructor(serverUrl = '') {
    this.serverUrl = serverUrl;
  }

  /**
   * Create and connect a new bot
   */
  async createBot(config: BotConfig, roomId: string, strategy?: BotStrategy): Promise<BotClient> {
    // Create strategy if not provided
    const botStrategy = strategy || createStrategyForConfig(config);
    
    // Create bot client
    const bot = new BotClient(config, botStrategy);
    
    try {
      // Connect to server
      await bot.connect(this.serverUrl, roomId);
      
      // Store bot
      this.track(bot);
      
      console.log(`Bot ${config.name} (${bot.id}) connected to room ${roomId}`);
      return bot;
      
    } catch (error) {
      console.error(`Failed to create bot ${config.name}:`, error);
      throw error;
    }
  }

  private track(bot: BotClient) {
    this.bots.set(bot.id, bot);
    bot.onGone = () => {
      this.bots.delete(bot.id);
      this.persist();
    };
    this.persist();
  }

  /** Saves every connected bot's seat, so resumeBots() can bring them back after a reload. */
  private persist() {
    const saved: SavedBot[] = [];
    this.bots.forEach((bot) => {
      const seat = bot.seat();
      if (seat) saved.push({ ...seat, config: bot.config });
    });
    try {
      if (saved.length) sessionStorage.setItem(BOTS_KEY, JSON.stringify(saved));
      else sessionStorage.removeItem(BOTS_KEY);
    } catch {
      /* storage blocked: bots just won't come back after a reload */
    }
  }

  /**
   * Puts this tab's bots back in their seats in `roomId` after the page reloads. Bots whose seat
   * is gone are dropped. Call it once the host has their own seat back.
   */
  async resumeBots(roomId: string): Promise<BotClient[]> {
    const mine = loadSavedBots().filter(
      (b) => b.roomId === roomId && !this.getBots().some((x) => x.seat()?.sessionId === b.sessionId),
    );
    const back: BotClient[] = [];
    await Promise.all(mine.map(async (saved) => {
      const bot = new BotClient(saved.config, createStrategyForConfig(saved.config));
      try {
        await bot.connect(this.serverUrl, roomId, { sessionId: saved.sessionId, token: saved.token });
        this.track(bot);
        back.push(bot);
      } catch (error) {
        console.warn(`Bot ${saved.config.name} could not take its seat back:`, error);
      }
    }));
    this.persist();
    return back;
  }

  /**
   * Remove and disconnect a bot
   */
  removeBot(botId: string): boolean {
    const bot = this.bots.get(botId);
    if (!bot) return false;
    
    bot.onGone = null;
    bot.disconnect();
    this.bots.delete(botId);
    this.persist();
    console.log(`Bot ${bot.config.name} (${botId}) removed`);
    
    return true;
  }

  /**
   * Remove all bots
   */
  removeAllBots(): void {
    this.bots.forEach(bot => {
      bot.onGone = null;
      bot.disconnect();
    });
    this.bots.clear();
    this.persist();
    console.log('All bots removed');
  }

  /**
   * Disconnect all bots (alias for removeAllBots)
   */
  disconnectAll(): void {
    this.removeAllBots();
  }

  /**
   * Get all active bots
   */
  getBots(): BotClient[] {
    return Array.from(this.bots.values());
  }

  /**
   * Get a specific bot
   */
  getBot(botId: string): BotClient | undefined {
    return this.bots.get(botId);
  }

  /**
   * Get bots in a specific room
   */
  getBotsInRoom(roomId: string): BotClient[] {
    return this.getBots().filter(bot => {
      const status = bot.getStatus();
      return status.roomId === roomId;
    });
  }

  /**
   * Update a bot's strategy
   */
  updateBotStrategy(botId: string, strategy: BotStrategy): boolean {
    const bot = this.bots.get(botId);
    if (!bot) return false;
    
    bot.updateStrategy(strategy);
    console.log(`Updated strategy for bot ${bot.config.name}`);
    return true;
  }

  /**
   * Get status of all bots
   */
  getAllStatus(): Array<{
    id: string;
    name: string;
    status: ReturnType<BotClient['getStatus']>;
  }> {
    return this.getBots().map(bot => ({
      id: bot.id,
      name: bot.config.name,
      status: bot.getStatus()
    }));
  }

  /**
   * Create multiple bots at once
   */
  async createMultipleBots(
    configs: BotConfig[], 
    roomId: string
  ): Promise<BotClient[]> {
    const bots: BotClient[] = [];
    
    for (const config of configs) {
      try {
        // Add delay between bot connections to avoid overwhelming server
        if (bots.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const bot = await this.createBot(config, roomId);
        bots.push(bot);
      } catch (error) {
        console.error(`Failed to create bot ${config.name}:`, error);
        // Continue with other bots
      }
    }
    
    return bots;
  }

  /**
   * Quick methods for common scenarios
   */
  async addBeginnerBot(roomId: string, name?: string): Promise<BotClient> {
    const config = { ...ROOKIE_RICKY, name: name || ROOKIE_RICKY.name };
    return this.createBot(config, roomId);
  }

  async addIntermediateBot(roomId: string, name?: string): Promise<BotClient> {
    const config = { ...BALANCED_BETTY, name: name || BALANCED_BETTY.name };
    return this.createBot(config, roomId);
  }

  async addExpertBot(roomId: string, name?: string): Promise<BotClient> {
    const config = { ...EXPERT_EMMA, name: name || EXPERT_EMMA.name };
    return this.createBot(config, roomId);
  }

  async fillRoom(roomId: string, targetPlayers: number = 4): Promise<BotClient[]> {
    const testBots = QuickBots.testingSet();
    const botsNeeded = Math.min(targetPlayers - 1, testBots.length); // -1 for human player
    
    return this.createMultipleBots(testBots.slice(0, botsNeeded), roomId);
  }
}