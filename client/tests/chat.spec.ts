import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.describe('Chat Feature', () => {
  let roomId: string;
  let player1Name: string;
  let player2Name: string;

  test.beforeEach(async ({ page }) => {
    // Generate unique names for this test
    player1Name = `Test1_${uuidv4().substring(0, 8)}`;
    player2Name = `Test2_${uuidv4().substring(0, 8)}`;
  });

  test('should create room and send chat messages', async ({ page, context }) => {
    // Player 1 creates a room
    await page.goto('http://localhost:3001');
    
    // Enter player name
    await page.fill('input.player-name-input', player1Name);
    
    // Create room
    await page.click('button:has-text("Create Room")');
    
    // Wait for room to be created
    await expect(page.locator('.waiting-room')).toBeVisible();
    
    // Get room ID from URL
    const url = page.url();
    const urlParams = new URLSearchParams(new URL(url).search);
    roomId = urlParams.get('room') || '';
    expect(roomId).toBeTruthy();
    
    // Open new page for Player 2
    const page2 = await context.newPage();
    await page2.goto(`http://localhost:3001?room=${roomId}`);
    
    // Player 2 joins
    await page2.fill('input.player-name-input', player2Name);
    await page2.click('button:has-text("Join Room")');
    
    // Wait for both players to be in the room
    await expect(page.locator('.player-info').filter({ hasText: player2Name })).toBeVisible();
    await expect(page2.locator('.player-info').filter({ hasText: player1Name })).toBeVisible();
    
    // Start the game (Player 1)
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.game-main-area')).toBeVisible();
    await expect(page2.locator('.game-main-area')).toBeVisible();
    
    // Player 1 sends a chat message
    const message1 = 'Hello from Player 1!';
    await page.fill('.chat-input', message1);
    await page.click('.chat-send-button');
    
    // Verify message appears for both players
    await expect(page.locator('.chat-message').filter({ hasText: message1 })).toBeVisible();
    await expect(page2.locator('.chat-message').filter({ hasText: message1 })).toBeVisible();
    
    // Player 2 sends a chat message
    const message2 = 'Hi Player 1!';
    await page2.fill('.chat-input', message2);
    await page2.click('.chat-send-button');
    
    // Verify message appears for both players
    await expect(page.locator('.chat-message').filter({ hasText: message2 })).toBeVisible();
    await expect(page2.locator('.chat-message').filter({ hasText: message2 })).toBeVisible();
    
    // Verify message author names
    await expect(page.locator('.message-author').filter({ hasText: player1Name })).toBeVisible();
    await expect(page.locator('.message-author').filter({ hasText: player2Name })).toBeVisible();
    
    // Clean up
    await page.close();
    await page2.close();
  });

  test('should show game events in play history', async ({ page, context }) => {
    // Player 1 creates a room
    await page.goto('http://localhost:3001');
    await page.fill('input.player-name-input', player1Name);
    await page.click('button:has-text("Create Room")');
    
    // Get room ID
    const url = page.url();
    const urlParams = new URLSearchParams(new URL(url).search);
    roomId = urlParams.get('room') || '';
    
    // Player 2 joins
    const page2 = await context.newPage();
    await page2.goto(`http://localhost:3001?room=${roomId}`);
    await page2.fill('input.player-name-input', player2Name);
    await page2.click('button:has-text("Join Room")');
    
    // Wait for join event
    await expect(page.locator('.history-event').filter({ hasText: `${player2Name} joined the game` })).toBeVisible();
    
    // Start game
    await page.click('button:has-text("Start Game")');
    
    // Wait for game started event
    await expect(page.locator('.history-event').filter({ hasText: 'Game started!' })).toBeVisible();
    await expect(page2.locator('.history-event').filter({ hasText: 'Game started!' })).toBeVisible();
    
    // Clean up
    await page.close();
    await page2.close();
  });

  test('should handle long messages and message limits', async ({ page }) => {
    // Create room and start game
    await page.goto('http://localhost:3001');
    await page.fill('input.player-name-input', player1Name);
    await page.click('button:has-text("Create Room")');
    
    // Wait for room creation
    await expect(page.locator('.waiting-room')).toBeVisible();
    
    // Try to send a very long message (should be truncated to 200 chars)
    const longMessage = 'a'.repeat(250);
    await page.click('button:has-text("Start Game")');
    await expect(page.locator('.game-main-area')).toBeVisible();
    
    await page.fill('.chat-input', longMessage);
    await page.click('.chat-send-button');
    
    // Verify message is truncated
    const messageElement = page.locator('.chat-message .message-text').last();
    const messageText = await messageElement.textContent();
    expect(messageText?.length).toBeLessThanOrEqual(200);
    
    // Clean up
    await page.close();
  });

  test('should style own messages differently', async ({ page }) => {
    // Create room and start game
    await page.goto('http://localhost:3001');
    await page.fill('input.player-name-input', player1Name);
    await page.click('button:has-text("Create Room")');
    
    // Start game
    await page.click('button:has-text("Start Game")');
    await expect(page.locator('.game-main-area')).toBeVisible();
    
    // Send a message
    await page.fill('.chat-input', 'My message');
    await page.click('.chat-send-button');
    
    // Check that own message has special class
    await expect(page.locator('.chat-message.own-message')).toBeVisible();
    
    // Clean up
    await page.close();
  });
});