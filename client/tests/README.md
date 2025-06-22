# Playwright Tests for Heart of Five

This directory contains end-to-end tests for the Heart of Five game using Playwright.

## Running Tests

From the `client` directory:

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all tests
npm test

# Run tests with UI mode (recommended for debugging)
npm run test:ui

# Run specific test file
npx playwright test game-flow.spec.ts

# Run tests in headed mode (see the browser)
npx playwright test --headed

# Generate test report
npx playwright show-report
```

## Test Files

- `game-flow.spec.ts` - Tests the basic game flow: creating rooms, joining games, chat, and basic gameplay
- `bot-gameplay.spec.ts` - Tests bot-specific functionality: bot behaviors, custom bots, and AI gameplay

## Writing New Tests

The tests use the current Tailwind/DaisyUI UI structure. Key selectors:

- Buttons: Use exact text content, e.g., `button:has-text("Create New Room")`
- Inputs: Use placeholder text, e.g., `input[placeholder="Enter your name"]`
- Game elements: Use CSS classes like `.badge`, `.alert`, `.chat-bubble`
- Player indicators: `.outline.outline-warning` (current turn), `.bg-primary\/20` (self)

## Debugging Tests

1. Use `npm run test:ui` to open the Playwright UI where you can:
   - See each test step
   - View screenshots
   - Time travel through the test
   - See the browser state at each step

2. Use `page.pause()` in tests to pause execution and debug in the browser

3. The tests automatically start both the server (port 2567) and client (port 3001) before running

## Notes

- Tests run in parallel by default
- Each test uses unique player names to avoid conflicts
- The webServer configuration ensures both backend and frontend are running
- Tests will reuse existing servers if they're already running