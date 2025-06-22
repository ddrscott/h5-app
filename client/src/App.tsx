import { useEffect } from 'react';
import { ColyseusProvider, useColyseus } from './contexts/ColyseusContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import BotManagerSingleton from './bots/BotManagerSingleton';
import './App.css';

function GameApp() {
  const { isConnected } = useColyseus();
  
  return (
    <div className="min-h-screen game-table-green" data-theme="dark">
      {isConnected ? <GameBoard /> : <Lobby />}
    </div>
  );
}

function App() {
  // Cleanup all bots when app unmounts
  useEffect(() => {
    return () => {
      console.log('App unmounting, cleaning up all bots');
      BotManagerSingleton.reset();
    };
  }, []);
  
  return (
    <ColyseusProvider>
      <GameApp />
    </ColyseusProvider>
  );
}

export default App;
