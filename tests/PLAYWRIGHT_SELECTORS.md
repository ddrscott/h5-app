# Playwright Test Selectors for Heart of Five

This document lists all the actual selectors found in the UI components that should be used in Playwright tests.

## 1. Lobby Component (Initial Screen)

### Player Name Input
- **Input field**: `input[placeholder="Enter your name"]`
- **Properties**: 
  - type="text"
  - maxLength={20}
  - className="input input-bordered w-full"

### Room Creation/Joining Buttons
- **Create New Room**: `button:has-text("Create New Room")`
  - className="btn btn-primary btn-lg"
- **Join Random Room**: `button:has-text("Join Random Room")`
  - className="btn btn-secondary btn-lg"
- **Room Code Collapse**: `input[type="checkbox"]` (for expanding room code section)
  - Parent has className="collapse collapse-arrow bg-base-300"

### Room Code Section
- **Room Code Input**: `input[placeholder="Enter room code"]`
  - className="input input-bordered join-item flex-1"
- **Join Room Button**: `button:has-text("Join Room")`
  - className="btn join-item"

### Error Alert
- **Error Container**: `.alert.alert-error`
  - Contains error message text

## 2. WaitingRoom Component

### Room Sharing
- **Room ID Display**: `input[readOnly][class*="font-mono"]`
  - Shows the room code
- **Copy Code Button**: `button:has-text("Copy Code")`
- **Copy Link Button**: `button:has-text("Copy Link")`

### Game Control
- **Start Game Button**: `button:has-text("Start Game (2-4 players)")`
  - className="btn btn-primary btn-lg"

### Bot Controls
- **Fill Room Button**: `button:has-text("Fill Room with Bots")`
  - className="btn btn-primary btn-sm"
- **Remove All Bots**: `button:has-text("Remove All Bots")`
  - className="btn btn-error btn-sm"

### Pre-configured Bot Buttons
- **Rookie Ricky**: `button:has-text("🎓 Rookie Ricky")`
- **Balanced Betty**: `button:has-text("⚖️ Balanced Betty")`
- **Aggressive Annie**: `button:has-text("🔥 Aggressive Annie")`
- **Cautious Carl**: `button:has-text("🛡️ Cautious Carl")`
- **Expert Emma**: `button:has-text("👑 Expert Emma")`
- **Silent Sam**: `button:has-text("🤐 Silent Sam")`

### Advanced Bot Options
- **Custom Bot Name**: `input#custom-bot-name`
- **Custom Bot Skill**: `select#custom-bot-skill`
- **Add Custom Bot**: Last button with text "Add" in advanced section

## 3. GameBoard Component

### Navigation Bar
- **Game Title**: `h1:has-text("❤️ Heart of Five 🃏")`
- **Round Badge**: `.badge:has-text("Round:")`
- **Phase Badge**: `.badge:has-text("Phase:")`
- **Room Badge**: `.badge:has-text("Room:")`
- **Leave Game Button**: `button:has-text("Leave Game")`
  - className="btn btn-error btn-sm"

### Round/Game End Screens
- **Round Complete Title**: `h2:has-text("Round Complete!")`
- **Game Over Title**: `h2:has-text("Game Over!")`
- **Start Next Round**: `button:has-text("Start Next Round")`
  - className="btn btn-primary btn-lg"

### Debug Info
- **Debug Collapse**: `details.collapse summary:has-text("Debug Info")`

## 4. Chat Component

### Chat Interface
- **Chat Title**: `h3:has-text("Chat")`
- **Message Input**: `input[placeholder="Type a message..."]`
  - type="text"
  - maxLength={200}
  - className="input input-bordered join-item flex-1"
- **Send Button**: `button:has-text("Send")`
  - className="btn btn-primary join-item"

### Message Types
- **System Messages**: `.alert` (with various alert types)
- **Player Messages**: `.chat-bubble`
- **Own Messages**: `.chat-end .chat-bubble-primary`
- **Other Messages**: `.chat-start .chat-bubble`

## 5. PlayersList Component

### Player List
- **Players Title**: `h3:has-text("Players")`
- **Player Items**: `.space-y-2 > div` (each player)
- **Current Player Indicator**: `.outline.outline-warning`
- **My Player**: `.bg-primary\\/20`
- **You Badge**: `.badge:has-text("You")`
- **Leader Icon**: `span:has-text("👑")`
- **Turn Timer**: `span:has-text("⏰")`

### Player Status
- **Pass Badge**: `.badge.badge-warning:has-text("PASS")`
- **Won Badge**: `.badge.badge-success:has-text("🏆 WON")`
- **Out Badge**: `.badge.badge-error:has-text("OUT")`

## 6. PlayerHand Component

### Card Table
- **Card Elements**: `.playing-card-sm`
- **Selected Cards**: `.card-selected`
- **Special Cards**: `.card-special`
- **Disabled Cards**: `.opacity-60.cursor-not-allowed`

### Action Buttons
- **Pass Button**: `button:has-text("Pass")`
  - className="btn btn-error btn-sm"
- **Play Button**: Button with text matching `/Play \(\d+\)/`
  - className="btn btn-success btn-sm"

### Turn Indicators
- **Leader Message**: `span:has-text("👑 You're the leader")`
- **Error Message**: `.text-error:has-text("⚠️")`

## CSS Classes for State

### Card States
- `.card-selected` - Selected cards
- `.card-hover` - Hoverable cards (when it's player's turn)
- `.card-special` - Special cards (hearts, jokers)

### Player States
- `.bg-primary\\/20` - Current player's row
- `.outline.outline-warning` - Player whose turn it is
- `.animate-pulse` - Animated elements (turn indicator, errors)

### Button States
- `button:disabled` - Disabled buttons
- `.loading.loading-spinner` - Loading states

## Data Attributes and IDs

While the components primarily use class-based styling, some elements have unique identifiers:
- `#custom-bot-name` - Custom bot name input
- `#custom-bot-skill` - Custom bot skill selector

## Best Practices for Test Selectors

1. **Text-based selectors** are most reliable for buttons: `button:has-text("exact text")`
2. **Placeholder selectors** work well for inputs: `input[placeholder="..."]`
3. **Class combinations** for specific states: `.btn.btn-primary:not(:disabled)`
4. **Parent-child relationships** for nested elements: `.chat-end .chat-bubble`
5. **Regex patterns** for dynamic text: `/Play \(\d+\)/`

## Example Test Scenarios

```typescript
// Join a game
await page.fill('input[placeholder="Enter your name"]', 'TestPlayer');
await page.click('button:has-text("Create New Room")');

// Wait for room and add bots
await page.waitForSelector('button:has-text("Fill Room with Bots")');
await page.click('button:has-text("Fill Room with Bots")');

// Start game
await page.click('button:has-text("Start Game (2-4 players)")');

// Play cards (when it's your turn)
await page.click('.playing-card-sm:not(.opacity-60)');
await page.click('button:has-text("Play (1)")');

// Send chat message
await page.fill('input[placeholder="Type a message..."]', 'Hello!');
await page.click('button:has-text("Send")');
```