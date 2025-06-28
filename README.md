# Heart of Five (红心五)

A real-time multiplayer card shedding game built with Colyseus and React. Race to be the first to play all your cards while mastering the power of the legendary Heart 5!

## Game Overview

Heart of Five is a strategic card game for 2-6 players where the goal is to be the first to empty your hand. What makes this game unique is the Heart 5 - the most powerful card that can beat any combination, adding exciting strategic depth to every game.

## Terminology

Understanding the game structure:

- **Trick/Round**: One play sequence where the leader plays a meld, others follow suit or pass, and a new leader is established
- **Game**: Multiple tricks played until all players except one are out of cards. The last player with cards loses the game
- **Session**: Multiple games played consecutively with cumulative win/loss tracking

## Game Flow

1. **Setup**: Cards are dealt evenly to all players from a standard 52-card deck
2. **First Trick**: The player with 3♥ leads the first trick
3. **Playing Tricks**: 
   - The leader plays any valid meld (single, pair, triple, or special combination)
   - Other players must play a higher meld of the same type or pass
   - When all players pass, the last player to play becomes the new leader
4. **Winning**: 
   - Players who run out of cards are ranked by order (1st, 2nd, etc.)
   - The first player out wins the game
   - The last player with cards loses the game
5. **Game Over**: 
   - Stats screen shows cumulative wins (1st place) and losses (last place)
   - Players can choose to play another game or leave
   - There's no target number of games - play continues as long as desired

## Card Rankings

From lowest to highest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2

**Special Card**: The Heart 5 (♥5) beats any combination!

## Valid Melds

- **Single**: Any single card
- **Pair**: Two cards of the same rank
- **Triple**: Three cards of the same rank
- **Bomb**: Four cards of the same rank (beats most combinations)
- **Run/Straight**: 5+ consecutive cards (e.g., 7-8-9-10-J)
- **Sisters**: 3+ consecutive pairs (e.g., 77-88-99)
- **Full House**: Triple + Pair (e.g., 777-88)

## Installation & Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Server Setup
```bash
# Install dependencies
npm install

# Start the game server
npm start
```

The server will start on http://localhost:2567

### Client Setup
```bash
# Navigate to client directory
cd client-v2

# Install dependencies
npm install

# Start development server
npm run dev
```

The client will be available at http://localhost:5174

## Development

### Project Structure
```
├── src/                    # Server code
│   ├── rooms/             # Game room logic
│   │   ├── HeartOfFive.ts # Main game room
│   │   └── schema/        # Game state schemas
│   └── index.ts           # Server entry point
├── client-v2/             # React client
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   └── types/         # TypeScript types
│   └── vite.config.ts     # Vite configuration
└── package.json
```

### Key Technologies
- **Server**: Colyseus, Node.js, TypeScript
- **Client**: React, TypeScript, Vite, Tailwind CSS
- **Real-time**: WebSockets via Colyseus
- **PWA**: Service Workers with Workbox

### Testing
```bash
# Run server tests
npm test

# Run client tests
cd client-v2 && npm test
```

### Building for Production
```bash
# Build both server and client
npm run build

# Server build only
npm run build:server

# Client build only
cd client-v2 && npm run build
```

## Deployment

The game requires both the server and client to be deployed:

1. **Server**: Deploy to any Node.js hosting service (Heroku, Railway, etc.)
   - Ensure WebSocket support is enabled
   - Set environment variables as needed

2. **Client**: Deploy to any static hosting service (Netlify, Vercel, etc.)
   - Update the server URL in the client configuration
   - The PWA will work offline for cached assets but requires connection for gameplay

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT