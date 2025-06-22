import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.describe('Heart of Five Game Flow', () => {
  let roomId: string;
  let player1Name: string;
  let player2Name: string;

  test.beforeEach(async ({ page }) => {
    // Generate unique names for this test
    player1Name = `Test1_${uuidv4().substring(0, 8)}`;
    player2Name = `Test2_${uuidv4().substring(0, 8)}`;
  });

  test('should create room and join game', async ({ page, context }) => {
    // Player 1 creates a room
    await page.goto('http://localhost:3001');
    
    // Enter player name
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    
    // Create room
    await page.click('button:has-text("Create New Room")');
    
    // Wait for room to be created - should see room code
    await expect(page.locator('text=Room:')).toBeVisible();
    await expect(page.locator('button:has-text("Copy Code")')).toBeVisible();
    
    // Get room ID from the displayed text
    const roomCodeElement = await page.locator('.font-mono').first();
    roomId = await roomCodeElement.textContent() || '';
    expect(roomId).toBeTruthy();
    
    // Open new page for Player 2
    const page2 = await context.newPage();
    await page2.goto('http://localhost:3001');
    
    // Player 2 enters name and room code
    await page2.fill('input[placeholder="Enter your name"]', player2Name);
    await page2.fill('input[placeholder="Enter room code"]', roomId);
    await page2.click('button:has-text("Join Room")');
    
    // Wait for both players to be in the room
    await expect(page.locator('text=' + player2Name)).toBeVisible();
    await expect(page2.locator('text=' + player1Name)).toBeVisible();
    
    // Check that we're in the waiting room
    await expect(page.locator('h2:has-text("Waiting for Players")')).toBeVisible();
    await expect(page2.locator('h2:has-text("Waiting for Players")')).toBeVisible();
    
    // Clean up
    await page.close();
    await page2.close();
  });

  test('should start game with bots', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    
    // Wait for waiting room
    await expect(page.locator('h2:has-text("Waiting for Players")')).toBeVisible();
    
    // Add bots to fill the room
    await page.click('button:has-text("Fill Room with Bots")');
    
    // Wait for bots to join - should see their names in the player list
    await expect(page.locator('text=Aggressive Annie')).toBeVisible();
    await expect(page.locator('text=Cautious Carl')).toBeVisible();
    await expect(page.locator('text=Balanced Betty')).toBeVisible();
    
    // Start the game
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start - should transition from WAITING to PLAYING phase
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Should see player hand at the bottom
    await expect(page.locator('h3:has-text("My Hand")')).toBeVisible();
    
    // Should see action buttons
    await expect(page.locator('button:has-text("Pass")')).toBeVisible();
    await expect(page.locator('button:has-text("Play")')).toBeVisible();
    
    // Clean up
    await page.close();
  });

  test('should send and receive chat messages', async ({ page, context }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    
    // Get room code
    const roomCodeElement = await page.locator('.font-mono').first();
    roomId = await roomCodeElement.textContent() || '';
    
    // Player 2 joins
    const page2 = await context.newPage();
    await page2.goto('http://localhost:3001');
    await page2.fill('input[placeholder="Enter your name"]', player2Name);
    await page2.fill('input[placeholder="Enter room code"]', roomId);
    await page2.click('button:has-text("Join Room")');
    
    // Wait for both players
    await expect(page.locator('text=' + player2Name)).toBeVisible();
    await expect(page2.locator('text=' + player1Name)).toBeVisible();
    
    // Player 1 sends a chat message
    const message1 = 'Hello from Player 1!';
    await page.fill('input[placeholder="Type a message..."]', message1);
    await page.click('button:has-text("Send")');
    
    // Verify message appears for both players
    await expect(page.locator('.chat-bubble').filter({ hasText: message1 })).toBeVisible();
    await expect(page2.locator('.chat-bubble').filter({ hasText: message1 })).toBeVisible();
    
    // Verify sender name
    await expect(page.locator('.text-xs.font-semibold').filter({ hasText: player1Name })).toBeVisible();
    
    // Player 2 sends a reply
    const message2 = 'Hi Player 1!';
    await page2.fill('input[placeholder="Type a message..."]', message2);
    await page2.click('button:has-text("Send")');
    
    // Verify message appears for both players
    await expect(page.locator('.chat-bubble').filter({ hasText: message2 })).toBeVisible();
    await expect(page2.locator('.chat-bubble').filter({ hasText: message2 })).toBeVisible();
    
    // Clean up
    await page.close();
    await page2.close();
  });

  test('should show system messages', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    
    // Should see welcome message
    await expect(page.locator('.alert').filter({ hasText: `👋 ${player1Name} joined the game` })).toBeVisible();
    
    // Add bots and start game
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Should see game started message
    await expect(page.locator('.alert').filter({ hasText: '🎮 Game started!' })).toBeVisible();
    
    // Clean up
    await page.close();
  });

  test('should handle custom bot creation', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    
    // Expand advanced options
    await page.click('summary:has-text("Advanced Options")');
    
    // Create custom bot
    const customBotName = 'TestBot';
    await page.fill('#custom-bot-name', customBotName);
    await page.fill('#custom-bot-skill', '7');
    await page.click('button:has-text("Add Custom Bot")');
    
    // Verify bot was added
    await expect(page.locator(`text=${customBotName}`)).toBeVisible();
    
    // Should see bot in player list with skill level badge
    await expect(page.locator('.badge').filter({ hasText: 'Skill: 7' })).toBeVisible();
    
    // Clean up
    await page.close();
  });

  test('should show player status indicators', async ({ page }) => {
    // Create room and start game with bots
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Check for player indicators
    // Current turn should have warning outline and clock emoji
    await expect(page.locator('.outline.outline-warning')).toBeVisible();
    await expect(page.locator('text=⏰')).toBeVisible();
    
    // Own player should have primary background
    await expect(page.locator('.bg-primary\\/20').filter({ hasText: player1Name })).toBeVisible();
    
    // Check "You" badge
    await expect(page.locator('.badge.badge-primary:has-text("You")')).toBeVisible();
    
    // Clean up
    await page.close();
  });

  test('should play cards', async ({ page }) => {
    // Create room and start game with bots
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', player1Name);
    await page.click('button:has-text("Create New Room")');
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Wait for it to be our turn
    const myPlayerElement = page.locator('.bg-primary\\/20').filter({ hasText: player1Name });
    
    // If we're not the current player, pass until it's our turn
    while (!(await myPlayerElement.locator('.outline.outline-warning').count())) {
      // Check if someone else's turn
      const currentTurnPlayer = await page.locator('.outline.outline-warning').first();
      if (await currentTurnPlayer.count() > 0) {
        // Wait a bit for bots to play
        await page.waitForTimeout(2000);
      }
    }
    
    // Click on a card to select it
    const cards = page.locator('.playing-card-sm');
    if (await cards.count() > 0) {
      await cards.first().click();
      
      // Card should be selected
      await expect(cards.first()).toHaveClass(/card-selected/);
      
      // Play button should show (1)
      await expect(page.locator('button:has-text("Play (1)")')).toBeVisible();
      
      // Play the card
      await page.click('button:has-text("Play (1)")');
      
      // Should see the play in chat
      await expect(page.locator('.chat-bubble:has-text("(played)")')).toBeVisible();
    }
    
    // Clean up
    await page.close();
  });
});