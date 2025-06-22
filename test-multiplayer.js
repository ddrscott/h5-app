const { chromium } = require('playwright');

async function testMultiplayer() {
  console.log('Starting multiplayer test...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for visibility
  });

  // Create 4 browser contexts (like different users)
  const contexts = [];
  const pages = [];
  
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({
      viewport: { width: 800, height: 900 }
    });
    const page = await context.newPage();
    contexts.push(context);
    pages.push(page);
  }

  try {
    // Player 1 creates a room
    console.log('Player 1 creating room...');
    await pages[0].goto('http://localhost:2567');
    await pages[0].fill('input[placeholder="Enter your name"]', 'Player 1');
    await pages[0].click('button:has-text("Create New Room")');
    
    // Wait for room to be created
    await pages[0].waitForSelector('#shareLink', { timeout: 5000 });
    const roomLink = await pages[0].inputValue('#shareLink');
    console.log('Room created! Link:', roomLink);
    
    // Extract room code from link
    const roomCode = roomLink.split('room=')[1];
    console.log('Room code:', roomCode);
    
    // Other players join
    for (let i = 1; i < 4; i++) {
      console.log(`Player ${i + 1} joining...`);
      await pages[i].goto(`http://localhost:2567/?room=${roomCode}`);
      await pages[i].fill('input[placeholder="Enter your name"]', `Player ${i + 1}`);
      await pages[i].click('button:has-text("Join Room")');
      await pages[i].waitForTimeout(1000);
    }
    
    // Wait for game to start
    console.log('Waiting for game to start...');
    await pages[0].waitForSelector('#gameArea', { 
      state: 'visible',
      timeout: 10000 
    });
    
    console.log('Game started!');
    
    // Check each player's state
    for (let i = 0; i < 4; i++) {
      console.log(`\nChecking Player ${i + 1}...`);
      
      // Check if in game
      const isInGame = await pages[i].isVisible('#gameArea');
      console.log(`- In game: ${isInGame}`);
      
      if (isInGame) {
        // Get current turn
        const currentTurn = await pages[i].textContent('#currentTurn');
        console.log(`- Current turn shows: ${currentTurn}`);
        
        // Check if it's their turn
        const myName = `Player ${i + 1}`;
        const isMyTurn = currentTurn === myName;
        console.log(`- Is my turn: ${isMyTurn}`);
        
        // Count cards
        const cardCount = await pages[i].textContent('#cardCount');
        console.log(`- Cards in hand: ${cardCount}`);
        
        // Check for cards
        const cards = await pages[i].$$('.card');
        console.log(`- Card elements found: ${cards.length}`);
        
        // If it's their turn, try clicking a card
        if (isMyTurn && cards.length > 0) {
          console.log('- Attempting to click first card...');
          await cards[0].click();
          await pages[i].waitForTimeout(500);
          
          // Check if play button is enabled
          const playButton = await pages[i].$('.play-button');
          const isDisabled = await playButton.evaluate(el => el.disabled);
          console.log(`- Play button disabled: ${isDisabled}`);
          
          // Get console logs
          pages[i].on('console', msg => {
            if (msg.type() === 'log') {
              console.log(`  Console: ${msg.text()}`);
            }
          });
        }
      }
    }
    
    // Take screenshots
    for (let i = 0; i < 4; i++) {
      await pages[i].screenshot({ 
        path: `player${i + 1}-state.png`,
        fullPage: true 
      });
    }
    
    console.log('\nScreenshots saved!');
    console.log('Test will continue running. Press Ctrl+C to stop.');
    
    // Keep running to observe
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error);
    
    // Take error screenshots
    for (let i = 0; i < 4; i++) {
      try {
        await pages[i].screenshot({ 
          path: `player${i + 1}-error.png`,
          fullPage: true 
        });
      } catch (e) {}
    }
  }
}

testMultiplayer().catch(console.error);