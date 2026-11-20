import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Client, Room } from '../net/rooms';
import type { ConnectionStatus, ConnectionInfo } from '../net/rooms';
import { ConnectError } from '../net/rooms';
import { saveSeat, clearSeat } from '../net/seat';
import type { Seat } from '../net/seat';
import type { GameState } from '../types/game';
import { useAccount } from './AccountContext';
import type { Bucket } from '../net/account';

/**
 * Whether the game in play counts toward the signed-in player's stats. "tracking" comes from the
 * room at the deal; "saved" once the result is written.
 */
export interface StatsStatus {
  state: 'none' | 'tracking' | 'saved';
  bucket?: Bucket;
}

interface RoomContextType {
  client: Client | null;
  room: Room<GameState> | null;
  roomId: string | null;
  myPlayerId: string | null;
  isConnected: boolean;
  error: string | null;
  /** The live socket's state; "lost" means it gave up and `lost` says why. */
  connection: ConnectionStatus;
  lost: ConnectionInfo | null;
  createRoom: (playerName: string, options?: any) => Promise<void>;
  joinRoom: (playerName: string, roomId?: string) => Promise<void>;
  /** Takes a saved seat back. Resolves false (and sets `error`) when it can't. */
  resumeRoom: (seat: Seat) => Promise<boolean>;
  leaveRoom: () => void;
  statsStatus: StatsStatus;
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
  // The game server is this same Worker, under /h5/api (src/client/net/rooms.ts).
  const [client] = useState<Client | null>(() => new Client());
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('connected');
  const [lost, setLost] = useState<ConnectionInfo | null>(null);
  const [statsStatus, setStatsStatus] = useState<StatsStatus>({ state: 'none' });
  const { onSignedIn } = useAccount();

  // Listens for the whole life of the room, so a message that lands mid-game isn't missed.
  useEffect(() => {
    if (!room) return;
    const offs = [
      room.listen('game_started', () => setStatsStatus({ state: 'none' })),
      room.listen('stats_tracking', (d: { bucket: Bucket }) => setStatsStatus({ state: 'tracking', bucket: d.bucket })),
      room.listen('stats_saved', (d: { bucket: Bucket }) => setStatsStatus({ state: 'saved', bucket: d.bucket })),
    ];
    return () => offs.forEach((off) => off());
  }, [room]);

  // Signing in mid-session: reopen the socket so the room picks up the account for the next deal.
  useEffect(() => onSignedIn(() => { void room?.refresh().catch(() => {}); }), [room, onSignedIn]);

  /** Every way into a room ends here: remember the seat so a reload can take it back. */
  const seated = (newRoom: Room<GameState>) => {
    saveSeat({ roomId: newRoom.roomId, sessionId: newRoom.sessionId, token: newRoom.token });
    setConnection('connected');
    setLost(null);
    setRoom(newRoom);
    setRoomId(newRoom.roomId);
    setMyPlayerId(newRoom.sessionId);
    setIsConnected(true);
  };

  useEffect(() => {
    if (!room) return;
    return room.onConnection((status, info) => {
      setConnection(status);
      if (status === 'lost') {
        setLost(info);
        if (info.seatGone) clearSeat();
      }
    });
  }, [room]);
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
      seated(newRoom);
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
      seated(newRoom);
      
      // Update URL with room ID
      const url = new URL(window.location.href);
      url.searchParams.set('room', newRoom.roomId);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsConnected(false);
    }
  };

  const resumeRoom = async (seat: Seat): Promise<boolean> => {
    if (!client) return false;
    try {
      setError(null);
      seated(await client.resume<GameState>(seat.roomId, seat.sessionId, seat.token));
      return true;
    } catch (err) {
      // The room said no (seat or room gone): forget the seat so the next try joins fresh.
      if (err instanceof ConnectError && err.code >= 4000) clearSeat();
      setError(err instanceof Error ? err.message : 'Could not take your seat back');
      setIsConnected(false);
      return false;
    }
  };

  const leaveRoom = () => {
    clearSeat();
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
        connection,
        lost,
        createRoom,
        joinRoom,
        resumeRoom,
        leaveRoom,
        statsStatus
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};