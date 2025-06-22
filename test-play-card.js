const { chromium } = require('playwright');

async function testPlayCard() {
  console.log('Testing card play functionality...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });

  try {
    // Create room with first player
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto('http://localhost:2567');
    await page1.fill('input[placeholder="Enter your name"]', 'TestPlayer1');
    await page1.click('button:has-text("Create New Room")');
    await page1.waitForSelector('#shareLink');
    
    const roomCode = (await page1.inputValue('#shareLink')).split('room=')[1];
    console.log('Room created:', roomCode);
    
    // Join with 3 more players
    const pages = [page1];
    for (let i = 2; i <= 4; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://localhost:2567/?room=${roomCode}`);
      await page.fill('input[placeholder="Enter your name"]', `TestPlayer${i}`);
      await page.click('button:has-text("Join Room")');
      pages.push(page);
    }
    
    // Wait for game to start
    console.log('Waiting for game to start...');
    await Promise.all(pages.map(p => 
      p.waitForSelector('#gameArea', { state: 'visible', timeout: 10000 })
    ));
    
    // Find who has 3 of hearts
    let playerWith3H = -1;
    for (let i = 0; i < 4; i++) {
      const currentTurn = await pages[i].textContent('#currentTurn');
      console.log(`Player ${i+1} sees current turn: ${currentTurn}`);
      
      // Check if they have 3H visible
      const cards = await pages[i].$$('.card');
      for (const card of cards) {
        const text = await card.textContent();
        if (text.includes('3') && text.includes('♥')) {
          playerWith3H = i;
          console.log(`Player ${i+1} has the 3♥!`);
          break;
        }
      }
    }
    
    if (playerWith3H >= 0) {
      console.log(`\nPlayer ${playerWith3H + 1} attempting to play...`);
      const page = pages[playerWith3H];
      
      // Find and click the 3H
      const cards = await page.$$('.card');
      let clicked = false;
      
      for (const card of cards) {
        const text = await card.textContent();
        if (text.includes('3') && text.includes('♥')) {
          console.log('Clicking 3♥...');
          await card.click();
          clicked = true;
          break;
        }
      }
      
      if (clicked) {
        await page.waitForTimeout(1000);
        
        // Check if card is selected
        const selected = await page.$$('.card.selected');
        console.log(`Selected cards: ${selected.length}`);
        
        // Check play button
        const playBtn = await page.$('.play-button');
        const isDisabled = await playBtn.evaluate(el => el.disabled);
        console.log(`Play button disabled: ${isDisabled}`);
        
        if (!isDisabled) {
          console.log('Clicking Play button...');
          await playBtn.click();
          await page.waitForTimeout(2000);
          
          // Check if card was played
          const currentMeld = await page.textContent('#currentMeldInfo');
          console.log('Current meld shows:', currentMeld);
        }
        
        // Take screenshot
        await page.screenshot({ path: 'after-play-attempt.png' });
      }
    }
    
    console.log('\nTest complete! Browser will stay open for inspection.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPlayCard().catch(console.error);