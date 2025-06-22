const { chromium } = require('playwright');

async function testGame() {
  console.log('Starting game test...');
  
  const browser = await chromium.launch({ 
    headless: true,
    slowMo: 100
  });

  const contexts = [];
  const pages = [];
  
  // Create 4 players
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen to console
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[Player ${i + 1}] ${msg.text()}`);
      }
    });
    
    contexts.push(context);
    pages.push(page);
  }

  try {
    // Player 1 creates room
    console.log('\n=== Player 1 creating room ===');
    await pages[0].goto('http://localhost:2567');
    await pages[0].fill('input[placeholder="Enter your name"]', 'Alice');
    await pages[0].click('button:has-text("Create New Room")');
    await pages[0].waitForSelector('#shareLink', { timeout: 5000 });
    
    const roomLink = await pages[0].inputValue('#shareLink');
    const roomCode = roomLink.split('room=')[1];
    console.log('Room created:', roomCode);
    
    // Others join
    const names = ['Bob', 'Charlie', 'David'];
    for (let i = 1; i < 4; i++) {
      console.log(`\n=== ${names[i-1]} joining ===`);
      await pages[i].goto(`http://localhost:2567/?room=${roomCode}`);
      await pages[i].fill('input[placeholder="Enter your name"]', names[i-1]);
      await pages[i].click('button:has-text("Join Room")');
      await pages[i].waitForTimeout(1000);
    }
    
    // Wait for game start
    console.log('\n=== Waiting for game to start ===');
    await Promise.all(pages.map(p => 
      p.waitForSelector('#gameArea', { state: 'visible', timeout: 10000 })
    ));
    
    console.log('\nGame started! Checking states...');
    
    // Check each player
    for (let i = 0; i < 4; i++) {
      const name = i === 0 ? 'Alice' : names[i-1];
      console.log(`\n=== ${name} (Player ${i + 1}) ===`);
      
      const currentTurn = await pages[i].textContent('#currentTurn');
      const cardCount = await pages[i].textContent('#cardCount');
      const phase = await pages[i].textContent('#gamePhase');
      
      console.log(`- Current turn: ${currentTurn}`);
      console.log(`- Cards: ${cardCount}`);
      console.log(`- Phase: ${phase}`);
      
      // Check if it's their turn
      const isTheirTurn = currentTurn === name;
      if (isTheirTurn) {
        console.log('- IT IS THEIR TURN!');
        
        // Try clicking a card
        const cards = await pages[i].$$('.card');
        console.log(`- Found ${cards.length} card elements`);
        
        if (cards.length > 0) {
          // Click first card
          await cards[0].click();
          await pages[i].waitForTimeout(500);
          
          // Check button state
          const playBtn = await pages[i].$('.play-button');
          if (playBtn) {
            const disabled = await playBtn.evaluate(el => el.disabled);
            const text = await playBtn.textContent();
            console.log(`- Play button: "${text}" (disabled: ${disabled})`);
          }
        }
        
        // Take screenshot of current player
        await pages[i].screenshot({ 
          path: `current-player-${name}.png`,
          fullPage: true 
        });
      }
    }
    
    console.log('\nTest complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testGame().catch(console.error);