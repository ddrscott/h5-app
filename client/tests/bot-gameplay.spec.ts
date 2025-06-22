import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.describe('Bot Gameplay', () => {
  let playerName: string;

  test.beforeEach(async ({ page }) => {
    playerName = `Human_${uuidv4().substring(0, 8)}`;
  });

  test('bots should play automatically', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    
    // Add all three pre-configured bots
    await page.click('button:has-text("Fill Room with Bots")');
    
    // Verify all bots joined
    await expect(page.locator('text=Aggressive Annie')).toBeVisible();
    await expect(page.locator('text=Cautious Carl')).toBeVisible();
    await expect(page.locator('text=Balanced Betty')).toBeVisible();
    
    // Start game
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Watch for bot plays in the chat
    // Bots should play automatically when it's their turn
    await expect(page.locator('.chat-bubble:has-text("(played)")')).toBeVisible({ timeout: 10000 });
    
    // Should see at least one bot making a move
    const botPlayMessages = page.locator('.chat-bubble').filter({ 
      has: page.locator('text=/Annie|Carl|Betty/') 
    });
    await expect(botPlayMessages).toHaveCount(1, { timeout: 10000 });
  });

  test('bots should pass when they cannot play', async ({ page }) => {
    // Create room with bots
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Watch for pass messages in chat
    // Eventually a bot should pass
    await expect(page.locator('.chat-bubble:has-text("(passed)")')).toBeVisible({ timeout: 30000 });
    
    // The player who passed should show PASS badge
    const passedMessages = await page.locator('.chat-bubble:has-text("(passed)")').all();
    if (passedMessages.length > 0) {
      // Find who passed
      const passedPlayerElement = passedMessages[0];
      const playerNameElement = await passedPlayerElement.locator('../..').locator('.text-xs.font-semibold').textContent();
      
      // That player should have PASS badge in player list
      if (playerNameElement && playerNameElement !== playerName) {
        await expect(page.locator('.badge.badge-warning:has-text("PASS")')).toBeVisible();
      }
    }
  });

  test('custom bot with different skill levels', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    
    // Expand advanced options
    await page.click('summary:has-text("Advanced Options")');
    
    // Add weak bot
    await page.fill('#custom-bot-name', 'WeakBot');
    await page.fill('#custom-bot-skill', '1');
    await page.click('button:has-text("Add Custom Bot")');
    
    // Add strong bot
    await page.fill('#custom-bot-name', 'StrongBot');
    await page.fill('#custom-bot-skill', '10');
    await page.click('button:has-text("Add Custom Bot")');
    
    // Add one more bot to make 4 players
    await page.click('button:has-text("🤖 Balanced Betty")');
    
    // Verify skill badges
    await expect(page.locator('.badge:has-text("Skill: 1")')).toBeVisible();
    await expect(page.locator('.badge:has-text("Skill: 10")')).toBeVisible();
    
    // Start game
    await page.click('button:has-text("Start Game")');
    
    // Both bots should participate
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Watch for their plays - they should have different strategies
    const weakBotPlays = page.locator('.chat-bubble').filter({ 
      has: page.locator('text=WeakBot') 
    });
    const strongBotPlays = page.locator('.chat-bubble').filter({ 
      has: page.locator('text=StrongBot') 
    });
    
    // Both should eventually make moves
    await expect(weakBotPlays.first()).toBeVisible({ timeout: 20000 });
    await expect(strongBotPlays.first()).toBeVisible({ timeout: 20000 });
  });

  test('bots should handle being leader correctly', async ({ page }) => {
    // Create room with bots
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Look for crown emoji indicating leader
    await expect(page.locator('text=👑')).toBeVisible();
    
    // If a bot is leader, they should play (not pass)
    const leaderElement = await page.locator('.flex').filter({ has: page.locator('text=👑') }).first();
    const leaderName = await leaderElement.locator('.font-medium').textContent();
    
    if (leaderName && leaderName !== playerName) {
      // Bot is leader, should see them play
      const leaderPlay = page.locator('.chat-bubble').filter({ 
        hasText: `${leaderName}` 
      }).filter({ 
        hasText: '(played)' 
      });
      await expect(leaderPlay).toBeVisible({ timeout: 10000 });
    }
  });

  test('bots should continue playing after human wins', async ({ page }) => {
    // This test would be complex to fully automate as it requires
    // the human to win, but we can at least verify the game continues
    
    // Create room with bots
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    await page.click('button:has-text("Fill Room with Bots")');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to start
    await expect(page.locator('.badge:has-text("Phase: PLAYING")')).toBeVisible();
    
    // Play for a while - look for position changes
    // When someone goes out, they should show "🏆 WON" badge
    const wonBadge = page.locator('.badge.badge-success:has-text("🏆 WON")');
    
    // This might take a while depending on the game
    // Just verify the game mechanics work
    await page.waitForTimeout(5000);
    
    // Game should still be running with bots playing
    const recentPlays = await page.locator('.chat-bubble:has-text("(played)")').count();
    expect(recentPlays).toBeGreaterThan(0);
  });

  test('bot removal should work correctly', async ({ page }) => {
    // Create room
    await page.goto('http://localhost:3001');
    await page.fill('input[placeholder="Enter your name"]', playerName);
    await page.click('button:has-text("Create New Room")');
    
    // Add a bot
    await page.click('button:has-text("🤖 Aggressive Annie")');
    await expect(page.locator('text=Aggressive Annie')).toBeVisible();
    
    // Remove the bot
    await page.click('button:has-text("Remove").first()');
    
    // Bot should be gone
    await expect(page.locator('text=Aggressive Annie')).not.toBeVisible();
    
    // Can add the bot again
    await page.click('button:has-text("🤖 Aggressive Annie")');
    await expect(page.locator('text=Aggressive Annie')).toBeVisible();
  });
});