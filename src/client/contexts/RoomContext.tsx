import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Client, Room } from '../net/rooms';
import type { GameState } from '../types/game';

interface RoomContextType {
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

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

interface RoomProviderProps {
  children: ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The game server is this same Worker, under /h5/api (src/client/net/rooms.ts).
  useEffect(() => {
    setClient(new Client());
  }, []);

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
    <RoomContext.Provider 
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
    </RoomContext.Provider>
  );
};