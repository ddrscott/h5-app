import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameState } from '../types/game';

interface ColyseusContextType {
  client: Client | null;
  room: Room<GameState> | null;
  roomId: string | null;
  myPlayerId: string | null;
  isConnected: boolean;
  error: string | null;
  createRoom: (playerName: string) => Promise<void>;
  joinRoom: (playerName: string, roomId?: string) => Promise<void>;
  leaveRoom: () => void;
}

const ColyseusContext = createContext<ColyseusContextType | undefined>(undefined);

export const useColyseus = () => {
  const context = useContext(ColyseusContext);
  if (!context) {
    throw new Error('useColyseus must be used within a ColyseusProvider');
  }
  return context;
};

interface ColyseusProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

export const ColyseusProvider: React.FC<ColyseusProviderProps> = ({ 
  children, 
  serverUrl = 'ws://localhost:2567' 
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const colyseusClient = new Client(serverUrl);
    setClient(colyseusClient);
  }, [serverUrl]);

  const createRoom = async (playerName: string) => {
    if (!client) return;
    
    try {
      setError(null);
      const newRoom = await client.create<GameState>('heartoffive', { name: playerName });
      console.log('Created room:', newRoom.roomId);
      setRoom(newRoom);
      setRoomId(newRoom.roomId);
      setMyPlayerId(newRoom.sessionId);
      setIsConnected(true);
      
      // Update URL with room ID
      const url = new URL(window.location.href);
      url.searchParams.set('room', newRoom.roomId);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsConnected(false);
    }
  };

  const joinRoom = async (playerName: string, roomId?: string) => {
    if (!client) return;
    
    try {
      setError(null);
      let newRoom: Room<GameState>;
      
      if (roomId) {
        newRoom = await client.joinById<GameState>(roomId, { name: playerName });
      } else {
        newRoom = await client.joinOrCreate<GameState>('heartoffive', { name: playerName });
      }
      
      console.log('Joined room:', newRoom);
      setRoom(newRoom);
      setRoomId(newRoom.roomId);
      setMyPlayerId(newRoom.sessionId);
      setIsConnected(true);
      
      // Update URL with room ID
      const url = new URL(window.location.href);
      url.searchParams.set('room', newRoom.roomId);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsConnected(false);
    }
  };

  const leaveRoom = () => {
    if (room) {
      room.leave();
      setRoom(null);
      setRoomId(null);
      setMyPlayerId(null);
      setIsConnected(false);
      
      // Clear room from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.leave();
      }
    };
  }, [room]);

  return (
    <ColyseusContext.Provider 
      value={{
        client,
        room,
        roomId,
        myPlayerId,
        isConnected,
        error,
        createRoom,
        joinRoom,
        leaveRoom
      }}
    >
      {children}
    </ColyseusContext.Provider>
  );
};
