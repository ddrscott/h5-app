import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Landing } from './components/screens/Landing';
import { Play } from './components/screens/Play';
import { Lobby } from './components/screens/Lobby';
import { GameTable } from './components/game/GameTable';
import { CardGallery } from './components/screens/CardGallery';
import { AnimationTest } from './components/screens/AnimationTest';
import { LayoutTest } from './components/screens/LayoutTest';
import { useColyseus } from './contexts/ColyseusContext';
import { useGameState } from './hooks/useGameState';
import { GamePhase } from './types/game';

type AppState = 'play' | 'connecting' | 'lobby' | 'game';

function GameApp() {
  const [appState, setAppState] = useState<AppState>('play');
  const [playerName, setPlayerName] = useState('');
  
  const { room, roomId, myPlayerId, isConnected, error, createRoom, joinRoom, leaveRoom } = useColyseus();
  const gameState = useGameState();
  const navigate = useNavigate();
  const location = useLocation();

  // Check URL for room ID on load
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (roomFromUrl && appState === 'play') {
      // Room ID in URL, prepare to join
      console.log('Found room ID in URL:', roomFromUrl);
    }
  }, [location, appState]);

  // Update app state based on connection and game phase
  useEffect(() => {
    if (isConnected && room) {
      if (gameState.phase === GamePhase.PLAYING) {
        setAppState('game');
      } else {
        setAppState('lobby');
      }
    }
  }, [isConnected, room, gameState.phase]);

  const handleJoinGame = async (name: string, roomIdInput?: string) => {
    setPlayerName(name);
    setAppState('connecting');
    
    try {
      if (roomIdInput === '') {
        // Empty string means join random room (joinOrCreate)
        await joinRoom(name);
      } else if (roomIdInput) {
        // If room ID is explicitly provided, join that specific room
        await joinRoom(name, roomIdInput);
      } else {
        // Otherwise, create a new room
        await createRoom(name);
      }
    } catch (err) {
      console.error('Failed to join/create room:', err);
      setAppState('play');
    }
  };

  const handleStartGame = () => {
    gameState.startGame();
  };

  const handleLeaveRoom = () => {
    // Leave the room and redirect to play
    leaveRoom();
    setAppState('play');
    navigate('/play');
  };

  // Show error message if any
  if (error) {
    const isRoomLocked = error.includes('is locked');
    
    return (
      <div className="min-h-screen felt-texture flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-4">Connection Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="space-y-3">
            {isRoomLocked ? (
              <>
                <p className="text-sm text-gray-400">This room has a game in progress. You can:</p>
                <button 
                  onClick={() => {
                    // Clear the URL parameter and go back to play
                    navigate('/play');
                    window.location.reload();
                  }} 
                  className="btn-primary w-full"
                >
                  Create New Room
                </button>
                <button 
                  onClick={() => window.location.reload()} 
                  className="btn-secondary w-full"
                >
                  Try Again
                </button>
              </>
            ) : (
              <button onClick={() => window.location.reload()} className="btn-primary w-full">
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle game states
  if (appState === 'connecting') {
    return (
      <div className="min-h-screen felt-texture flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🃏</div>
          <p className="text-xl text-gold">Connecting to game server...</p>
        </div>
      </div>
    );
  }

  if (appState === 'lobby') {
    if (!roomId || !myPlayerId) return null;
    
    const playersArray = Array.from(gameState.players.values());
    const myPlayer = gameState.players.get(myPlayerId);
    const isHost = playersArray.length > 0 && playersArray[0].id === myPlayerId;
    
    return (
      <Lobby
        roomId={roomId}
        players={playersArray}
        isHost={isHost}
        onStartGame={handleStartGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (appState === 'game') {
    if (!myPlayerId) return null;
    
    const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
    const isLeader = gameState.leadPlayerId === myPlayerId;
    const canPass = !isLeader || !!gameState.currentMeld;
    
    return (
      <GameTable
        players={gameState.players}
        myPlayerId={myPlayerId}
        myHand={gameState.myHand}
        selectedCards={gameState.selectedCards}
        currentMeld={gameState.currentMeld}
        currentTurnPlayerId={gameState.currentTurnPlayerId || ''}
        leadPlayerId={gameState.leadPlayerId || ''}
        deckCount={gameState.deckCount}
        discardTop={gameState.discardTop || undefined}
        consecutivePasses={gameState.consecutivePasses}
        trickMelds={gameState.trickMelds}
        lastTrickMelds={gameState.lastTrickMelds}
        lastError={gameState.lastError}
        lastNotification={gameState.lastNotification}
        onCardSelect={gameState.toggleCardSelection}
        onPlayCards={gameState.playCards}
        onPass={gameState.pass}
        onLeaveGame={handleLeaveRoom}
      />
    );
  }

  // Default to play screen
  return <Play onJoinGame={handleJoinGame} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play" element={<GameApp />} />
        <Route path="/cards" element={
          <CardGallery onClose={() => window.location.href = '/'} />
        } />
        <Route path="/animation" element={<AnimationTest />} />
        <Route path="/layouts" element={<LayoutTest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;