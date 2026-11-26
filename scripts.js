const DATA = {};

// Цвета в стиле "редакционного" дизайна
const COLORS = {
  BTC: '#0F4F45', // Глубокий зеленый (основной акцент)
  ETH: '#1A1C18', // Почти черный
  TRX: '#A88A41', // Горчичный/золотой
  USD: '#D1CDC0'  // Серый
};

const FONT_SANS = "'Inter', sans-serif";
const FONT_SERIF = "'PT Serif', serif";
const TEXT_MUTED = '#6B6D66';
const GRID_COLOR = 'rgba(209, 205, 192, 0.4)'; // Очень бледная сетка

const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const fmtNum = (v, digits = 1) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = Math.abs(v).toFixed(digits).replace('.', ',');
  return (v < 0 ? '−' : '') + s;
};

const fmtMonth = (m) => {
  const [y, mo] = m.split('-');
  return MONTHS_RU[+mo - 1] + ' ' + y;
};

async function loadAll() {
  const files = ['kpis', 'risk', 'events', 'criteria', 'prices'];
  const results = await Promise.all(files.map(f =>
    fetch(`data/${f}.json`).then(r => {
      if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
      return r.json();
    }).then(j => ({ ok: true, data: j }))
      .catch(e => ({ ok: false, error: `${f}.json — ${e.message}` }))
  ));
  const errors = [];
  files.forEach((f, i) => {
    if (results[i].ok) DATA[f] = results[i].data;
    else errors.push(results[i].error);
  });
  return errors;
}

function renderKPIs() {
  const wrap = document.getElementById('kpis');
  if (!DATA.kpis?.kpis) return;
  
  // Берем только первые 4 KPI для красоты сетки 2x2
  const topKpis = DATA.kpis.kpis.slice(0, 4);
  
  wrap.innerHTML = topKpis.map(k => {
    // Разделяем значение и единицу измерения (например, "67,0 %" -> "67,0" и "%")
    const match = k.display.match(/^([^%]+)(\s*%)?$/);
    const val = match ? match[1].trim() : k.display;
    const unit = match && match[2] ? match[2].trim() : '';

    return `
      <div class="kpi-card">
        <div class="kpi-header">
          <div class="kpi-label">${k.label}</div>
        </div>
        <div>
          <div class="kpi-value-wrap">
            <div class="kpi-value">${val}</div>
            <div class="kpi-unit">${unit}</div>
          </div>
          <div class="kpi-desc">${k.note}</div>
        </div>
      </div>`;
  }).join('');
}

function renderMatrix() {
  const wrap = document.getElementById('criteria-table');
  if (!DATA.criteria) return;
  const { assets, criteria } = DATA.criteria;
  let html = '<thead><tr><th style="width:20%">Критерий</th>';
  assets.forEach(a => { html += `<th>${a.short}</th>`; });
  html += '</tr></thead><tbody>';
  criteria.forEach(c => {
    html += `<tr><td><strong>${c.label}</strong></td>`;
    assets.forEach(a => {
      const cell = c.cells[a.id] || {};
      const cls = cell.signal === 'good' ? 'good'
                : cell.signal === 'bad'  ? 'bad'
                : cell.signal === 'mixed'? 'mixed' : 'na';
      const icon = cell.signal === 'good' ? '✓'
                 : cell.signal === 'bad'  ? '✗'
                 : cell.signal === 'mixed'? '~' : '—';
      html += `<td>
        <div class="badge ${cls}">${icon}</div><br>
        <span style="color:var(--text-muted); font-size:0.8rem;">${cell.text || ''}</span>
      </td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  wrap.innerHTML = html;
}

function buildPriceSeries() {
  const p = DATA.prices;
  if (!p?.event_anchors?.length) return null;
  const events = p.event_anchors;
  const labels = [], evNames = [];
  const btcRaw = [], ethRaw = [], trxRaw = [];

  const first = events[0];
  labels.push(fmtMonth(first.month));
  evNames.push('Старт периода');
  btcRaw.push(first.before.BTC_byn);
  ethRaw.push(first.before.ETH_byn);
  trxRaw.push(first.before.TRX_byn);

  events.forEach(e => {
    labels.push(fmtMonth(e.month));
    evNames.push(e.event);
    btcRaw.push(e.after.BTC_byn);
    ethRaw.push(e.after.ETH_byn);
    trxRaw.push(e.after.TRX_byn);
  });

  const norm = arr => arr.map(v => +(v / arr[0] * 100).toFixed(2));
  return { labels, evNames, btc: norm(btcRaw), eth: norm(ethRaw), trx: norm(trxRaw), btcRaw, ethRaw, trxRaw };
}

function renderPriceChart() {
  const s = buildPriceSeries();
  const canvas = document.getElementById('priceChart');
  if (!s || !canvas) return;

  Chart.defaults.font.family = FONT_SANS;
  Chart.defaults.color = TEXT_MUTED;

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: s.labels,
      datasets: [
        { label: 'BTC', data: s.btc, borderColor: COLORS.BTC, backgroundColor: COLORS.BTC + '14', fill: true, tension: .3, pointRadius: 3, pointBackgroundColor: COLORS.BTC, borderWidth: 2 },
        { label: 'ETH', data: s.eth, borderColor: COLORS.ETH, backgroundColor: 'transparent', fill: false, tension: .3, pointRadius: 3, pointBackgroundColor: COLORS.ETH, borderWidth: 2, borderDash: [5, 5] },
        { label: 'TRX', data: s.trx, borderColor: COLORS.TRX, backgroundColor: 'transparent', fill: false, tension: .3, pointRadius: 3, pointBackgroundColor: COLORS.TRX, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12, family: FONT_SANS } } },
        tooltip: {
          backgroundColor: '#1A1C18', titleFont: { family: FONT_SERIF, size: 14 }, bodyFont: { family: FONT_SANS, size: 13 }, padding: 12, cornerRadius: 8,
          callbacks: {
            title: items => `${s.labels[items[0].dataIndex]} — ${s.evNames[items[0].dataIndex]}`,
            label: ctx => {
              const raw = [s.btcRaw, s.ethRaw, s.trxRaw][ctx.datasetIndex][ctx.dataIndex];
              const rawStr = raw >= 1 ? raw.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : raw.toFixed(4);
              return `${ctx.dataset.label}: ${rawStr} BYN (индекс ${ctx.parsed.y})`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10, font: { size: 11 } }, grid: { display: false } },
        y: { type: 'linear', beginAtZero: true, grid: { color: GRID_COLOR, drawBorder: false }, ticks: { callback: v => v >= 1000 ? (v/1000)+'k' : v } }
      }
    }
  });
}

let riskChart = null;
let currentRiskMetric = 'annual_volatility';

function updateRiskChart(metricId) {
  const r = DATA.risk;
  if (!r) return;
  const m = r.metrics.find(x => x.id === metricId);
  if (!m) return;
  
  const assets = ['BTC', 'ETH', 'TRX', 'USDBYN'];
  const labels = ['BTC', 'ETH', 'TRX', 'USD/BYN'];
  const colors = [COLORS.BTC, COLORS.ETH, COLORS.TRX, '#1A1C18'];
  const values = assets.map(a => m.values[a] == null ? null : Math.abs(m.values[a]));
  const titleText = m.label + (m.unit === '%' ? ', %' : '');

  if (riskChart) {
    riskChart.data.datasets[0].data = values;
    riskChart.data.datasets[0].backgroundColor = colors;
    riskChart.options.plugins.title.text = titleText;
    riskChart.update();
  } else {
    riskChart = new Chart(document.getElementById('riskChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: titleText, data: values, backgroundColor: colors, borderRadius: 4, barThickness: 48
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: titleText, font: { family: FONT_SERIF, size: 16, weight: 'normal' }, padding: { bottom: 24 }, align: 'start' },
          tooltip: { backgroundColor: '#1A1C18', padding: 10, callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1).replace('.', ',')} %` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12, weight: '500' } } },
          y: { beginAtZero: true, grid: { color: GRID_COLOR, drawBorder: false }, ticks: { callback: v => v + '%' } }
        }
      }
    });
  }
}

function renderRiskChart() {
  if (!DATA.risk) return;
  updateRiskChart(currentRiskMetric);
  document.querySelectorAll('.tab[data-metric]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab[data-metric]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentRiskMetric = tab.dataset.metric;
      updateRiskChart(currentRiskMetric);
    });
  });
}

function renderEvents() {
  const wrap = document.getElementById('events-strip');
  if (!DATA.events?.events?.length) return;
  wrap.innerHTML = DATA.events.events.map(ev => {
    const badges = ['BTC', 'ETH', 'TRX'].map(a => {
      const pct = ev.reactions?.[a]?.byn_pct;
      if (pct == null) return `<span class="ev-badge flat">${a} —</span>`;
      const cls = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
      const sign = pct > 0 ? '+' : '';
      return `<span class="ev-badge ${cls}">${a} ${sign}${pct.toFixed(1).replace('.', ',')}%</span>`;
    }).join('');
    return `
      <div class="event-card">
        <div class="ev-date">${fmtMonth(ev.month)}</div>
        <div class="ev-name">${ev.event}</div>
        <div class="event-badges">${badges}</div>
      </div>`;
  }).join('');
}

function renderSubperiodChart() {
  const canvas = document.getElementById('subperiodChart');
  const s = DATA.events?.avg_mdd_by_subperiod?.series;
  if (!s || !canvas) return;
  
  new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: s.map(x => x.asset),
      datasets: [
        { label: '2019–2021', data: s.map(x => x.p1_2019_2021), backgroundColor: '#D1CDC0', borderRadius: 4 },
        { label: '2022–2026', data: s.map(x => x.p2_2022_2026), backgroundColor: COLORS.BTC, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        title: { display: true, text: 'Средняя просадка в окнах событий, %', font: { family: FONT_SERIF, size: 16, weight: 'normal' }, padding: { bottom: 24 }, align: 'start' },
        tooltip: { backgroundColor: '#1A1C18', padding: 10, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1).replace('.', ',')} %` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: '500' } } },
        y: { beginAtZero: true, grid: { color: GRID_COLOR, drawBorder: false }, ticks: { callback: v => v + '%' } }
      }
    }
  });
}

let portChart = null;
const SIGMA_USD = 12.5;
const SIGMA_BTC = 67.0;
const RHO = 0.15;

function portfolioVol(w) {
  const v = Math.pow(1 - w, 2) * Math.pow(SIGMA_USD, 2) + Math.pow(w, 2) * Math.pow(SIGMA_BTC, 2) + 2 * w * (1 - w) * RHO * SIGMA_USD * SIGMA_BTC;
  return Math.sqrt(v);
}
function portfolioVaR(w) {
  return -1.645 * portfolioVol(w) / Math.sqrt(12);
}

function renderPortfolio() {
  const slider = document.getElementById('wSlider');
  const wValEl = document.getElementById('wVal');
  const volEl = document.getElementById('portVol');
  const varEl = document.getElementById('portVar');
  const canvas = document.getElementById('portChart');
  if (!slider || !canvas) return;

  const ws = Array.from({ length: 41 }, (_, i) => i / 40);
  portChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Волатильность',
          data: ws.map(w => ({ x: +(w * 100).toFixed(1), y: +portfolioVol(w).toFixed(2) })),
          borderColor: COLORS.BTC, backgroundColor: COLORS.BTC + '10', fill: true, tension: .4, pointRadius: 0, borderWidth: 2
        },
        {
          label: 'Текущий',
          data: [{ x: 0, y: portfolioVol(0) }],
          borderColor: COLORS.ETH, backgroundColor: COLORS.ETH, pointRadius: 6, pointHoverRadius: 8, showLine: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: item => item.datasetIndex === 0,
          backgroundColor: '#1A1C18',
          callbacks: {
            title: items => `Доля BTC: ${items[0].parsed.x} %`,
            label: ctx => `Волатильность: ${ctx.parsed.y.toFixed(1).replace('.', ',')} %`
          }
        }
      },
      scales: {
        x: { type: 'linear', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%', font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: GRID_COLOR, drawBorder: false }, ticks: { callback: v => v + '%', font: { size: 11 } } }
      }
    }
  });

  function update() {
    const w = +slider.value / 100;
    wValEl.textContent = Math.round(w * 100) + ' %';
    const vol = portfolioVol(w);
    const var95 = portfolioVaR(w);
    volEl.textContent = vol.toFixed(1).replace('.', ',') + ' %';
    varEl.textContent = '−' + Math.abs(var95).toFixed(1).replace('.', ',') + ' %';
    portChart.data.datasets[1].data = [{ x: +(w * 100).toFixed(1), y: +vol.toFixed(2) }];
    portChart.update('none');
  }

  slider.addEventListener('input', update);
  update();
}

async function main() {
  await loadAll();
  try { renderKPIs(); } catch (e) { console.error(e); }
  try { renderMatrix(); } catch (e) { console.error(e); }
  try { renderPriceChart(); } catch (e) { console.error(e); }
  try { renderRiskChart(); } catch (e) { console.error(e); }
  try { renderEvents(); } catch (e) { console.error(e); }
  try { renderSubperiodChart(); } catch (e) { console.error(e); }
  try { renderPortfolio(); } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', main);
