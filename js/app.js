/* ══════════════════════════════════════════════
   Expense & Budget Visualizer — app.js
   Vanilla JS · LocalStorage · Chart.js
   ══════════════════════════════════════════════ */

'use strict';

/* ── Constants ───────────────────────────────── */
const STORAGE_KEY       = 'expenseApp_transactions';
const THEME_KEY         = 'expenseApp_theme';
const LIMIT_KEY         = 'expenseApp_limit';
const CATEGORY_COLORS   = {
  Food:      '#f6ad55',
  Transport: '#63b3ed',
  Fun:       '#b794f4',
};

/* ── State ───────────────────────────────────── */
let transactions = [];
let spendingLimit = 0;
let chart = null;

// For the monthly summary navigator
const today = new Date();
let summaryYear  = today.getFullYear();
let summaryMonth = today.getMonth(); // 0-indexed

/* ── DOM References ──────────────────────────── */
const totalBalanceEl   = document.getElementById('totalBalance');
const txCountEl        = document.getElementById('txCount');
const monthLabelEl     = document.getElementById('monthLabel');
const limitBannerEl    = document.getElementById('limitBanner');
const txListEl         = document.getElementById('txList');
const emptyMsgEl       = document.getElementById('emptyMsg');
const chartCanvas      = document.getElementById('spendingChart');
const chartEmptyEl     = document.getElementById('chartEmpty');
const txForm           = document.getElementById('txForm');
const itemNameEl       = document.getElementById('itemName');
const amountEl         = document.getElementById('amount');
const categoryEl       = document.getElementById('category');
const spendingLimitEl  = document.getElementById('spendingLimit');
const themeToggleEl    = document.getElementById('themeToggle');
const themeIconEl      = document.getElementById('themeIcon');
const clearAllBtn      = document.getElementById('clearAllBtn');
const prevMonthBtn     = document.getElementById('prevMonth');
const nextMonthBtn     = document.getElementById('nextMonth');
const summaryMonthLbl  = document.getElementById('summaryMonthLabel');
const summaryGridEl    = document.getElementById('summaryGrid');

/* ═══════════════════════════════════════════════
   LOCAL STORAGE HELPERS
══════════════════════════════════════════════ */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  transactions = raw ? JSON.parse(raw) : [];
}

function saveLimit(val) {
  localStorage.setItem(LIMIT_KEY, val);
}

function loadLimit() {
  const raw = localStorage.getItem(LIMIT_KEY);
  spendingLimit = raw ? parseFloat(raw) : 0;
  if (spendingLimit > 0) {
    spendingLimitEl.value = spendingLimit;
  }
}

/* ═══════════════════════════════════════════════
   FORMATTING
══════════════════════════════════════════════ */
function formatRp(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthName(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/* ═══════════════════════════════════════════════
   VALIDATION
══════════════════════════════════════════════ */
function validateForm() {
  let valid = true;

  const nameErr     = document.getElementById('nameError');
  const amountErr   = document.getElementById('amountError');
  const categoryErr = document.getElementById('categoryError');

  // Clear previous errors
  [itemNameEl, amountEl, categoryEl].forEach(el => el.classList.remove('invalid'));
  [nameErr, amountErr, categoryErr].forEach(el => el.classList.remove('visible'));

  if (!itemNameEl.value.trim()) {
    itemNameEl.classList.add('invalid');
    nameErr.classList.add('visible');
    valid = false;
  }

  const amt = parseFloat(amountEl.value);
  if (!amountEl.value || isNaN(amt) || amt <= 0) {
    amountEl.classList.add('invalid');
    amountErr.classList.add('visible');
    valid = false;
  }

  if (!categoryEl.value) {
    categoryEl.classList.add('invalid');
    categoryErr.classList.add('visible');
    valid = false;
  }

  return valid;
}

/* ═══════════════════════════════════════════════
   ADD TRANSACTION
══════════════════════════════════════════════ */
function addTransaction() {
  const name     = itemNameEl.value.trim();
  const amount   = parseFloat(amountEl.value);
  const category = categoryEl.value;

  const tx = {
    id:       Date.now(),
    name,
    amount,
    category,
    date:     new Date().toISOString(),
  };

  transactions.unshift(tx); // newest first
  saveTransactions();

  // Save limit if provided
  const limitVal = parseFloat(spendingLimitEl.value);
  if (!isNaN(limitVal) && limitVal > 0) {
    spendingLimit = limitVal;
    saveLimit(limitVal);
  }

  // Reset form
  txForm.reset();
  [itemNameEl, amountEl, categoryEl].forEach(el => el.classList.remove('invalid'));

  renderAll();
}

/* ═══════════════════════════════════════════════
   DELETE TRANSACTION
══════════════════════════════════════════════ */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderAll();
}

/* ═══════════════════════════════════════════════
   CLEAR ALL
══════════════════════════════════════════════ */
function clearAll() {
  if (!transactions.length) return;
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  saveTransactions();
  renderAll();
}

/* ═══════════════════════════════════════════════
   RENDER: BALANCE
══════════════════════════════════════════════ */
function renderBalance() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  totalBalanceEl.textContent = formatRp(total);
  txCountEl.textContent = `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`;
  monthLabelEl.textContent = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/* ═══════════════════════════════════════════════
   RENDER: SPENDING LIMIT BANNER
══════════════════════════════════════════════ */
function renderLimitBanner() {
  if (!spendingLimit) {
    limitBannerEl.classList.add('hidden');
    return;
  }

  // Calculate current month total
  const now = new Date();
  const monthTotal = transactions
    .filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (monthTotal > spendingLimit) {
    limitBannerEl.classList.remove('hidden');
    limitBannerEl.textContent =
      `⚠️ Monthly spending (${formatRp(monthTotal)}) exceeds your limit of ${formatRp(spendingLimit)}!`;
  } else {
    limitBannerEl.classList.add('hidden');
  }
}

/* ═══════════════════════════════════════════════
   RENDER: TRANSACTION LIST
══════════════════════════════════════════════ */
function renderList() {
  // Remove existing tx items (keep the empty message element)
  txListEl.querySelectorAll('.tx-item').forEach(el => el.remove());

  if (!transactions.length) {
    emptyMsgEl.classList.remove('hidden');
    return;
  }
  emptyMsgEl.classList.add('hidden');

  // Determine if any item is "over limit" (cumulative from newest)
  let running = 0;

  transactions.forEach(tx => {
    running += tx.amount;
    const overLimit = spendingLimit > 0 && running > spendingLimit;

    const item = document.createElement('div');
    item.className = `tx-item${overLimit ? ' over-limit' : ''}`;
    item.dataset.id = tx.id;

    item.innerHTML = `
      <span class="tx-dot ${tx.category.toLowerCase()}"></span>
      <div class="tx-info">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-meta">${tx.category} · ${formatDate(tx.date)}</div>
      </div>
      <span class="tx-amount">-${formatRp(tx.amount)}</span>
      <button class="tx-delete" aria-label="Delete transaction" data-id="${tx.id}">×</button>
    `;
    txListEl.appendChild(item);
  });
}

/* ═══════════════════════════════════════════════
   RENDER: PIE CHART
══════════════════════════════════════════════ */
function renderChart() {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(tx => { totals[tx.category] += tx.amount; });

  const labels  = Object.keys(totals).filter(k => totals[k] > 0);
  const data    = labels.map(k => totals[k]);
  const colors  = labels.map(k => CATEGORY_COLORS[k]);

  const hasData = data.length > 0;
  chartEmptyEl.classList.toggle('hidden', hasData);

  if (!hasData) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  if (chart) {
    chart.data.labels  = labels;
    chart.data.datasets[0].data   = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
    return;
  }

  chart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--surface').trim() || '#fff',
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement)
              .getPropertyValue('--text').trim() || '#000',
            padding: 16,
            font: { size: 13, weight: '600' },
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const val   = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = ((val / total) * 100).toFixed(1);
              return ` ${formatRp(val)} (${pct}%)`;
            },
          },
        },
      },
      cutout: '62%',
    },
  });
}

/* ═══════════════════════════════════════════════
   RENDER: MONTHLY SUMMARY
══════════════════════════════════════════════ */
function renderSummary() {
  summaryMonthLbl.textContent = monthName(summaryYear, summaryMonth);

  const monthTx = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === summaryYear && d.getMonth() === summaryMonth;
  });

  const totals = { Food: 0, Transport: 0, Fun: 0 };
  monthTx.forEach(tx => { totals[tx.category] += tx.amount; });
  const grand = monthTx.reduce((s, tx) => s + tx.amount, 0);

  summaryGridEl.innerHTML = `
    <div class="summary-item food">
      <div class="s-label">🍔 Food</div>
      <div class="s-value">${formatRp(totals.Food)}</div>
    </div>
    <div class="summary-item transport">
      <div class="s-label">🚌 Transport</div>
      <div class="s-value">${formatRp(totals.Transport)}</div>
    </div>
    <div class="summary-item fun">
      <div class="s-label">🎉 Fun</div>
      <div class="s-value">${formatRp(totals.Fun)}</div>
    </div>
    <div class="summary-item total">
      <div class="s-label">📊 Total</div>
      <div class="s-value">${formatRp(grand)}</div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════ */
function renderAll() {
  renderBalance();
  renderLimitBanner();
  renderList();
  renderChart();
  renderSummary();
}

/* ═══════════════════════════════════════════════
   DARK / LIGHT THEME
══════════════════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);

  // Update chart legend colour if chart exists
  if (chart) {
    chart.options.plugins.legend.labels.color =
      getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    chart.data.datasets[0].borderColor =
      getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
    chart.update();
  }
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

themeToggleEl.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
});

/* ═══════════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════════ */
txForm.addEventListener('submit', e => {
  e.preventDefault();
  if (validateForm()) addTransaction();
});

/* ═══════════════════════════════════════════════
   DELETE via event delegation
══════════════════════════════════════════════ */
txListEl.addEventListener('click', e => {
  const btn = e.target.closest('.tx-delete');
  if (!btn) return;
  deleteTransaction(Number(btn.dataset.id));
});

/* ═══════════════════════════════════════════════
   CLEAR ALL
══════════════════════════════════════════════ */
clearAllBtn.addEventListener('click', clearAll);

/* ═══════════════════════════════════════════════
   MONTHLY SUMMARY NAVIGATION
══════════════════════════════════════════════ */
prevMonthBtn.addEventListener('click', () => {
  summaryMonth--;
  if (summaryMonth < 0) { summaryMonth = 11; summaryYear--; }
  renderSummary();
});

nextMonthBtn.addEventListener('click', () => {
  summaryMonth++;
  if (summaryMonth > 11) { summaryMonth = 0; summaryYear++; }
  renderSummary();
});

/* ═══════════════════════════════════════════════
   SPENDING LIMIT: live save on blur
══════════════════════════════════════════════ */
spendingLimitEl.addEventListener('change', () => {
  const val = parseFloat(spendingLimitEl.value);
  if (!isNaN(val) && val > 0) {
    spendingLimit = val;
    saveLimit(val);
    renderLimitBanner();
    renderList();
  } else if (spendingLimitEl.value === '') {
    spendingLimit = 0;
    localStorage.removeItem(LIMIT_KEY);
    renderLimitBanner();
    renderList();
  }
});

/* ═══════════════════════════════════════════════
   SECURITY HELPER
══════════════════════════════════════════════ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ═══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
(function init() {
  loadTheme();
  loadTransactions();
  loadLimit();
  renderAll();
})();
