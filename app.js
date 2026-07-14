// Main Dashboard Application Controller

window.formatRupiah = function(val) {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (isNegative ? '-Rp ' : 'Rp ') + formatted;
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Navigation & Routing
    initNavigation();

    // Initialize clock and weather widgets
    initClockAndWeather();

    // Initialize Canvas Chart Engine with loaded pair from state
    let startPair = 'EUR/USD';
    const savedRobotState = localStorage.getItem('forex_robot_state');
    if (savedRobotState) {
        try {
            startPair = JSON.parse(savedRobotState).currentPair || 'EUR/USD';
        } catch (e) {}
    }
    window.forexChartEngine.init('chartCanvas', startPair);

    // Bind state changes to DOM updates
    window.forexTradingEngine.subscribeStateChange(updateDOM);
    window.forexTradingEngine.subscribeLogs(addNewLogToDOM);
    window.forexNewsEngine.subscribe((news) => {
        addNewNewsToDOM(news);
        // Let trading engine evaluate strategy when new news arrives
        window.forexTradingEngine.evaluateRobotStrategy(window.forexChartEngine, window.forexNewsEngine);
    });

    // Initial renders
    updateDOM(window.forexTradingEngine);
    renderInitialNews();
    renderJournal();
    renderFormulas();
    renderBrokerView();
    renderAssetsTab();

    // Pastikan saldo & riwayat disinkronkan dari broker jika terhubung pada saat load
    if (window.brokerEngine && window.forexTradingEngine) {
        const activeBroker = window.brokerEngine.getActiveBroker();
        if (activeBroker && activeBroker.connected) {
            const data = window.brokerEngine.brokerBalances[activeBroker.id];
            if (data) {
                window.forexTradingEngine.initialBalance = data.initialBalance;
                window.forexTradingEngine.balance = data.balance;
                window.forexTradingEngine.realtimeBalance = data.realtimeBalance;
                window.forexTradingEngine.finalBalance = data.finalBalance;
                window.forexTradingEngine.tradeHistory = [...data.tradeHistory];
                window.forexTradingEngine.tradeLogs = [...data.tradeLogs];
                window.forexTradingEngine.saveState();
                updateDOM(window.forexTradingEngine); // Redraw UI
            }
        }
    }

    // Start Simulation Loops
    startSimulationLoops();

    // Hook Form Actions
    setupFormListeners();

    // 3D/5D Interactive Effects on Hover
    setupTiltEffect();
});

// 1. Navigation SPA Router & 3D Interactive Menus
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const panels = document.querySelectorAll('.viewport-panel');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Set active class on nav
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            link.parentElement.classList.add('active');

            // Switch active panel
            panels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === targetId) {
                    panel.classList.add('active');
                }
            });

            // Specific tab initializations
            if (targetId === 'journal-tab') {
                renderJournal();
            } else if (targetId === 'formulas-tab') {
                renderFormulas();
            } else if (targetId === 'broker-tab') {
                renderBrokerView();
            }
        });
    });
}

// 2. Real-Time Timezone, Calendar Day, and Weather info
function initClockAndWeather() {
    const clockEl = document.getElementById('widgetClock');
    const dateEl = document.getElementById('widgetDate');
    const weatherEl = document.getElementById('widgetWeather');

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    function tick() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Makassar' }) + ' WITA';
        
        const dayName = days[now.getDay()];
        const dateNum = now.getDate();
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();
        dateEl.textContent = `${dayName}, ${dateNum} ${monthName} ${year}`;
    }
    
    tick();
    setInterval(tick, 1000);

    // Weather Simulation (Kupang GPS Coordinates)
    const weatherConditions = ['Cerah', 'Berawan', 'Cerah Berawan', 'Hujan Lokal'];
    const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    const temp = Math.floor(Math.random() * 4) + 30; // 30 to 33 °C
    weatherEl.textContent = `Kupang, ID: ${temp}°C • ${randomCondition}`;
}

// 3. Loops (Price, News, Robot ticks)
function startSimulationLoops() {
    // 1. Tick price every 1 second
    setInterval(() => {
        // Price fluctuations based on selected asset volatility
        const vol = window.forexChartEngine.getVolatility();
        const change = (Math.random() - 0.5) * vol * 0.75;
        window.forexChartEngine.tick(change);

        // Update trading floating profit/loss
        window.forexTradingEngine.update(window.forexChartEngine.currentPrice);

        // Render predictions & current prices on UI
        updatePricePredictions();

        // Render assets tab prices live
        renderAssetsTab();
    }, 1000);

    // 2. Add new candle every 30 seconds (speed up from 60s for demo interactivity)
    setInterval(() => {
        window.forexChartEngine.addNewCandle();
        
        // Robot evaluates indicators at every candle close
        window.forexTradingEngine.evaluateRobotStrategy(window.forexChartEngine, window.forexNewsEngine);
    }, 30000);

    // 3. Trigger fundamental news automatically every 45 seconds
    setInterval(() => {
        window.forexNewsEngine.triggerNewNews();
    }, 45000);
}

// 4. Update UI Components (Dynamic DOM manipulation)
function updateDOM(state) {
    const activeBroker = window.brokerEngine ? window.brokerEngine.getActiveBroker() : null;
    const isConnected = activeBroker && activeBroker.connected;

    // Sembunyikan/Tampilkan saldo berdasarkan koneksi broker
    const balanceGrid = document.getElementById('balanceWidgetGrid');
    const balancePlaceholder = document.getElementById('brokerBalancePlaceholder');
    if (balanceGrid && balancePlaceholder) {
        if (isConnected) {
            balanceGrid.style.display = 'grid';
            balancePlaceholder.style.display = 'none';
        } else {
            balanceGrid.style.display = 'none';
            balancePlaceholder.style.display = 'block';
        }
    }

    // Update Broker HUD di atas Transaksi Aktif
    const posTableBrokerInfo = document.getElementById('posTableBrokerInfo');
    if (posTableBrokerInfo) {
        if (isConnected) {
            posTableBrokerInfo.innerHTML = `Akun terhubung: <strong style="color:#fff;">${activeBroker.name}</strong> <span style="color:var(--text-muted); margin-left: 5px;">(ID: ${activeBroker.accountId})</span> • <span style="font-size:0.75rem; color:var(--success); border: 1px solid var(--success); padding: 1px 4px; border-radius: 4px; font-weight:bold; margin-left: 5px;">LIVE</span>`;
        } else {
            posTableBrokerInfo.innerHTML = `Akun terhubung: <strong style="color:#fff;">Demo Sandbox</strong> <span style="color:var(--text-muted); margin-left: 5px;">(ID: DEMO-ACCOUNT)</span> • <span style="font-size:0.75rem; color:var(--primary); border: 1px solid var(--primary); padding: 1px 4px; border-radius: 4px; font-weight:bold; margin-left: 5px;">DEMO</span>`;
        }
    }

    // Update Broker HUD Status di Dashboard
    const dashBrokerDot = document.getElementById('dashBrokerStatusDot');
    const dashBrokerText = document.getElementById('dashBrokerStatusText');
    const dashActiveAsset = document.getElementById('dashActiveAsset');
    const btnDashCloseAll = document.getElementById('btnDashCloseAll');

    if (dashBrokerDot && dashBrokerText && dashActiveAsset) {
        if (isConnected) {
            dashBrokerDot.classList.add('active');
            dashBrokerText.innerHTML = `${activeBroker.name} <span style="color:var(--text-muted); font-size:0.8rem;">(Rek: ${activeBroker.accountId})</span> <span style="font-size:0.75rem; color:var(--success); border: 1px solid var(--success); padding: 1px 4px; border-radius: 4px; margin-left: 5px;">LIVE</span>`;
        } else {
            dashBrokerDot.classList.remove('active');
            dashBrokerText.innerHTML = `Demo Sandbox <span style="color:var(--text-muted); font-size:0.8rem;">(Akun Simulasi)</span> <span style="font-size:0.75rem; color:var(--primary); border: 1px solid var(--primary); padding: 1px 4px; border-radius: 4px; margin-left: 5px;">DEMO</span>`;
        }
        
        const currentPair = window.forexTradingEngine.currentPair || 'EUR/USD';
        dashActiveAsset.textContent = currentPair;

        // Tampilkan tombol close posisi jika ada transaksi aktif pada aset ini
        if (btnDashCloseAll) {
            const hasActivePos = state.positions && state.positions.some(p => p.pair === currentPair);
            btnDashCloseAll.style.display = hasActivePos ? 'block' : 'none';
        }
    }

    // Balances
    const initialBalEl = document.getElementById('initialBalance');
    const realtimeBalEl = document.getElementById('realtimeBalance');
    const finalBalEl = document.getElementById('finalBalance');

    if (initialBalEl) initialBalEl.textContent = window.formatRupiah(state.initialBalance);
    if (realtimeBalEl) {
        realtimeBalEl.textContent = window.formatRupiah(state.realtimeBalance);
        
        // Dynamic balance text color based on profit/loss
        const profit = state.realtimeBalance - state.balance;
        const subtextEl = realtimeBalEl.nextElementSibling;
        
        if (profit > 0) {
            realtimeBalEl.style.color = '#00ff87';
            subtextEl.className = "balance-subtext profit";
            subtextEl.innerHTML = `▲ Floating: +${window.formatRupiah(profit)}`;
        } else if (profit < 0) {
            realtimeBalEl.style.color = '#ff007f';
            subtextEl.className = "balance-subtext loss";
            subtextEl.innerHTML = `▼ Floating: -${window.formatRupiah(Math.abs(profit))}`;
        } else {
            realtimeBalEl.style.color = 'var(--text-main)';
            subtextEl.className = "balance-subtext";
            subtextEl.innerHTML = `• Tidak ada posisi aktif`;
        }
    }
    if (finalBalEl) finalBalEl.textContent = window.formatRupiah(state.finalBalance);

    // Auto Trading Switch Checkbox
    const autoSwitches = document.querySelectorAll('.auto-trading-toggle');
    autoSwitches.forEach(sw => {
        sw.checked = state.isAutoTrading;
    });

    const statusDot = document.getElementById('botStatusDot');
    const statusText = document.getElementById('botStatusText');
    if (statusDot) {
        if (state.isAutoTrading) {
            statusDot.classList.add('active');
            statusText.textContent = 'Auto Robot: AKTIF';
            statusText.style.color = 'var(--success)';
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'Auto Robot: OFF';
            statusText.style.color = 'var(--text-muted)';
        }
    }

    // Active Positions Table
    const tbody = document.getElementById('positionsTableBody');
    if (tbody) {
        if (state.positions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada posisi trading aktif saat ini.</td></tr>`;
        } else {
            tbody.innerHTML = state.positions.map(pos => {
                const isProfit = pos.pnl >= 0;
                const config = window.ASSET_CONFIGS ? (window.ASSET_CONFIGS[pos.pair] || window.ASSET_CONFIGS['EUR/USD']) : { decimals: 5 };
                const dec = config.decimals;
                return `
                    <tr>
                        <td><strong>${pos.pair}</strong></td>
                        <td><span class="badge-type ${pos.type.toLowerCase()}">${pos.type}</span></td>
                        <td class="tech-font">${pos.entryPrice.toFixed(dec)}</td>
                        <td class="tech-font">${pos.size.toFixed(2)} Lot</td>
                        <td class="tech-font" style="color: var(--danger)">${pos.sl.toFixed(dec)}</td>
                        <td class="tech-font" style="color: var(--success)">${pos.tp.toFixed(dec)}</td>
                        <td class="tech-font" style="color: ${isProfit ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">
                            ${isProfit ? '+' : ''}${window.formatRupiah(pos.pnl)}
                        </td>
                        <td>
                            <button class="btn-close-position" onclick="window.forexTradingEngine.closePosition('${pos.id}', window.forexChartEngine.currentPrice)">
                                Close
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Log History rendering in Sidebar or Panel
    const logList = document.getElementById('logPanelBody');
    if (logList) {
        logList.innerHTML = state.tradeLogs.map(log => `
            <div class="log-item">
                <div class="log-item-header">
                    <strong style="color: var(--primary);">${log.action}</strong>
                    <span class="log-time">${new Date(log.time).toLocaleTimeString('id-ID')}</span>
                </div>
                <div class="log-reason">${log.reason}</div>
            </div>
        `).join('');
    }

    // Dynamic Summary calculations for dashboard indicators
    updateSummaryStats(state);
}

function updateSummaryStats(state) {
    const stats = window.forexJournalEngine.getStatistics(state.tradeHistory);
    
    // Bind stats on dashboard if present
    const winRateEl = document.getElementById('statWinRate');
    const netProfitEl = document.getElementById('statNetProfit');
    const totalTradesEl = document.getElementById('statTotalTrades');

    if (winRateEl) winRateEl.textContent = `${stats.winRate}%`;
    if (netProfitEl) {
        netProfitEl.textContent = `${stats.netProfit >= 0 ? '+' : ''}${window.formatRupiah(stats.netProfit)}`;
        netProfitEl.style.color = stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (totalTradesEl) totalTradesEl.textContent = stats.totalTrades;
}

// 5. Direction Predictions logic based on calculations
function updatePricePredictions() {
    const currentPrice = window.forexChartEngine.currentPrice;
    const rsiVal = window.forexChartEngine.rsi[window.forexChartEngine.rsi.length - 1] || 50;
    const emaVal = window.forexChartEngine.ema20[window.forexChartEngine.ema20.length - 1] || currentPrice;
    const sentiment = window.forexNewsEngine.currentSentiment;

    const timeframes = ['1m', '5m', '15m', '30m', '1h', '1d'];
    
    timeframes.forEach((tf, idx) => {
        const card = document.getElementById(`predict-${tf}`);
        if (!card) return;

        let direction = 'SIDEWAYS';
        let arrow = '→';
        let score = 0;

        // Weights differ per timeframe
        // Shorter timeframes track RSI and immediate price relative to EMA
        // Longer timeframes track economic news sentiment
        if (tf === '1m' || tf === '5m') {
            score = (currentPrice > emaVal ? 2 : -2) + (rsiVal < 45 ? 1 : (rsiVal > 55 ? -1 : 0));
        } else if (tf === '15m' || tf === '30m') {
            score = (currentPrice > emaVal ? 1 : -1) + (sentiment > 15 ? 2 : (sentiment < -15 ? -2 : 0));
        } else {
            // 1h, 1d heavily rely on news sentiment
            score = (sentiment > 25 ? 3 : (sentiment < -25 ? -3 : 0));
        }

        // Add minor dynamic jitter to prediction maps so they fluctuate realistically
        score += Math.sin(Date.now() / 5000 + idx) * 0.5;

        if (score > 0.8) {
            direction = 'BULLISH';
            arrow = '▲';
        } else if (score < -0.8) {
            direction = 'BEARISH';
            arrow = '▼';
        }

        const dirEl = card.querySelector('.predict-dir');
        const arrowEl = card.querySelector('.predict-arrow');

        dirEl.textContent = direction;
        dirEl.className = `predict-dir ${direction.toLowerCase()}`;
        arrowEl.textContent = arrow;
    });
}

// 6. News rendering and side elements
function renderInitialNews() {
    const list = document.getElementById('newsFeedList');
    if (!list) return;

    list.innerHTML = window.forexNewsEngine.newsHistory.map(news => createNewsCardHTML(news)).join('');
    updateSentimentHUD();
}

function addNewNewsToDOM(news) {
    const list = document.getElementById('newsFeedList');
    if (!list) return;

    const div = document.createElement('div');
    div.innerHTML = createNewsCardHTML(news);
    const newCard = div.firstElementChild;
    
    list.insertBefore(newCard, list.firstChild);
    if (list.children.length > 20) {
        list.lastChild.remove();
    }

    updateSentimentHUD();
}

function createNewsCardHTML(news) {
    const isBullish = news.sentiment > 0;
    const sentimentType = news.sentiment > 15 ? 'sentiment-bullish' : (news.sentiment < -15 ? 'sentiment-bearish' : 'sentiment-neutral');
    const sentimentLabel = news.sentiment > 15 ? 'BULLISH' : (news.sentiment < -15 ? 'BEARISH' : 'NEUTRAL');
    
    return `
        <div class="news-card">
            <div class="news-card-header">
                <span class="news-badge-sentiment ${sentimentType}">${sentimentLabel} (${news.sentiment > 0 ? '+' : ''}${news.sentiment}%)</span>
                <span class="news-impact impact-${news.impact.toLowerCase()}">${news.impact} IMPACT</span>
                <span class="log-time">${new Date(news.time).toLocaleTimeString('id-ID')}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-desc">${news.desc}</p>
        </div>
    `;
}

function updateSentimentHUD() {
    const circleVal = document.getElementById('overallSentimentVal');
    const circleLbl = document.getElementById('overallSentimentLbl');
    const circle = document.getElementById('overallSentimentCircle');
    
    if (circleVal) {
        const val = window.forexNewsEngine.currentSentiment;
        circleVal.textContent = `${val > 0 ? '+' : ''}${val}%`;
        circleLbl.textContent = window.forexNewsEngine.getSentimentLabel();

        // Adjust glow/border color of sentiment circle
        if (val > 15) {
            circle.style.borderColor = 'var(--success)';
            circle.style.boxShadow = '0 0 20px rgba(0, 255, 135, 0.2)';
        } else if (val < -15) {
            circle.style.borderColor = 'var(--danger)';
            circle.style.boxShadow = '0 0 20px rgba(255, 0, 127, 0.2)';
        } else {
            circle.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            circle.style.boxShadow = 'none';
        }
    }
}

// 7. Journal Page rendering & Custom Canvas Performance Graph
function renderJournal() {
    const journalEntriesList = document.getElementById('journalEntriesList');
    if (!journalEntriesList) return;

    // Load targets into inputs
    document.getElementById('targetDaily').value = window.forexJournalEngine.targets.dailyProfit;
    document.getElementById('targetWeekly').value = window.forexJournalEngine.targets.weeklyProfit;
    document.getElementById('targetLoss').value = Math.abs(window.forexJournalEngine.targets.maxDailyLoss);

    // List Calendar
    const calList = document.getElementById('calendarEventList');
    if (calList) {
        calList.innerHTML = window.forexJournalEngine.calendarEvents.map(ev => `
            <div class="cal-item">
                <div class="cal-date-box">
                    <span class="cal-day">${ev.date}</span>
                    <span class="cal-month">${ev.month}</span>
                </div>
                <div class="cal-details">
                    <span class="cal-time-flag">
                        <strong style="color: var(--primary);">${ev.currency}</strong> • ${ev.time} • 
                        <span class="news-impact impact-${ev.impact.toLowerCase()}">${ev.impact}</span>
                    </span>
                    <span class="cal-title">${ev.title}</span>
                    <span class="cal-time-flag">Pred: ${ev.forecast} | Sblm: ${ev.previous}</span>
                </div>
            </div>
        `).join('');
    }

    // List Journal notes
    if (window.forexJournalEngine.manualEntries.length === 0) {
        journalEntriesList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Belum ada catatan jurnal. Klik tombol diatas untuk menambahkan target & refleksi trading harian Anda.</p>`;
    } else {
        journalEntriesList.innerHTML = window.forexJournalEngine.manualEntries.map(e => `
            <div class="log-item" style="margin-bottom: 0.75rem;">
                <div class="log-item-header">
                    <span class="badge-type ${e.mood === 'POSITIVE' ? 'buy' : (e.mood === 'NEGATIVE' ? 'sell' : 'neutral')}" style="padding: 0.1rem 0.4rem;">
                        ${e.mood}
                    </span>
                    <span class="log-time">${new Date(e.time).toLocaleDateString('id-ID')} ${new Date(e.time).toLocaleTimeString('id-ID')}</span>
                </div>
                <div style="margin-top: 0.4rem; line-height: 1.4;">${e.note}</div>
                <div style="text-align: right; margin-top: 0.4rem;">
                    <a href="#" style="color: var(--danger); font-size: 0.8rem; text-decoration: none;" onclick="deleteJournal('${e.id}')">Hapus</a>
                </div>
            </div>
        `).join('');
    }

    // Draw Performance growth line chart
    drawPerformanceGraph();
}

window.deleteJournal = function(id) {
    window.forexJournalEngine.deleteJournalEntry(id);
    renderJournal();
};

function drawPerformanceGraph() {
    const canvas = document.getElementById('performanceChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '180px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 180;

    // Clear Canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    // Calculate points from history balances
    const history = window.forexTradingEngine.tradeHistory;
    let points = [10000]; // starting point
    let balanceAccum = 10000;

    history.forEach(trade => {
        balanceAccum += trade.pnl;
        points.push(balanceAccum);
    });

    if (points.length < 2) {
        // Mock a flat line if no trades yet
        points = [10000, 10000, 10000];
    }

    const maxVal = Math.max(...points) * 1.002;
    const minVal = Math.min(...points) * 0.998;
    const range = maxVal - minVal || 100;

    const getX = (idx) => (idx / (points.length - 1)) * (width - 60) + 20;
    const getY = (val) => height - 30 - ((val - minVal) / range) * (height - 50);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = 20 + i * (height - 50) / 3;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(width - 40, y);
        ctx.stroke();
    }

    // Draw equity curve (Gradient line)
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(points[0]));
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(getX(i), getY(points[i]));
    }

    // Style and stroke equity line
    const colorGrad = ctx.createLinearGradient(0, 0, width, 0);
    colorGrad.addColorStop(0, '#00f2fe');
    colorGrad.addColorStop(1, '#00ff87');
    
    ctx.strokeStyle = colorGrad;
    ctx.lineWidth = 3;
    
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 242, 254, 0.3)';
    ctx.stroke();
    ctx.restore();

    // Fill underneath the curve for volumetric look (5D glass feel)
    ctx.lineTo(getX(points.length - 1), height - 20);
    ctx.lineTo(getX(0), height - 20);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, 20, 0, height - 20);
    fillGrad.addColorStop(0, 'rgba(0, 242, 254, 0.15)');
    fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Draw data points as glowing dots
    points.forEach((pt, idx) => {
        const cx = getX(idx);
        const cy = getY(pt);
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    const formatChartLabel = (val) => {
        if (val >= 1000000) {
            return `Rp ${(val / 1000000).toFixed(1)}jt`;
        } else if (val >= 1000) {
            return `Rp ${(val / 1000).toFixed(0)}rb`;
        }
        return `Rp ${val.toFixed(0)}`;
    };

    // Draw Y labels (Min, Max, Current)
    ctx.fillStyle = '#8c9bb4';
    ctx.font = '9px Rajdhani';
    ctx.fillText(formatChartLabel(maxVal), width - 60, 20);
    ctx.fillText(formatChartLabel(minVal), width - 60, height - 30);
    ctx.fillText(formatChartLabel(points[points.length-1]), width - 60, getY(points[points.length-1]) + 3);
}

// 8. Formulas tab dynamic calculators
let activeFormulaTab = 'posSize';
function renderFormulas() {
    const tabs = document.querySelectorAll('.formula-tab-item');
    const title = document.getElementById('formulaTitle');
    const desc = document.getElementById('formulaDesc');
    const calcBody = document.getElementById('formulaCalculatorBody');

    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-formula') === activeFormulaTab) {
            tab.classList.add('active');
        }

        tab.onclick = () => {
            activeFormulaTab = tab.getAttribute('data-formula');
            renderFormulas();
        };
    });

    // Populate contents based on selected tab
    if (activeFormulaTab === 'posSize') {
        title.textContent = "Position Sizing (Manajemen Risiko)";
        desc.innerHTML = `
            <p>Digunakan oleh trader dunia untuk membatasi kerugian maksimal. Rumus ini menghitung lot size ideal berdasarkan persentase modal yang siap dipertaruhkan.</p>
            <blockquote style="margin: 1rem 0; border-left: 3px solid var(--primary); padding-left: 1rem; font-style: italic; color: var(--text-muted);">
                Lot Size = (Saldo * Risiko%) / (Stop Loss Pips * Nilai Pip per Lot)
            </blockquote>
            <p><strong>Rekomendasi:</strong> Jangan pernah merisikokan lebih dari 1% - 2% saldo Anda per transaksi.</p>
        `;
        
        calcBody.innerHTML = `
            <div class="form-group">
                <label>Saldo Akun (Rp)</label>
                <input type="number" id="calcBalance" class="form-input" value="${window.forexTradingEngine.balance}">
            </div>
            <div class="form-group">
                <label>Persentase Risiko (%)</label>
                <input type="number" id="calcRisk" class="form-input" value="1" step="0.1">
            </div>
            <div class="form-group">
                <label>Stop Loss (Pips)</label>
                <input type="number" id="calcSL" class="form-input" value="30">
            </div>
            <button class="btn-primary" style="width: 100%;" onclick="calculateFormulaResult('posSize')">Hitung Lot Sizing</button>
            
            <div id="calcResultBox" class="calc-result-box" style="display: none;">
                <div class="calc-result-title">LOT SIZING YANG AMAN:</div>
                <div class="calc-result-val" id="calcResultVal">0.33 Lot</div>
                <small style="color: var(--text-muted);" id="calcResultSub">Menanggung risiko sebesar $100.00</small>
            </div>
        `;
    } else if (activeFormulaTab === 'kelly') {
        title.textContent = "Kelly Criterion (Optimal Alokasi Aset)";
        desc.innerHTML = `
            <p>Diciptakan oleh John L. Kelly Jr., rumus ini memprediksi alokasi modal optimal untuk memaksimalkan pertumbuhan jangka panjang berdasar probabilitas menang (Win Rate).</p>
            <blockquote style="margin: 1rem 0; border-left: 3px solid var(--primary); padding-left: 1rem; font-style: italic; color: var(--text-muted);">
                K% = WinRate% - [ (100% - WinRate%) / Win/Loss Ratio ]
            </blockquote>
            <p><strong>Catatan:</strong> Jika nilai Kelly bernilai negatif, disarankan untuk tidak mengambil transaksi tersebut karena perkiraan matematis menunjukkan kerugian.</p>
        `;

        calcBody.innerHTML = `
            <div class="form-group">
                <label>Win Rate (%)</label>
                <input type="number" id="calcWinRate" class="form-input" value="55" min="1" max="100">
            </div>
            <div class="form-group">
                <label>Win / Loss Ratio (Rasio Profit : Loss)</label>
                <input type="number" id="calcRatio" class="form-input" value="2" step="0.1">
            </div>
            <button class="btn-primary" style="width: 100%;" onclick="calculateFormulaResult('kelly')">Hitung Kelly Fraction</button>
            
            <div id="calcResultBox" class="calc-result-box" style="display: none;">
                <div class="calc-result-title">ALOKASI MAKSIMAL SALDO:</div>
                <div class="calc-result-val" id="calcResultVal">32.50%</div>
                <small style="color: var(--text-muted);">Disarankan menggunakan 'Half-Kelly' (setengah nilai di atas) untuk kehati-hatian ekstra.</small>
            </div>
        `;
    } else if (activeFormulaTab === 'fibo') {
        title.textContent = "Fibonacci Retracement (Level Psikologis)";
        desc.innerHTML = `
            <p>Menggunakan deret angka emas matematika (0.236, 0.382, 0.500, 0.618, 0.786) untuk menentukan batas support dan resistance terkuat saat harga memantul.</p>
        `;

        calcBody.innerHTML = `
            <div class="form-group">
                <label>Arah Trend saat ini</label>
                <select id="calcFiboTrend" class="form-input">
                    <option value="Uptrend">Uptrend (Naik)</option>
                    <option value="Downtrend">Downtrend (Turun)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Harga Tertinggi (Swing High)</label>
                <input type="number" id="calcFiboHigh" class="form-input" value="1.09800" step="0.00001">
            </div>
            <div class="form-group">
                <label>Harga Terendah (Swing Low)</label>
                <input type="number" id="calcFiboLow" class="form-input" value="1.08200" step="0.00001">
            </div>
            <button class="btn-primary" style="width: 100%;" onclick="calculateFormulaResult('fibo')">Hitung Retracement</button>
            
            <div id="calcResultBox" style="display: none; margin-top: 1.5rem;">
                <table class="fancy-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr><th>Tingkat Fibo</th><th>Batas Target Harga</th></tr>
                    </thead>
                    <tbody id="fiboResultBody"></tbody>
                </table>
            </div>
        `;
    }
}

window.calculateFormulaResult = function(type) {
    const box = document.getElementById('calcResultBox');
    if (!box) return;
    box.style.display = 'block';

    if (type === 'posSize') {
        const bal = parseFloat(document.getElementById('calcBalance').value);
        const risk = parseFloat(document.getElementById('calcRisk').value);
        const sl = parseFloat(document.getElementById('calcSL').value);
        
        const result = window.TradingFormulas.calculatePositionSize(bal, risk, sl);
        document.getElementById('calcResultVal').textContent = `${result.lots} Lot`;
        document.getElementById('calcResultSub').textContent = `Maksimum kerugian ditoleransi: ${window.formatRupiah(result.riskAmount)}`;
    } else if (type === 'kelly') {
        const win = parseFloat(document.getElementById('calcWinRate').value);
        const ratio = parseFloat(document.getElementById('calcRatio').value);
        
        const result = window.TradingFormulas.calculateKelly(win, ratio);
        document.getElementById('calcResultVal').textContent = `${result}%`;
    } else if (type === 'fibo') {
        const trend = document.getElementById('calcFiboTrend').value;
        const high = parseFloat(document.getElementById('calcFiboHigh').value);
        const low = parseFloat(document.getElementById('calcFiboLow').value);

        const result = window.TradingFormulas.calculateFibonacci(high, low, trend);
        const tbody = document.getElementById('fiboResultBody');
        tbody.innerHTML = Object.entries(result).map(([level, val]) => `
            <tr><td><strong>${level}</strong></td><td class="tech-font">${val.toFixed(5)}</td></tr>
        `).join('');
    }
};

// 9. Broker View Rendering
let selectedBrokerId = 'exness';
let selectedPayMethod = 'qris';

function renderBrokerView() {
    const cards = document.querySelectorAll('.broker-select-card');
    const formPanel = document.getElementById('brokerConnectionPanel');

    cards.forEach(card => {
        card.classList.remove('active');
        const bId = card.getAttribute('data-broker');
        const isConnected = window.brokerEngine.brokers.find(b => b.id === bId).connected;
        
        // Show status badge
        const badge = card.querySelector('.status-dot');
        if (isConnected) {
            badge.classList.add('active');
        } else {
            badge.classList.remove('active');
        }

        if (bId === selectedBrokerId) {
            card.classList.add('active');
        }

        card.onclick = () => {
            selectedBrokerId = bId;
            window.brokerEngine.activeBrokerId = bId;
            renderBrokerView();
        };
    });

    // Populate connection forms
    const activeBroker = window.brokerEngine.brokers.find(b => b.id === selectedBrokerId);
    
    if (activeBroker.connected) {
        formPanel.innerHTML = `
            <div style="text-align: center; padding: 1.5rem 0;">
                <div class="status-dot active" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
                <h3 style="margin-bottom: 0.5rem;">Terhubung dengan ${activeBroker.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
                    Nomor Akun: <strong>${activeBroker.accountId}</strong><br>
                    Server: ${activeBroker.server}
                </p>
                
                <div class="auto-toggle-container" style="margin-bottom: 1.5rem;">
                    <div>
                        <strong>Mulai Trading Otomatis di Broker</strong>
                        <p style="font-size: 0.75rem; color: var(--text-muted);">Izinkan robot membuka posisi langsung di akun real Anda</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="brokerAutoTradeToggle" ${window.brokerEngine.isAutoTradingOnBroker ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <button class="btn-primary" style="background: var(--danger); color: white; width: 100%;" onclick="disconnectActiveBroker()">
                    Putuskan Tautan Broker
                </button>
            </div>
        `;

        // Bind auto trade toggle inside broker view
        const toggle = document.getElementById('brokerAutoTradeToggle');
        if (toggle) {
            toggle.onchange = (e) => {
                const res = window.brokerEngine.toggleAutoTradingOnBroker(e.target.checked);
                if (!res.success) {
                    alert(res.msg);
                    e.target.checked = false;
                } else {
                    // Activate global auto trading too
                    if (e.target.checked) {
                        window.forexTradingEngine.startAutoTrading();
                    } else {
                        window.forexTradingEngine.stopAutoTrading();
                    }
                }
            };
        }
    } else {
        formPanel.innerHTML = `
            <h3>Tautkan Akun ${activeBroker.name}</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem;">
                Masukkan kredensial trading Anda untuk mensinkronisasikan bot dengan broker Anda secara aman.
            </p>
            <form id="brokerLinkForm" onsubmit="connectActiveBroker(event)">
                <div class="form-group">
                    <label>Nomor Akun / Login ID</label>
                    <input type="text" id="brokerAccId" class="form-input" required placeholder="Contoh: 8872190">
                </div>
                <div class="form-group">
                    <label>Password Akun</label>
                    <input type="password" id="brokerPass" class="form-input" required placeholder="••••••••">
                </div>
                <div class="form-group">
                    <label>Server Trading</label>
                    <input type="text" id="brokerServer" class="form-input" required placeholder="Contoh: Exness-Real15">
                </div>
                <div class="form-group">
                    <label>Saldo Akun Riil (Rp)</label>
                    <input type="number" id="brokerBalanceInput" class="form-input" required value="1000000" min="0" step="100000">
                </div>
                <button type="submit" class="btn-primary" style="width: 100%;">Tautkan Akun Sekarang</button>
            </form>
        `;
    }

    // Top-up Section bindings
    renderTopupSection();
}

window.connectActiveBroker = function(e) {
    e.preventDefault();
    const acc = document.getElementById('brokerAccId').value;
    const srv = document.getElementById('brokerServer').value;
    const balInput = document.getElementById('brokerBalanceInput');
    const balanceVal = balInput ? parseFloat(balInput.value) : 1000000.00;
    
    window.brokerEngine.connectBroker(selectedBrokerId, acc, srv, balanceVal);
    renderBrokerView();
};

window.disconnectActiveBroker = function() {
    window.brokerEngine.disconnectBroker(selectedBrokerId);
    renderBrokerView();
};

function renderTopupSection() {
    const activeBroker = window.brokerEngine.brokers.find(b => b.id === selectedBrokerId);
    const topupForm = document.getElementById('topupFormContainer');

    if (!topupForm) return;

    if (!activeBroker.connected) {
        topupForm.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                Tautkan akun broker pilihan Anda terlebih dahulu untuk mengaktifkan menu Top-up deposit instan.
            </div>
        `;
        return;
    }

    topupForm.innerHTML = `
        <div class="form-group">
            <label>Jumlah Deposit (Rp)</label>
            <input type="number" id="topupAmount" class="form-input" value="15000000" min="100000" step="500000">
        </div>
        <label style="font-size: 0.85rem; color: var(--text-muted);">Pilih Metode Pembayaran</label>
        <div class="payment-methods">
            <div class="pay-method ${selectedPayMethod === 'qris' ? 'active' : ''}" onclick="selectPayMethod('qris')">QRIS Instan</div>
            <div class="pay-method ${selectedPayMethod === 'bank' ? 'active' : ''}" onclick="selectPayMethod('bank')">Transfer Bank</div>
            <div class="pay-method ${selectedPayMethod === 'crypto' ? 'active' : ''}" onclick="selectPayMethod('crypto')">USDT (Crypto)</div>
        </div>
        <button class="btn-primary" style="width: 100%; margin-top: 1rem;" onclick="processTopup()">
            Konfirmasi & Deposit Sekarang
        </button>
    `;
}

window.selectPayMethod = function(method) {
    selectedPayMethod = method;
    renderTopupSection();
};

window.processTopup = function() {
    const amount = parseFloat(document.getElementById('topupAmount').value);
    if (!amount || amount <= 0) {
        alert("Masukkan jumlah deposit yang valid.");
        return;
    }

    const btn = document.querySelector('#topupFormContainer button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Memproses Transaksi... (Mengamankan Gateway)";

    window.brokerEngine.simulateTopup(amount, selectedPayMethod).then(res => {
        btn.disabled = false;
        btn.textContent = originalText;
        if (res.success) {
            alert(`Deposit sukses! Dana sebesar ${window.formatRupiah(amount)} telah ditambahkan ke akun trading broker Anda.`);
            renderBrokerView();
        } else {
            alert(res.msg);
        }
    });
};

// 10. Forms, Buttons, and Modal listeners
function setupFormListeners() {
    // Auto Trading Switch Bindings
    const switches = document.querySelectorAll('.auto-trading-toggle');
    switches.forEach(sw => {
        sw.onchange = (e) => {
            if (e.target.checked) {
                window.forexTradingEngine.startAutoTrading();
            } else {
                window.forexTradingEngine.stopAutoTrading();
            }
        };
    });

    // Manual Trade buttons
    const buyBtn = document.getElementById('btnBuyManual');
    const sellBtn = document.getElementById('btnSellManual');
    if (buyBtn) {
        buyBtn.onclick = () => {
            window.forexTradingEngine.openPosition('BUY', window.forexChartEngine.currentPrice);
        };
    }
    if (sellBtn) {
        sellBtn.onclick = () => {
            window.forexTradingEngine.openPosition('SELL', window.forexChartEngine.currentPrice);
        };
    }

    // Dashboard HUD Close active positions button
    const btnDashCloseAll = document.getElementById('btnDashCloseAll');
    if (btnDashCloseAll) {
        btnDashCloseAll.onclick = () => {
            const currentPair = window.forexTradingEngine.currentPair;
            const positionsToClose = window.forexTradingEngine.positions.filter(p => p.pair === currentPair);
            if (positionsToClose.length === 0) return;
            
            if (confirm(`Apakah Anda yakin ingin menutup semua posisi aktif untuk ${currentPair}?`)) {
                for (let i = window.forexTradingEngine.positions.length - 1; i >= 0; i--) {
                    const pos = window.forexTradingEngine.positions[i];
                    if (pos.pair === currentPair) {
                        window.forexTradingEngine.closePosition(pos.id, window.forexChartEngine.currentPrice, "Ditutup cepat dari HUD Dashboard.");
                    }
                }
            }
        };
    }

    // Reset Assets prices and active pair to default
    const btnResetAssets = document.getElementById('btnResetAssets');
    if (btnResetAssets) {
        btnResetAssets.onclick = () => {
            if (confirm("Apakah Anda yakin ingin mengatur ulang semua harga instrumen dan kembali ke EUR/USD?")) {
                const configs = window.ASSET_CONFIGS;
                if (configs) {
                    Object.entries(configs).forEach(([symbol, cfg]) => {
                        cfg.mockPrice = cfg.startPrice;
                    });
                }
                
                // Switch back to EUR/USD
                window.activateAssetFromTab('EUR/USD');
                alert("Seluruh instrumen aset telah diatur ulang ke harga awal.");
            }
        };
    }

    // Asset Selector binding & initialization
    const assetSel = document.getElementById('assetSelector');
    const predictAssetLbl = document.getElementById('predictAssetLabel');
    if (assetSel) {
        // Sync with loaded state
        const loadedPair = window.forexTradingEngine.currentPair || 'EUR/USD';
        assetSel.value = loadedPair;
        
        // Initialize chart with loaded pair
        window.forexChartEngine.pair = loadedPair;
        
        // Update labels
        if (buyBtn) buyBtn.textContent = `BUY (${loadedPair})`;
        if (sellBtn) sellBtn.textContent = `SELL (${loadedPair})`;
        if (predictAssetLbl) predictAssetLbl.textContent = loadedPair;

        assetSel.onchange = (e) => {
            const newPair = e.target.value;
            window.forexTradingEngine.currentPair = newPair;
            window.forexChartEngine.switchPair(newPair);
            
            if (buyBtn) buyBtn.textContent = `BUY (${newPair})`;
            if (sellBtn) sellBtn.textContent = `SELL (${newPair})`;
            if (predictAssetLbl) predictAssetLbl.textContent = newPair;
            
            window.forexTradingEngine.saveState();
            
            // Segera analisa dan buka posisi jika robot menyala
            if (window.forexTradingEngine.isAutoTrading) {
                window.forexTradingEngine.evaluateRobotStrategy(window.forexChartEngine, window.forexNewsEngine, true);
            }
        };
    }

    // Modal elements
    const journalModal = document.getElementById('journalModal');
    const openJournalModalBtn = document.getElementById('btnOpenJournalModal');
    const closeJournalModalBtn = document.getElementById('btnCloseJournalModal');
    
    if (openJournalModalBtn && journalModal) {
        openJournalModalBtn.onclick = () => journalModal.style.display = 'flex';
    }
    if (closeJournalModalBtn && journalModal) {
        closeJournalModalBtn.onclick = () => journalModal.style.display = 'none';
    }

    const journalForm = document.getElementById('journalEntryForm');
    if (journalForm) {
        journalForm.onsubmit = (e) => {
            e.preventDefault();
            const note = document.getElementById('journalNote').value;
            const mood = document.getElementById('journalMood').value;
            
            // Handle targets save too
            const daily = parseFloat(document.getElementById('targetDaily').value);
            const weekly = parseFloat(document.getElementById('targetWeekly').value);
            const loss = parseFloat(document.getElementById('targetLoss').value);
            
            window.forexJournalEngine.setTargets(daily, weekly, -loss);
            window.forexJournalEngine.addJournalEntry(note, mood);

            journalModal.style.display = 'none';
            journalForm.reset();
            renderJournal();
        };
    }

    // Handle resets
    const resetBtn = document.getElementById('btnResetAccount');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (confirm("Apakah Anda yakin ingin mengatur ulang saldo dan riwayat trading?")) {
                window.forexTradingEngine.resetAccount();
            }
        };
    }
}

// 11. Custom logs adding animation
function addNewLogToDOM(log) {
    const logList = document.getElementById('logPanelBody');
    if (!logList) return;

    const div = document.createElement('div');
    div.className = "log-item";
    div.style.opacity = '0';
    div.style.transform = 'translateY(-10px)';
    div.style.transition = 'all 0.3s ease-out';
    
    div.innerHTML = `
        <div class="log-item-header">
            <strong style="color: var(--primary);">${log.action}</strong>
            <span class="log-time">${new Date(log.time).toLocaleTimeString('id-ID')}</span>
        </div>
        <div class="log-reason">${log.reason}</div>
    `;

    logList.insertBefore(div, logList.firstChild);
    
    // Trigger paint
    setTimeout(() => {
        div.style.opacity = '1';
        div.style.transform = 'translateY(0)';
    }, 10);

    if (logList.children.length > 50) {
        logList.lastChild.remove();
    }
}

// 12. Tilt effect on mousemove for 5D floating card aesthetics
function setupTiltEffect() {
    const cards = document.querySelectorAll('.glass-card, .balance-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x coordinate within element
            const y = e.clientY - rect.top;  // y coordinate within element
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Limit degree rotation to a subtle 4 degrees
            const rotateX = ((centerY - y) / centerY) * 4;
            const rotateY = ((x - centerX) / centerX) * 4;

            card.style.transform = `perspective(1000px) translateY(-5px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) translateY(0) rotateX(0) rotateY(0)';
        });
    });
}

// 13. Dynamic Assets selection tab logic (Live Prices, Category Badges & Activation)
window.renderAssetsTab = function() {
    const grid = document.getElementById('assetsGridContainer');
    if (!grid) return;

    const activePair = window.forexTradingEngine.currentPair || 'EUR/USD';
    const configs = window.ASSET_CONFIGS;
    if (!configs) return;

    grid.innerHTML = Object.entries(configs).map(([symbol, cfg]) => {
        const isActive = symbol === activePair;
        let currentVal = cfg.startPrice;
        
        if (isActive && window.forexChartEngine.pair === symbol) {
            currentVal = window.forexChartEngine.currentPrice;
        } else {
            if (!cfg.mockPrice) cfg.mockPrice = cfg.startPrice;
            cfg.mockPrice += (Math.random() - 0.5) * cfg.volatility * 0.4;
            currentVal = cfg.mockPrice;
        }

        const formattedPrice = currentVal.toFixed(cfg.decimals);
        let assetType = 'Mata Uang (Forex)';
        let badgeClass = 'buy';
        
        if (symbol === 'XAU/USD') {
            assetType = 'Komoditas (Emas)';
            badgeClass = 'neutral';
        } else if (symbol.includes('ETH') || symbol.includes('BTC')) {
            assetType = 'Aset Kripto';
            badgeClass = 'sell';
        }

        const volLabel = cfg.volatility > 5 ? 'VIVID' : (cfg.volatility > 0.5 ? 'MODERATE' : 'STABLE');

        // Cari transaksi aktif untuk aset ini
        const assetPositions = window.forexTradingEngine.positions.filter(p => p.pair === symbol);
        const hasPositions = assetPositions.length > 0;
        
        let positionsHTML = '';
        if (hasPositions) {
            const totalPnL = assetPositions.reduce((sum, p) => sum + p.pnl, 0);
            const isProfit = totalPnL >= 0;
            const pnlColor = isProfit ? 'var(--success)' : 'var(--danger)';
            positionsHTML = `
                <div style="margin: 0.5rem 0 0.85rem 0; padding: 0.5rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.65rem;">POSISI AKTIF</div>
                        <div style="font-weight: bold; color: #fff;">${assetPositions.length} Posisi</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: var(--text-muted); font-size: 0.65rem;">FLOATING PNL</div>
                        <div style="font-weight: bold; color: ${pnlColor};">${isProfit ? '+' : ''}${window.formatRupiah(totalPnL)}</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="broker-select-card ${isActive ? 'active' : ''}" style="display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; padding: 1.25rem; min-height: 190px; transition: all 0.3s ease; cursor: default; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <div style="font-family: var(--font-tech); font-size: 1.2rem; font-weight: bold; color: #fff;">${symbol}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">${assetType}</div>
                    </div>
                    <span class="badge-type ${badgeClass}" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;">
                        ${volLabel}
                    </span>
                </div>
                
                <div style="margin-bottom: 0.5rem;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Harga Live</div>
                    <div class="tech-font" style="font-size: 1.4rem; font-weight: bold; color: ${isActive ? 'var(--success)' : 'var(--primary)'}; margin-top: 0.2rem;">
                        ${formattedPrice}
                    </div>
                </div>

                ${positionsHTML}

                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: auto;">
                    ${isActive ? `
                        <button class="btn-primary" style="width: 100%; padding: 0.5rem; background: rgba(0, 255, 135, 0.15); border: 1px solid var(--success); color: var(--success); cursor: default;" disabled>
                            Aset Aktif
                        </button>
                    ` : `
                        <button class="btn-primary" style="width: 100%; padding: 0.5rem;" onclick="activateAssetFromTab('${symbol}')">
                            Aktifkan Trading
                        </button>
                    `}
                    
                    ${hasPositions ? `
                        <button class="btn-close-position" style="width: 100%; padding: 0.45rem; font-size: 0.75rem;" onclick="closeAllPositionsForAsset('${symbol}')">
                            Close Posisi Manual
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
};

window.activateAssetFromTab = function(symbol) {
    window.forexTradingEngine.currentPair = symbol;
    window.forexChartEngine.switchPair(symbol);
    
    const buyBtn = document.getElementById('btnBuyManual');
    const sellBtn = document.getElementById('btnSellManual');
    const predictAssetLbl = document.getElementById('predictAssetLabel');
    const assetSel = document.getElementById('assetSelector');
    
    if (buyBtn) buyBtn.textContent = `BUY (${symbol})`;
    if (sellBtn) sellBtn.textContent = `SELL (${symbol})`;
    if (predictAssetLbl) predictAssetLbl.textContent = symbol;
    if (assetSel) assetSel.value = symbol;

    window.forexTradingEngine.saveState();
    window.forexTradingEngine.notifyState();
    
    if (window.forexTradingEngine.isAutoTrading) {
        window.forexTradingEngine.evaluateRobotStrategy(window.forexChartEngine, window.forexNewsEngine, true);
    }

    window.renderAssetsTab();
};

window.closeAllPositionsForAsset = function(symbol) {
    const positionsToClose = window.forexTradingEngine.positions.filter(p => p.pair === symbol);
    if (positionsToClose.length === 0) return;
    
    if (confirm(`Apakah Anda yakin ingin menutup semua posisi aktif untuk ${symbol}?`)) {
        let closePrice = window.forexChartEngine.currentPrice;
        if (window.forexChartEngine.pair !== symbol) {
            const config = window.ASSET_CONFIGS[symbol];
            closePrice = config ? config.mockPrice || config.startPrice : 1.0;
        }

        for (let i = window.forexTradingEngine.positions.length - 1; i >= 0; i--) {
            const pos = window.forexTradingEngine.positions[i];
            if (pos.pair === symbol) {
                window.forexTradingEngine.closePosition(pos.id, closePrice, "Ditutup manual dari tab Pilihan Aset.");
            }
        }
        window.renderAssetsTab();
    }
};
