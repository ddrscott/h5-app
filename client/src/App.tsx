import { ColyseusProvider, useColyseus } from './contexts/ColyseusContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import './App.css';

function GameApp() {
  const { isConnected } = useColyseus();
  
  return (
    <div className="app">
      {isConnected ? <GameBoard /> : <Lobby />}
    </div>
  );
}

function App() {
  return (
    <ColyseusProvider>
      <GameApp />
    </ColyseusProvider>
  );
}

export default App;
