import React, { useState, useEffect, useRef } from 'react';
import BotManagerSingleton from '../bots/BotManagerSingleton';
import { BOT_CONFIGS } from '../bots/configs';
import { BotBuilder } from '../bots/BotBuilder';
import { useColyseus } from '../contexts/ColyseusContext';

interface BotControlsProps {
  roomId: string;
  isWaitingRoom?: boolean;
}

export const BotControls: React.FC<BotControlsProps> = ({ roomId, isWaitingRoom = true }) => {
  const { room } = useColyseus();
  
  // Get singleton instance of BotManager
  const botManager = BotManagerSingleton.getInstance();
  
  const [activeBots, setActiveBots] = useState<Array<{ id: string; name: string; status: any }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update bot status periodically
  useEffect(() => {
    const updateStatus = () => {
      const status = botManager.getAllStatus();
      setActiveBots(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 100);

    return () => {
      clearInterval(interval);
    };
  }, []); // No dependencies - botManager is a singleton

  // Track previous room ID to detect actual room changes
  const previousRoomIdRef = useRef<string>(roomId);
  
  // Only cleanup bots when we actually change rooms
  useEffect(() => {
    const previousRoomId = previousRoomIdRef.current;
    
    // If room changed, clean up bots from the previous room
    if (previousRoomId && previousRoomId !== roomId) {
      const botsInPreviousRoom = botManager.getBotsInRoom(previousRoomId);
      if (botsInPreviousRoom.length > 0) {
        console.log(`Leaving room ${previousRoomId}: removing ${botsInPreviousRoom.length} bots`);
        botsInPreviousRoom.forEach(bot => botManager.removeBot(bot.id));
      }
    }
    
    // Update ref for next render
    previousRoomIdRef.current = roomId;
    
    // Cleanup on actual unmount (when user navigates away)
    return () => {
      // This cleanup will be called by StrictMode, but we only want to clean up
      // when the component is truly unmounting (navigating away from the game)
      // The BotManagerSingleton persists across re-renders, so bots will stay connected
    };
  }, [roomId]); // Only depend on roomId

  const addBot = async (configKey: keyof typeof BOT_CONFIGS) => {
    setIsLoading(true);
    try {
      const config = BOT_CONFIGS[configKey];
      await botManager.createBot(config, roomId);
    } catch (error) {
      console.error('Failed to add bot:', error);
    }
    setIsLoading(false);
  };

  const addCustomBot = async (
    name: string,
    skillLevel: 'beginner' | 'intermediate' | 'expert'
  ) => {
    setIsLoading(true);
    try {
      const builder = BotBuilder.create(name)
        .withAvatar('🤖')
        .enableChat({
          greeting: [`Hi, I'm ${name}!`],
          winning: ['Good game!'],
          losing: ['Well played!'],
          goodPlay: ['Nice!'],
          pass: ['Pass'],
        });

      // Set skill level
      switch (skillLevel) {
        case 'beginner':
          builder.asBeginner().makeAggressive();
          break;
        case 'intermediate':
          builder.asIntermediate().makeBalanced();
          break;
        case 'expert':
          builder.asExpert().makeCautious();
          break;
      }

      await botManager.createBot(builder.build(), roomId);
    } catch (error) {
      console.error('Failed to add custom bot:', error);
    }
    setIsLoading(false);
  };

  const removeBot = (botId: string) => {
    botManager.removeBot(botId);
  };

  const fillRoom = async () => {
    setIsLoading(true);
    try {
      await botManager.fillRoom(roomId);
    } catch (error) {
      console.error('Failed to fill room:', error);
    }
    setIsLoading(false);
  };

  if (!isWaitingRoom) {
    return null; // Only show controls in waiting room
  }

  return (
    <div className="card bg-base-200 p-4">
      <h3 className="text-lg font-bold mb-2">Bot Controls</h3>
      
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={fillRoom}
          disabled={isLoading || activeBots.length >= 3}
          className="btn btn-primary btn-sm"
        >
          Fill Room with Bots
        </button>
        <button
          onClick={() => botManager.removeAllBots()}
          disabled={activeBots.length === 0}
          className="btn btn-error btn-sm"
        >
          Remove All Bots
        </button>
      </div>

      {/* Pre-configured Bots */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">Add Bot:</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addBot('ROOKIE_RICKY')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            🎓 Rookie Ricky
          </button>
          <button
            onClick={() => addBot('BALANCED_BETTY')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            ⚖️ Balanced Betty
          </button>
          <button
            onClick={() => addBot('AGGRESSIVE_ANNIE')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            🔥 Aggressive Annie
          </button>
          <button
            onClick={() => addBot('CAUTIOUS_CARL')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            🛡️ Cautious Carl
          </button>
          <button
            onClick={() => addBot('EXPERT_EMMA')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            👑 Expert Emma
          </button>
          <button
            onClick={() => addBot('SILENT_SAM')}
            disabled={isLoading}
            className="btn btn-sm btn-outline"
          >
            🤐 Silent Sam
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="collapse collapse-arrow bg-base-300">
        <input 
          type="checkbox" 
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
        />
        <div className="collapse-title text-sm font-medium">
          Advanced Options
        </div>
        <div className="collapse-content">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Custom Bot</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Bot name"
                className="input input-sm flex-1"
                id="custom-bot-name"
              />
              <select className="select select-sm" id="custom-bot-skill">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              <button
                onClick={() => {
                  const nameInput = document.getElementById('custom-bot-name') as HTMLInputElement;
                  const skillSelect = document.getElementById('custom-bot-skill') as HTMLSelectElement;
                  if (nameInput.value) {
                    addCustomBot(nameInput.value, skillSelect.value as any);
                    nameInput.value = '';
                  }
                }}
                disabled={isLoading}
                className="btn btn-sm btn-primary"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      {activeBots.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Active Bots:</h4>
          <div className="space-y-2">
            {activeBots.map(bot => (
              <div key={bot.id} className="flex items-center justify-between bg-base-300 p-2 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{bot.name}</span>
                  <span className={`badge badge-xs ${bot.status.connected ? 'badge-success' : 'badge-error'}`}>
                    {bot.status.connected ? 'Connected' : 'Disconnected'}
                  </span>
                  {bot.status.inGame && (
                    <span className="badge badge-xs badge-info">
                      {bot.status.handSize} cards
                    </span>
                  )}
                  {bot.status.isMyTurn && (
                    <span className="badge badge-xs badge-warning">
                      Their turn!
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const botClient = botManager.getBot(bot.id);
                      if (botClient) {
                        botClient.debugStatus();
                      }
                    }}
                    className="btn btn-xs btn-ghost"
                    title="Debug Status"
                  >
                    🐛
                  </button>
                  <button
                    onClick={() => {
                      const botClient = botManager.getBot(bot.id);
                      if (botClient) {
                        botClient.forcePlay();
                      }
                    }}
                    disabled={!bot.status.isMyTurn}
                    className="btn btn-xs btn-ghost"
                    title="Force Play"
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => removeBot(bot.id)}
                    className="btn btn-xs btn-ghost text-error"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center mt-2">
          <span className="loading loading-spinner loading-sm"></span>
        </div>
      )}
    </div>
  );
};
