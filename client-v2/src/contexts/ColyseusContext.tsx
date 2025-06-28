import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Client, Room } from 'colyseus.js';
import type { GameState } from '../types/game';

interface ColyseusContextType {
  client: Client | null;
  room: Room<GameState> | null;
  roomId: string | null;
  myPlayerId: string | null;
  isConnected: boolean;
  error: string | null;
  createRoom: (playerName: string, options?: any) => Promise<void>;
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

// Automatically determine the WebSocket URL based on the current location
const getDefaultServerUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'ws://localhost:2567';
  }
  
  // In production, use the same host as the page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const ColyseusProvider: React.FC<ColyseusProviderProps> = ({ 
  children, 
  serverUrl = getDefaultServerUrl()
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

  const createRoom = async (playerName: string, options: any = {}) => {
    console.log('createRoom called with:', playerName, options, 'client exists:', !!client);
    if (!client) {
      console.error('No client available!');
      return;
    }
    
    try {
      setError(null);
      console.log('Calling client.create...');
      const newRoom = await client.create<GameState>('heartoffive', { name: playerName, ...options });
      console.log('Created room:', newRoom.roomId, 'sessionId:', newRoom.sessionId);
      setRoom(newRoom);
      setRoomId(newRoom.roomId);
      setMyPlayerId(newRoom.sessionId);
      setIsConnected(true);
      console.log('Room state updated - should be connected now');
      
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