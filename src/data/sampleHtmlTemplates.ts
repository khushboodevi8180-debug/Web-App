export interface SampleHtmlTemplate {
  id: string;
  title: string;
  fileName: string;
  category: string;
  description: string;
  suggestedAppName: string;
  suggestedPackageId: string;
  themeColor: string;
  htmlContent: string;
}

export const SAMPLE_HTML_TEMPLATES: SampleHtmlTemplate[] = [
  {
    id: 'pocket-ledger',
    title: 'Pocket Expense Ledger',
    fileName: 'pocket-ledger.html',
    category: 'Finance Utility',
    description: 'Offline-capable daily expense tracker with category allocation, live balance calculation, and interactive ledger filtering.',
    suggestedAppName: 'Pocket Ledger',
    suggestedPackageId: 'com.studio.pocketledger',
    themeColor: '#0F172A',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Pocket Ledger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #F8FAFC; color: #0F172A; padding: 20px; max-width: 540px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #E2E8F0; }
    .title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .subtitle { font-size: 12px; color: #64748B; }
    .summary-card { background: #0F172A; color: #FFFFFF; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .summary-label { font-size: 12px; color: #94A3B8; margin-bottom: 6px; }
    .summary-amount { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
    .summary-row { display: flex; gap: 24px; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 13px; }
    .form-box { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 110px; gap: 10px; margin-bottom: 10px; }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 14px; outline: none; background: #FFF; }
    input:focus, select:focus { border-color: #0F172A; }
    button.add-btn { width: 100%; padding: 11px; background: #059669; color: white; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    button.add-btn:active { transform: scale(0.99); }
    .list-header { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px; display: flex; justify-content: space-between; }
    .entry { display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid #E2E8F0; padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; }
    .entry-title { font-size: 14px; font-weight: 600; color: #0F172A; }
    .entry-meta { font-size: 12px; color: #64748B; margin-top: 2px; }
    .entry-right { display: flex; align-items: center; gap: 12px; }
    .entry-val { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .del-btn { background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 16px; padding: 4px; }
    .del-btn:hover { color: #DC2626; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Pocket Ledger</div>
      <div class="subtitle">Local HTML5 Financial Log</div>
    </div>
    <div class="subtitle" id="dateDisplay"></div>
  </div>

  <div class="summary-card">
    <div class="summary-label">Total Monthly Spend</div>
    <div class="summary-amount" id="totalSpend">$0.00</div>
    <div class="summary-row">
      <div>Entries: <strong id="entryCount">0</strong></div>
      <div>Top Category: <strong id="topCat">None</strong></div>
    </div>
  </div>

  <div class="form-box">
    <div class="form-row">
      <input type="text" id="descInput" placeholder="Expense description (e.g. Coffee, Transit)" />
      <input type="number" id="amountInput" placeholder="Amount ($)" step="0.01" />
    </div>
    <div class="form-row">
      <select id="catInput">
        <option value="Food & Dining">Food & Dining</option>
        <option value="Transit">Transit</option>
        <option value="Software & Cloud">Software & Cloud</option>
        <option value="Groceries">Groceries</option>
      </select>
      <button class="add-btn" onclick="addExpense()">Add Entry</button>
    </div>
  </div>

  <div class="list-header">
    <span>Recent Transactions</span>
    <span id="clearAll" style="cursor:pointer;color:#64748B;" onclick="resetDemo()">Reset Demo</span>
  </div>
  <div id="entriesContainer"></div>

  <script>
    const defaultData = [
      { id: 1, title: 'Artisan Espresso & Croissant', amount: 8.50, cat: 'Food & Dining', time: '08:45 AM' },
      { id: 2, title: 'Metro Express Pass', amount: 14.00, cat: 'Transit', time: '09:15 AM' },
      { id: 3, title: 'Cloud Storage Subscription', amount: 9.99, cat: 'Software & Cloud', time: 'Yesterday' }
    ];
    let items = defaultData.slice();
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    function render() {
      const container = document.getElementById('entriesContainer');
      container.innerHTML = '';
      let sum = 0;
      const catTotals = {};

      items.forEach(item => {
        sum += item.amount;
        catTotals[item.cat] = (catTotals[item.cat] || 0) + item.amount;
        const row = document.createElement('div');
        row.className = 'entry';
        row.innerHTML = \`
          <div>
            <div class="entry-title">\${item.title}</div>
            <div class="entry-meta">\${item.cat} · \${item.time}</div>
          </div>
          <div class="entry-right">
            <span class="entry-val">$\${item.amount.toFixed(2)}</span>
            <button class="del-btn" onclick="removeExpense(\${item.id})" title="Delete">&times;</button>
          </div>
        \`;
        container.appendChild(row);
      });

      document.getElementById('totalSpend').textContent = '$' + sum.toFixed(2);
      document.getElementById('entryCount').textContent = String(items.length);
      const top = Object.entries(catTotals).sort((a,b) => b[1] - a[1])[0];
      document.getElementById('topCat').textContent = top ? top[0] : 'None';
    }

    function addExpense() {
      const desc = document.getElementById('descInput').value.trim();
      const amt = parseFloat(document.getElementById('amountInput').value);
      const cat = document.getElementById('catInput').value;
      if (!desc || isNaN(amt) || amt <= 0) return;
      items.unshift({
        id: Date.now(),
        title: desc,
        amount: amt,
        cat,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      document.getElementById('descInput').value = '';
      document.getElementById('amountInput').value = '';
      render();
    }

    function removeExpense(id) {
      items = items.filter(i => i.id !== id);
      render();
    }

    function resetDemo() {
      items = defaultData.slice();
      render();
    }

    render();
  </script>
</body>
</html>`
  },
  {
    id: 'brick-breaker',
    title: 'Canvas Brick Breaker',
    fileName: 'brick-breaker.html',
    category: '2D Arcade Canvas',
    description: 'Responsive 60fps HTML5 canvas arcade game with touch and pointer paddle control, particle rebounds, and score tracking.',
    suggestedAppName: 'Brick Breaker Arcade',
    suggestedPackageId: 'com.studio.brickbreaker',
    themeColor: '#090D16',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Brick Breaker Arcade</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body { background: #090D16; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .hud { width: 100%; max-width: 420px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 10px 14px; background: #131B2E; border: 1px solid #1E293B; border-radius: 10px; font-size: 13px; font-variant-numeric: tabular-nums; }
    canvas { background: #0F172A; border: 1px solid #334155; border-radius: 12px; width: 100%; max-width: 420px; height: auto; touch-action: none; cursor: ew-resize; }
    .controls { margin-top: 12px; display: flex; gap: 10px; }
    button { background: #10B981; color: #06281E; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="hud">
    <span>SCORE: <strong id="scoreVal">0</strong></span>
    <span>BRICKS: <strong id="bricksVal">24</strong></span>
    <span>LIVES: <strong id="livesVal">3</strong></span>
  </div>
  <canvas id="gameCanvas" width="420" height="460"></canvas>
  <div class="controls">
    <button onclick="resetGame()">Restart Round</button>
  </div>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0, lives = 3;
    const paddle = { w: 84, h: 12, x: 168, y: 432 };
    const ball = { x: 210, y: 390, vx: 3.4, vy: -3.6, r: 7 };
    const rows = 4, cols = 6;
    const colors = ['#38BDF8', '#34D399', '#FBBF24', '#F87171'];
    let bricks = [];

    function initBricks() {
      bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: 18 + c * 65,
            y: 36 + r * 28,
            w: 58,
            h: 18,
            color: colors[r % colors.length],
            alive: true
          });
        }
      }
      document.getElementById('bricksVal').textContent = String(bricks.length);
    }

    function resetGame() {
      score = 0; lives = 3;
      ball.x = 210; ball.y = 390; ball.vx = 3.4; ball.vy = -3.6;
      initBricks();
      updateHud();
    }

    function updateHud() {
      document.getElementById('scoreVal').textContent = String(score);
      document.getElementById('livesVal').textContent = String(lives);
      document.getElementById('bricksVal').textContent = String(bricks.filter(b => b.alive).length);
    }

    function movePaddle(clientX) {
      const rect = canvas.getBoundingClientRect();
      const relX = ((clientX - rect.left) / rect.width) * canvas.width;
      paddle.x = Math.max(8, Math.min(canvas.width - paddle.w - 8, relX - paddle.w / 2));
    }

    canvas.addEventListener('mousemove', e => movePaddle(e.clientX));
    canvas.addEventListener('touchmove', e => {
      if (e.touches[0]) movePaddle(e.touches[0].clientX);
    }, { passive: true });

    function step() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bricks
      bricks.forEach(b => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
      });

      // Draw paddle
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
      ctx.fill();

      // Draw ball
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      // Physics
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.vx *= -1;
      if (ball.y - ball.r < 0) ball.vy *= -1;

      // Paddle collision
      if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
        const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        ball.vx = hitOffset * 4.5;
        ball.vy = -Math.abs(ball.vy);
      }

      // Brick collision
      bricks.forEach(b => {
        if (!b.alive) return;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.alive = false;
          ball.vy *= -1;
          score += 25;
          updateHud();
        }
      });

      if (ball.y - ball.r > canvas.height) {
        lives = Math.max(0, lives - 1);
        updateHud();
        ball.x = paddle.x + paddle.w / 2;
        ball.y = 390;
        ball.vy = -3.6;
        if (lives === 0) resetGame();
      }

      if (bricks.every(b => !b.alive)) {
        initBricks();
      }

      requestAnimationFrame(step);
    }

    initBricks();
    requestAnimationFrame(step);
  </script>
</body>
</html>`
  },
  {
    id: 'field-notes',
    title: 'Field Inspection Checklist',
    fileName: 'field-checklist.html',
    category: 'Productivity Tool',
    description: 'Mobile-ready inspection checklist and timestamped field memo pad designed for offline Android WebView deployment.',
    suggestedAppName: 'Field Checklist Pro',
    suggestedPackageId: 'com.studio.fieldchecklist',
    themeColor: '#1E293B',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Field Checklist Pro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: #F1F5F9; color: #0F172A; padding: 20px; max-width: 520px; margin: 0 auto; }
    .card { background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748B; margin-bottom: 16px; }
    .progress-bar { height: 8px; background: #E2E8F0; border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
    .progress-fill { height: 100%; background: #0F172A; transition: width 0.2s ease; }
    .task { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #F1F5F9; cursor: pointer; font-size: 14px; }
    .task.done span { text-decoration: line-through; color: #94A3B8; }
    textarea { width: 100%; height: 90px; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px; font-size: 13px; margin-top: 8px; resize: vertical; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Site Safety & Equipment Audit</h1>
    <div class="meta">Protocol Rev 4.2 · Offline WebView Ready</div>
    <div class="progress-bar"><div class="progress-fill" id="progFill" style="width: 40%"></div></div>
    <div id="taskList"></div>
  </div>
  <div class="card">
    <strong style="font-size:13px;">Inspector Field Notes</strong>
    <textarea placeholder="Record observations, serial numbers, or sign-off notes..."></textarea>
  </div>
  <script>
    const tasks = [
      { text: 'Verify main breaker voltage isolation', done: true },
      { text: 'Inspect emergency exit luminaire battery backup', done: true },
      { text: 'Calibrate pressure manifold sensor #04', done: false },
      { text: 'Test grounding continuity across rack enclosures', done: false },
      { text: 'Capture supervisor sign-off timestamp', done: false }
    ];
    function render() {
      const el = document.getElementById('taskList');
      el.innerHTML = '';
      const doneCount = tasks.filter(t => t.done).length;
      document.getElementById('progFill').style.width = Math.round((doneCount / tasks.length) * 100) + '%';
      tasks.forEach((t, idx) => {
        const row = document.createElement('label');
        row.className = 'task ' + (t.done ? 'done' : '');
        row.innerHTML = \`<input type="checkbox" \${t.done ? 'checked' : ''} onchange="toggle(\${idx})" /> <span>\${t.text}</span>\`;
        el.appendChild(row);
      });
    }
    function toggle(i) { tasks[i].done = !tasks[i].done; render(); }
    render();
  </script>
</body>
</html>`
  }
];
