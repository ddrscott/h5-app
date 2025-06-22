const { chromium } = require('playwright');

async function testTurnSync() {
  console.log('Testing turn synchronization...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });

  try {
    // Create room with first player
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    // Enable console logging
    page1.on('console', msg => {
      if (msg.text().includes('currentTurnPlayerId') || 
          msg.text().includes('myPlayerId') ||
          msg.text().includes('isMyTurn')) {
        console.log(`[Player 1] ${msg.text()}`);
      }
    });
    
    await page1.goto('http://localhost:2567');
    await page1.fill('input[placeholder="Enter your name"]', 'Player1');
    await page1.click('button:has-text("Create New Room")');
    await page1.waitForSelector('#shareLink');
    
    const roomCode = (await page1.inputValue('#shareLink')).split('room=')[1];
    console.log('Room created:', roomCode);
    
    // Join with 3 more players
    const pages = [page1];
    for (let i = 2; i <= 4; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Enable console logging for each player
      page.on('console', msg => {
        if (msg.text().includes('currentTurnPlayerId') || 
            msg.text().includes('myPlayerId') ||
            msg.text().includes('isMyTurn')) {
          console.log(`[Player ${i}] ${msg.text()}`);
        }
      });
      
      await page.goto(`http://localhost:2567/?room=${roomCode}`);
      await page.fill('input[placeholder="Enter your name"]', `Player${i}`);
      await page.click('button:has-text("Join Room")');
      pages.push(page);
    }
    
    // Wait for game to start
    console.log('\\nWaiting for game to start...');
    await Promise.all(pages.map(p => 
      p.waitForSelector('#gameArea', { state: 'visible', timeout: 10000 })
    ));
    
    // Give state time to sync
    await pages[0].waitForTimeout(2000);
    
    // Check state for each player
    console.log('\\nChecking state for each player:');
    for (let i = 0; i < 4; i++) {
      const currentTurn = await pages[i].textContent('#currentTurn');
      const isWaitingVisible = await pages[i].isVisible('#waitingFor');
      const waitingText = isWaitingVisible ? await pages[i].textContent('#waitingFor') : 'Not visible';
      
      console.log(`\\nPlayer ${i+1}:`);
      console.log(`  Current Turn shows: ${currentTurn}`);
      console.log(`  Waiting indicator: ${waitingText}`);
      
      // Check who has animation
      const animatedPlayer = await pages[i].$('.player.current-turn');
      if (animatedPlayer) {
        const playerName = await animatedPlayer.textContent();
        console.log(`  Animated player: ${playerName}`);
      }
      
      // Check if they have 3H
      const cards = await pages[i].$$('.card');
      for (const card of cards) {
        const text = await card.textContent();
        if (text.includes('3') && text.includes('♥')) {
          console.log(`  Has 3♥!`);
          
          // Try to play it
          await card.click();
          await pages[i].waitForTimeout(500);
          
          const playBtn = await pages[i].$('.play-button');
          const isDisabled = await playBtn.evaluate(el => el.disabled);
          console.log(`  Play button disabled: ${isDisabled}`);
          
          if (!isDisabled) {
            await playBtn.click();
            console.log(`  Clicked play button!`);
          }
          break;
        }
      }
    }
    
    // Wait a bit then check if card was played
    await pages[0].waitForTimeout(2000);
    const currentMeld = await pages[0].textContent('#currentMeldInfo');
    console.log(`\\nCurrent meld shows: ${currentMeld}`);
    
    // Take screenshot
    await pages[0].screenshot({ path: 'turn-sync-test.png' });
    
    console.log('\\nTest complete! Browser will stay open for inspection.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTurnSync().catch(console.error);