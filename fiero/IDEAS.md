# 🦖 Dino Catcher — Ideas & Next Steps

This guide is full of ideas for making the game your own. Start with the easy ones and work your way up!

Each idea shows you **exactly where** to make the change and gives you the **code to copy in**.

---

## 🟢 Tier 1 — Easy Tweaks
*These are small changes to numbers and settings already in the file. Perfect to try on your own!*

---

### 1. Make the game longer or shorter

**Find in Section 4:**
```js
const GAME_TIME = 60;
```
**Try changing to:**
- `30` — super fast and stressful!
- `120` — two full minutes of catching

---

### 2. Make dinos appear faster or slower

**Find in Section 4:**
```js
const DINO_SPEED = 2000;
```
This number is in **milliseconds** (1000 = 1 second).
- `800` — dinos appear very fast (hard mode!)
- `4000` — dinos appear slowly (easy mode)

---

### 3. Change how many dinos are on screen at once

**Find in Section 4:**
```js
const MAX_DINOS = 6;
```
Try `3` for a calmer game, or `10` for total chaos!

---

### 4. Change how long before a dino escapes

**Find in Section 4:**
```js
const DINO_LIFE = 4000;
```
- `2000` — dinos disappear in 2 seconds (very hard!)
- `8000` — dinos stick around for 8 seconds (easy)

---

### 5. Make dinos bigger or smaller

**Find in Section 2 (inside the `<style>` tag):**
```css
--dino-size: 90px;
```
Try `130px` for giant dinos or `50px` for tiny ones!

---

### 6. Add your own dinosaur

**Find in Section 3 — the `DINOSAURS` list:**

Add a new line anywhere inside the list. Here are some to try:

```js
// Copy one of these lines and paste it into the DINOSAURS list!
{ name: "Diplodocus",    emoji: "🦕", points: 6,  rarity: "common",    color: "#20c997" },
{ name: "Iguanodon",     emoji: "🦕", points: 7,  rarity: "common",    color: "#ff922b" },
{ name: "Carnotaurus",   emoji: "🦖", points: 18, rarity: "rare",      color: "#f03e3e" },
{ name: "Therizinosaurus",emoji: "🦕", points: 45, rarity: "legendary", color: "#be4bdb" },
```

---

### 7. Change the rarity chances

**Find in Section 4:**
```js
const RARITY_CHANCES = {
  common:    65,
  rare:      28,
  legendary:  7,
};
```
> **Important:** The three numbers must always add up to **100**!

Try `legendary: 25` to make legendary dinos appear much more often.

---

## 🟡 Tier 2 — Medium Challenges
*These add brand new features to the game. You'll need to add code in a few different places — read each step carefully!*

---

### 8. High Score Tracker 🏆

Remembers your best score so you always know what to beat.

**Step 1** — Find the "GAME STATE" section and add one new line:
```js
let score       = 0;
let caughtCount = 0;
let timeLeft    = GAME_TIME;
let gameRunning = false;
let highScore   = 0;   // ← ADD THIS LINE
```

**Step 2** — Find the `endGame()` function. After the line that sets `end-score`, add:
```js
// After: document.getElementById('end-score').textContent = score;
if (score > highScore) {
  highScore = score;
  document.getElementById('end-score').textContent = score + ' 🏆 NEW HIGH SCORE!';
}
```

---

### 9. Combo Multiplier ✨

Catch dinos quickly one after another to earn bonus points! A "x2 COMBO!" or "x3 COMBO!" multiplier kicks in when you're on a streak.

**Step 1** — Add two new variables in the GAME STATE section:
```js
let combo         = 0;
let lastCatchTime = 0;
```

**Step 2** — Find the `catchDino()` function. Replace the lines:
```js
score       += dino.points;
caughtCount += 1;
updateStats();
```
With this new version:
```js
const now = Date.now();
if (now - lastCatchTime < 1500) {
  combo++;
} else {
  combo = 1;
}
lastCatchTime = now;

const bonusPoints = dino.points * combo;
score       += bonusPoints;
caughtCount += 1;
updateStats();

if (combo > 1) {
  // Show a combo message!
  const comboMsg = document.createElement('div');
  comboMsg.className = 'score-pop';
  comboMsg.textContent = 'x' + combo + ' COMBO!';
  comboMsg.style.left = card.style.left;
  comboMsg.style.top  = (parseInt(card.style.top) + 40) + 'px';
  comboMsg.style.color = '#ff6b6b';
  document.getElementById('arena').appendChild(comboMsg);
  setTimeout(() => comboMsg.remove(), 900);
}
```

---

### 10. Lives System ❤️

Start with 3 hearts. Every time a dino escapes, you lose a life. Lose all 3 and the game ends early!

**Step 1** — Find the `#stats` div in the HTML section and add a lives counter:
```html
<div id="stats">
  <span>⏱️ <span id="timer-display">60</span>s</span>
  <span>⭐ <span id="score-display">0</span> pts</span>
  <span>🦕 <span id="caught-display">0</span> caught</span>
  <span>❤️ <span id="lives-display">3</span></span>   <!-- ← ADD THIS -->
</div>
```

**Step 2** — Add a `lives` variable in the GAME STATE section:
```js
let lives = 3;
```

**Step 3** — In `startGame()`, reset lives when a new game starts. Find `gameRunning = true;` and add below it:
```js
lives = 3;
document.getElementById('lives-display').textContent = 3;
```

**Step 4** — In `spawnDino()`, find the escape timeout and replace its contents:
```js
// REPLACE this:
const escapeTimeout = setTimeout(() => {
  if (card.parentElement) {
    card.classList.add('dino-caught');
    setTimeout(() => card.remove(), 500);
  }
}, DINO_LIFE);

// WITH this:
const escapeTimeout = setTimeout(() => {
  if (card.parentElement) {
    card.classList.add('dino-caught');
    setTimeout(() => card.remove(), 500);
    lives--;
    document.getElementById('lives-display').textContent = lives;
    if (lives <= 0) endGame();
  }
}, DINO_LIFE);
```

---

## 🔴 Tier 3 — Big Challenges
*These add park manager features like the full Dino-Ranger game! These are bigger projects — great to work on with a parent over a few sessions.*

---

### 11. Passive Coin Income 🪙

Your park earns coins every second based on how many dinos you've caught. Coins persist between games so you can save up!

**Step 1** — Add to the HTML `#stats` div:
```html
<span>🪙 <span id="coins-display">0</span></span>
```

**Step 2** — Add new variables in GAME STATE:
```js
let coins          = 0;
let coinsPerSecond = 0;
```

**Step 3** — In `addToPark()`, after the line `parkCollection[dino.name] = ...`, add:
```js
coinsPerSecond += 1;  // Each dino in your park earns 1 coin per second
```

**Step 4** — In `startGame()`, after the `spawnTimer` and `countdown` lines, add a new income timer:
```js
// Keep earning coins between games too!
setInterval(() => {
  coins += coinsPerSecond / 10;  // Earn coins even between rounds
  document.getElementById('coins-display').textContent = Math.floor(coins);
}, 100);
```

> **Note:** Only add this `setInterval` once — put it at the very bottom of `startGame()` but wrap it so it only runs once. Otherwise it'll speed up every time you press Play Again! A good challenge: can you figure out how to only run it once?

---

### 12. Buy a Speed Boost ⚡

Spend 50 coins to make dinos appear super fast for 10 seconds!

**Step 1** — Add a button below the `#park` div in the HTML (look for `</div><!-- end #main -->`):
```html
<!-- Add just before </div><!-- end #main --> -->
<div style="background:#0a2440; padding:12px; border-left:2px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:8px; width:160px">
  <h3 style="text-align:center; font-size:0.85rem; opacity:0.8">🏪 Shop</h3>
  <button class="btn" onclick="buySpeedBoost()" style="font-size:0.8rem; padding:8px">
    ⚡ Speed Boost<br><small>50 🪙</small>
  </button>
</div>
```

**Step 2** — Add the function anywhere in the `<script>` section:
```js
function buySpeedBoost() {
  if (coins < 50) {
    alert("Not enough coins! Catch more dinos to earn some 🪙");
    return;
  }
  coins -= 50;
  document.getElementById('coins-display').textContent = Math.floor(coins);

  // Speed up dino spawning for 10 seconds
  clearInterval(spawnTimer);
  spawnTimer = setInterval(spawnDino, 500);

  setTimeout(() => {
    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnDino, DINO_SPEED);
    alert("Speed boost ended!");
  }, 10000);
}
```

---

### 13. Build Exhibits 🏛️

Spend coins to build enclosures that make certain dino types worth more points — just like the full Dino-Ranger park manager!

**Step 1** — Add an exhibits panel to the HTML (inside the shop div from Idea 12, or add it separately):
```html
<button class="btn" onclick="buildExhibit('carnivore')" style="font-size:0.75rem; padding:8px">
  🦖 Carnivore Pen<br><small>100 🪙 → 2x points</small>
</button>
<button class="btn" onclick="buildExhibit('herbivore')" style="font-size:0.75rem; padding:8px">
  🦕 Herbivore Pen<br><small>100 🪙 → 2x points</small>
</button>
```

**Step 2** — Add an exhibits tracker in GAME STATE:
```js
let exhibits = {
  carnivore: false,
  herbivore: false,
};
```

**Step 3** — Add the `buildExhibit` function:
```js
function buildExhibit(type) {
  if (coins < 100) {
    alert('Not enough coins! You need 100 🪙');
    return;
  }
  if (exhibits[type]) {
    alert('You already built that exhibit!');
    return;
  }
  coins -= 100;
  exhibits[type] = true;
  document.getElementById('coins-display').textContent = Math.floor(coins);
  alert('🎉 ' + type + ' exhibit built! Those dinos now give double points!');
}
```

**Step 4** — In `catchDino()`, replace `score += dino.points` with a multiplier check:
```js
// Work out if we get a bonus from an exhibit
let multiplier = 1;
const carnivoreDinos = ["T-Rex", "Velociraptor", "Spinosaurus", "Indominus Rex", "Giganotosaurus", "Carnotaurus"];
const herbivoreDinos = ["Triceratops", "Brachiosaurus", "Stegosaurus", "Ankylosaurus", "Parasaurolophus", "Diplodocus"];

if (exhibits.carnivore && carnivoreDinos.includes(dino.name)) multiplier = 2;
if (exhibits.herbivore && herbivoreDinos.includes(dino.name)) multiplier = 2;

score += dino.points * multiplier;
```

---

## 💡 More ideas to explore on your own

Once you've done some of the above, here are some bigger questions to think about:

- **Can you add a sound effect?** Look up `new Audio()` in JavaScript
- **Can you save the high score when you close the page?** Look up `localStorage`
- **Can you make a dino move around the screen instead of staying still?** Look up CSS `transition` and JavaScript `setInterval`
- **Can you add a second level** that starts after the timer runs out — with faster dinos and harder settings?
- **Can you add a "boss dino"** — one giant legendary dino that only appears once per game and needs to be clicked 3 times?

The best way to learn coding is to ask "what if?" and then try it!
