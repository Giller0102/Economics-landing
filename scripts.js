/* ============================================================
   Крипто-резервы: лендинг конкурсной работы ВГТУ 2026
   Читает 5 JSON из /data и рендерит все секции
   ============================================================ */

   const DATA = {};
   const COLORS = {
     BTC: '#F7931A',
     ETH: '#627EEA',
     TRX: '#EF0027',
     USD: '#94a3b8'
   };
   const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
   
   /* ---------- Утилиты ---------- */
   const fmtNum = (v, digits = 1) => {
     if (v === null || v === undefined || Number.isNaN(v)) return '—';
     const s = Math.abs(v).toFixed(digits).replace('.', ',');
     return (v < 0 ? '−' : '') + s;
   };
   const fmtPct = (v, digits = 1) => v == null ? '—' : fmtNum(v, digits) + ' %';
   const fmtMonth = (m) => {
     const [y, mo] = m.split('-');
     return MONTHS_RU[+mo - 1] + ' ' + y;
   };
   
   /* ---------- Загрузка ---------- */
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
     if (errors.length) console.error('Ошибки загрузки:', errors);
     return errors;
   }
   
   /* ---------- KPI ---------- */
   function renderKPIs() {
     const wrap = document.getElementById('kpis');
     if (!DATA.kpis?.kpis) {
       wrap.innerHTML = '<div class="loading error">Не удалось загрузить KPI</div>';
       return;
     }
     wrap.innerHTML = DATA.kpis.kpis.map(k => {
       const cls = k.accent === 'risk' ? 'risk' : k.accent === 'positive' ? 'good' : '';
       return `
         <div class="kpi ${cls}">
           <div class="kpi-label">${k.label}</div>
           <div class="kpi-value">${k.display}</div>
           <div class="kpi-note">${k.note}</div>
         </div>`;
     }).join('');
   }
   
   /* ---------- Матрица критериев ---------- */
   function renderMatrix() {
     const wrap = document.getElementById('criteria-table');
     if (!DATA.criteria) {
       wrap.innerHTML = '<tbody><tr><td class="loading error">Нет данных</td></tr></tbody>';
       return;
     }
     const { assets, criteria } = DATA.criteria;
     let html = '<thead><tr><th>Критерий</th>';
     assets.forEach(a => { html += `<th>${a.short}</th>`; });
     html += '</tr></thead><tbody>';
     criteria.forEach(c => {
       html += `<tr><td><strong>${c.label}</strong></td>`;
       assets.forEach(a => {
         const cell = c.cells[a.id] || {};
         const cls = cell.signal === 'good' ? 'badge-good'
                   : cell.signal === 'bad'  ? 'badge-bad'
                   : cell.signal === 'mixed'? 'badge-mixed'
                   : 'badge-na';
         const icon = cell.signal === 'good' ? '✓'
                    : cell.signal === 'bad'  ? '✗'
                    : cell.signal === 'mixed'? '~'
                    : '—';
         html += `<td><span class="${cls}">${icon}</span><br><small>${cell.text || ''}</small></td>`;
       });
       html += '</tr>';
     });
     html += '</tbody>';
     wrap.innerHTML = html;
   }
   
   /* ---------- Главный график цен ---------- */
   function buildPriceSeries() {
     const p = DATA.prices;
     if (!p?.event_anchors?.length) return null;
     const events = p.event_anchors;
     const labels = [];
     const btcRaw = [], ethRaw = [], trxRaw = [];
     const evNames = [];
   
     // Стартовая точка — «до» первого события
     const first = events[0];
     labels.push(fmtMonth(first.month));
     btcRaw.push(first.before.BTC_byn);
     ethRaw.push(first.before.ETH_byn);
     trxRaw.push(first.before.TRX_byn);
     evNames.push('старт периода');
   
     // Каждое событие — точка «после»
     events.forEach(e => {
       labels.push(fmtMonth(e.month));
       btcRaw.push(e.after.BTC_byn);
       ethRaw.push(e.after.ETH_byn);
       trxRaw.push(e.after.TRX_byn);
       evNames.push(e.event);
     });
   
     // Нормализация: первый = 100
     const norm = arr => arr.map(v => +(v / arr[0] * 100).toFixed(2));
     return {
       labels, evNames,
       btc: norm(btcRaw), eth: norm(ethRaw), trx: norm(trxRaw),
       btcRaw, ethRaw, trxRaw
     };
   }
   
   function renderPriceChart() {
     const s = buildPriceSeries();
     const canvas = document.getElementById('priceChart');
     if (!s || !canvas) return;
   
     new Chart(canvas.getContext('2d'), {
       type: 'line',
       data: {
         labels: s.labels,
         datasets: [
           { label: 'BTC', data: s.btc, borderColor: COLORS.BTC,
             backgroundColor: 'rgba(247,147,26,.08)', fill: true,
             tension: .25, pointRadius: 2.5, borderWidth: 2 },
           { label: 'ETH', data: s.eth, borderColor: COLORS.ETH,
             backgroundColor: 'rgba(98,126,234,.06)', fill: false,
             tension: .25, pointRadius: 2.5, borderWidth: 2 },
           { label: 'TRX', data: s.trx, borderColor: COLORS.TRX,
             backgroundColor: 'rgba(239,0,39,.06)', fill: false,
             tension: .25, pointRadius: 2.5, borderWidth: 2 }
         ]
       },
       options: {
         responsive: true, maintainAspectRatio: false,
         interaction: { mode: 'index', intersect: false },
         plugins: {
           legend: {
             labels: { color: '#e6edf7', boxWidth: 12, boxHeight: 12,
                       font: { size: 12, weight: '600' } }
           },
           tooltip: {
             callbacks: {
               title: items => {
                 const i = items[0].dataIndex;
                 return `${s.labels[i]} — ${s.evNames[i]}`;
               },
               label: ctx => {
                 const raw = [s.btcRaw, s.ethRaw, s.trxRaw][ctx.datasetIndex][ctx.dataIndex];
                 const name = ['BTC','ETH','TRX'][ctx.datasetIndex];
                 const rawStr = raw >= 1
                   ? raw.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
                   : raw.toFixed(4);
                 return `${name}: ${rawStr} BYN (индекс ${ctx.parsed.y})`;
               }
             }
           }
         },
         scales: {
           x: {
             ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 60, autoSkip: true, maxTicksLimit: 12 },
             grid: { color: 'rgba(148,163,184,.06)' }
           },
           y: {
             type: 'linear', beginAtZero: true,
             ticks: {
               color: '#94a3b8',
               callback: v => v >= 1000 ? (v/1000)+'k' : v
             },
             grid: { color: 'rgba(148,163,184,.06)' },
             title: { display: true, text: 'Индекс (старт = 100)', color: '#94a3b8', font: { size: 11 } }
           }
         }
       }
     });
   }
   
   /* ---------- График риска с переключателем ---------- */
   let riskChart = null;
   let currentRiskMetric = 'annual_volatility';
   
   function updateRiskChart(metricId) {
     const r = DATA.risk;
     if (!r) return;
     const m = r.metrics.find(x => x.id === metricId);
     if (!m) return;
     const assets = ['BTC', 'ETH', 'TRX', 'USDBYN'];
     const labels = ['BTC', 'ETH', 'TRX', 'USD/BYN'];
     const colors = [COLORS.BTC, COLORS.ETH, COLORS.TRX, COLORS.USD];
     const values = assets.map(a => {
       const v = m.values[a];
       return v == null ? null : Math.abs(v);
     });
     const titleText = m.label + (m.unit === '%' ? ', %' : '');
   
     if (riskChart) {
       riskChart.data.labels = labels;
       riskChart.data.datasets[0].data = values;
       riskChart.data.datasets[0].backgroundColor = colors.map(c => c + 'cc');
       riskChart.data.datasets[0].borderColor = colors;
       riskChart.options.plugins.title.text = titleText;
       riskChart.update();
     } else {
       riskChart = new Chart(document.getElementById('riskChart').getContext('2d'), {
         type: 'bar',
         data: {
           labels,
           datasets: [{
             label: titleText, data: values,
             backgroundColor: colors.map(c => c + 'cc'),
             borderColor: colors, borderWidth: 1, borderRadius: 6
           }]
         },
         options: {
           responsive: true, maintainAspectRatio: false,
           plugins: {
             legend: { display: false },
             title: {
               display: true, text: titleText, color: '#e6edf7',
               font: { size: 13, weight: '600' }, padding: { bottom: 12 }
             },
             tooltip: {
               callbacks: {
                 label: ctx => `${ctx.parsed.y.toFixed(1).replace('.', ',')} %`
               }
             }
           },
           scales: {
             x: { ticks: { color: '#94a3b8', font: { size: 12 } }, grid: { display: false } },
             y: {
               beginAtZero: true,
               ticks: { color: '#94a3b8', callback: v => v + '%' },
               grid: { color: 'rgba(148,163,184,.08)' }
             }
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
   
   /* ---------- Лента событий ---------- */
   function renderEvents() {
     const wrap = document.getElementById('events-strip');
     if (!DATA.events?.events?.length) {
       wrap.innerHTML = '<div class="loading error">Не удалось загрузить события</div>';
       return;
     }
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
   
   /* ---------- Подпериодный график (MDD) ---------- */
   function renderSubperiodChart() {
     const canvas = document.getElementById('subperiodChart');
     const s = DATA.events?.avg_mdd_by_subperiod?.series;
     if (!s || !canvas) return;
     new Chart(canvas.getContext('2d'), {
       type: 'bar',
       data: {
         labels: s.map(x => x.asset),
         datasets: [
           { label: '2019–2021', data: s.map(x => x.p1_2019_2021),
             backgroundColor: 'rgba(148,163,184,.55)', borderColor: COLORS.USD,
             borderWidth: 1, borderRadius: 6 },
           { label: '2022–2026', data: s.map(x => x.p2_2022_2026),
             backgroundColor: 'rgba(37,99,235,.65)', borderColor: '#2563eb',
             borderWidth: 1, borderRadius: 6 }
         ]
       },
       options: {
         responsive: true, maintainAspectRatio: false,
         plugins: {
           legend: { labels: { color: '#e6edf7', boxWidth: 12, boxHeight: 12, font: { size: 12 } } },
           title: { display: true, text: 'Средняя просадка в окнах событий, %',
                    color: '#e6edf7', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
           tooltip: {
             callbacks: {
               label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1).replace('.', ',')} %`
             }
           }
         },
         scales: {
           x: { ticks: { color: '#94a3b8', font: { size: 12 } }, grid: { display: false } },
           y: { beginAtZero: true, ticks: { color: '#94a3b8', callback: v => v + '%' },
                grid: { color: 'rgba(148,163,184,.08)' } }
         }
       }
     });
   }
   
   /* ---------- Портфельный калькулятор ---------- */
   let portChart = null;
   const SIGMA_USD = 12.5;   // годовая волатильность USD/BYN, %
   const SIGMA_BTC = 67.0;   // годовая волатильность BTC, %
   const RHO = 0.15;         // допущение о корреляции
   
   function portfolioVol(w) {
     const v = Math.pow(1 - w, 2) * Math.pow(SIGMA_USD, 2)
             + Math.pow(w, 2) * Math.pow(SIGMA_BTC, 2)
             + 2 * w * (1 - w) * RHO * SIGMA_USD * SIGMA_BTC;
     return Math.sqrt(v);
   }
   function portfolioVaR(w) {
     // нормальное приближение без учёта средней доходности (консервативно)
     return -1.645 * portfolioVol(w) / Math.sqrt(12);
   }
   
   function renderPortfolio() {
     const slider = document.getElementById('wSlider');
     const wValEl = document.getElementById('wVal');
     const volEl = document.getElementById('portVol');
     const varEl = document.getElementById('portVar');
     const canvas = document.getElementById('portChart');
     if (!slider || !canvas) return;
   
     // Построить кривую один раз
     const ws = Array.from({ length: 41 }, (_, i) => i / 40);
     portChart = new Chart(canvas.getContext('2d'), {
       type: 'line',
       data: {
         datasets: [
           {
             label: 'Волатильность портфеля',
             data: ws.map(w => ({ x: +(w * 100).toFixed(1), y: +portfolioVol(w).toFixed(2) })),
             borderColor: '#2563eb',
             backgroundColor: 'rgba(37,99,235,.10)',
             fill: true, tension: .3, pointRadius: 0, borderWidth: 2
           },
           {
             label: 'Текущий',
             data: [{ x: 0, y: portfolioVol(0) }],
             borderColor: '#ef4444',
             backgroundColor: '#ef4444',
             pointRadius: 8, pointHoverRadius: 10,
             pointBorderColor: '#fff', pointBorderWidth: 2,
             showLine: false
           }
         ]
       },
       options: {
         responsive: true, maintainAspectRatio: false,
         plugins: {
           legend: { display: false },
           tooltip: {
             filter: item => item.datasetIndex === 0,
             callbacks: {
               title: items => `Доля BTC: ${items[0].parsed.x} %`,
               label: ctx => `Волатильность: ${ctx.parsed.y.toFixed(1).replace('.', ',')} %`
             }
           }
         },
         scales: {
           x: {
             type: 'linear', min: 0, max: 100,
             title: { display: true, text: 'Доля BTC, %', color: '#94a3b8', font: { size: 11 } },
             ticks: { color: '#94a3b8', callback: v => v + '%' },
             grid: { color: 'rgba(148,163,184,.06)' }
           },
           y: {
             beginAtZero: true,
             title: { display: true, text: 'σ, % годовых', color: '#94a3b8', font: { size: 11 } },
             ticks: { color: '#94a3b8', callback: v => v + '%' },
             grid: { color: 'rgba(148,163,184,.06)' }
           }
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
   
       // Обновляем точку «Текущий»
       portChart.data.datasets[1].data = [{ x: +(w * 100).toFixed(1), y: +vol.toFixed(2) }];
       portChart.update('none');
     }
   
     slider.addEventListener('input', update);
     update();
   }
   
   /* ---------- Старт ---------- */
   async function main() {
     const errors = await loadAll();
     if (errors.length) {
       console.warn('Некоторые данные не загрузились:', errors);
     }
     try { renderKPIs(); } catch (e) { console.error('KPIs:', e); }
     try { renderMatrix(); } catch (e) { console.error('Matrix:', e); }
     try { renderPriceChart(); } catch (e) { console.error('PriceChart:', e); }
     try { renderRiskChart(); } catch (e) { console.error('RiskChart:', e); }
     try { renderEvents(); } catch (e) { console.error('Events:', e); }
     try { renderSubperiodChart(); } catch (e) { console.error('Subperiod:', e); }
     try { renderPortfolio(); } catch (e) { console.error('Portfolio:', e); }
   }
   
   document.addEventListener('DOMContentLoaded', main);