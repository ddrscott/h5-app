const { chromium } = require('playwright');

async function testManual() {
  console.log('Starting manual test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });

  try {
    // Create room with first player
    const page1 = await browser.newPage();
    await page1.goto('http://localhost:2567');
    await page1.fill('input[placeholder="Enter your name"]', 'Alice');
    await page1.click('button:has-text("Create New Room")');
    await page1.waitForSelector('#shareLink');
    
    const roomCode = (await page1.inputValue('#shareLink')).split('room=')[1];
    console.log('Room created:', roomCode);
    
    // Join with 3 more players
    const page2 = await browser.newPage();
    await page2.goto(`http://localhost:2567/?room=${roomCode}`);
    await page2.fill('input[placeholder="Enter your name"]', 'Bob');
    await page2.click('button:has-text("Join Room")');
    
    const page3 = await browser.newPage();
    await page3.goto(`http://localhost:2567/?room=${roomCode}`);
    await page3.fill('input[placeholder="Enter your name"]', 'Charlie');
    await page3.click('button:has-text("Join Room")');
    
    const page4 = await browser.newPage();
    await page4.goto(`http://localhost:2567/?room=${roomCode}`);
    await page4.fill('input[placeholder="Enter your name"]', 'David');
    await page4.click('button:has-text("Join Room")');
    
    console.log('All players joined. Waiting for game to start...');
    
    // Wait for game to start on all pages
    await Promise.all([
      page1.waitForSelector('#gameArea', { state: 'visible', timeout: 15000 }),
      page2.waitForSelector('#gameArea', { state: 'visible', timeout: 15000 }),
      page3.waitForSelector('#gameArea', { state: 'visible', timeout: 15000 }),
      page4.waitForSelector('#gameArea', { state: 'visible', timeout: 15000 })
    ]);
    
    console.log('Game started! Check browser windows.');
    console.log('Look for:');
    console.log('1. Who has the 3♥');
    console.log('2. Whether they can play (Play button enabled)');
    console.log('3. The waiting indicator showing who\'s turn it is');
    console.log('4. The pulsing animation on the current player');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testManual().catch(console.error);