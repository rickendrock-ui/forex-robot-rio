// Automated & Manual Trading Engine (Forex Robot)

class ForexTradingEngine {
    constructor() {
        this.isAutoTrading = false;
        this.currentPair = 'EUR/USD';
        
        // Balances
        this.initialBalance = 150000000.00;
        this.balance = 150000000.00; // current realized balance (closed trades)
        this.realtimeBalance = 150000000.00; // balance including floating PnL
        this.finalBalance = 150000000.00; // balance after stopping trading
        
        // Positions
        this.positions = [];
        this.tradeHistory = [];
        this.tradeLogs = [];
        
        // Strategy settings
        this.riskPercent = 1.0; // Risk 1% per trade
        this.pipValue = 150000; // IDR per pip on a standard lot (approx $10 * 15,000)
        this.contractSize = 100000; // 1 standard lot = 100,000 units
        
        // Listeners
        this.onStateChangeCallbacks = [];
        this.onLogCallbacks = [];

        // Load data from LocalStorage if exists
        this.loadState();
    }

    startAutoTrading() {
        this.isAutoTrading = true;
        this.addLog("Auto Trading DIAKTIFKAN", "Robot mulai memantau indikator teknikal dan berita fundamental untuk eksekusi otomatis.");
        this.saveState();
        this.notifyState();
        
        // Segera analisa dan buka posisi saat robot dinyalakan
        setTimeout(() => {
            this.evaluateRobotStrategy(window.forexChartEngine, window.forexNewsEngine, true);
        }, 100);
    }

    stopAutoTrading() {
        this.isAutoTrading = false;
        const formattedBal = window.formatRupiah ? window.formatRupiah(this.finalBalance) : 'Rp ' + this.finalBalance.toLocaleString('id-ID');
        this.addLog("Auto Trading DINAKTIFKAN", `Robot berhenti mendeteksi sinyal. Saldo akhir terkunci pada ${formattedBal}.`);
        this.saveState();
        this.notifyState();
    }

    resetAccount() {
        const activeBroker = window.brokerEngine ? window.brokerEngine.getActiveBroker() : null;
        const connectedBroker = activeBroker && activeBroker.connected ? activeBroker : null;
        
        if (connectedBroker && window.brokerEngine.brokerBalances[connectedBroker.id]) {
            const data = window.brokerEngine.brokerBalances[connectedBroker.id];
            this.initialBalance = data.initialBalance;
            this.balance = data.balance;
            this.realtimeBalance = data.realtimeBalance;
            this.finalBalance = data.finalBalance;
            this.positions = [];
            this.tradeHistory = [...data.tradeHistory];
            this.tradeLogs = [...data.tradeLogs];
            this.addLog("Akun Broker Sinkron", `Data akun rill broker ${connectedBroker.name} telah disinkronkan ulang.`);
        } else {
            this.initialBalance = 150000000.00;
            this.balance = 150000000.00;
            this.realtimeBalance = 150000000.00;
            this.finalBalance = 150000000.00;
            this.positions = [];
            this.tradeHistory = [];
            this.tradeLogs = [];
            this.addLog("Akun Direset", "Semua riwayat perdagangan dan saldo telah diatur ulang ke kondisi awal (Rp150.000.000).");
        }
        this.saveState();
        this.notifyState();
    }

    subscribeStateChange(cb) {
        this.onStateChangeCallbacks.push(cb);
    }

    subscribeLogs(cb) {
        this.onLogCallbacks.push(cb);
    }

    notifyState() {
        this.onStateChangeCallbacks.forEach(cb => cb({
            isAutoTrading: this.isAutoTrading,
            initialBalance: this.initialBalance,
            balance: this.balance,
            realtimeBalance: this.realtimeBalance,
            finalBalance: this.finalBalance,
            positions: this.positions,
            tradeHistory: this.tradeHistory,
            tradeLogs: this.tradeLogs
        }));
    }

    addLog(action, reason) {
        const log = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            time: new Date(),
            action,
            reason
        };
        this.tradeLogs.unshift(log);
        if (this.tradeLogs.length > 50) this.tradeLogs.pop();
        
        this.onLogCallbacks.forEach(cb => cb(log));
        this.notifyState();
    }

    // Core Loop: updates floating profits and checks SL/TP
    update(currentPrice) {
        let floatingPnL = 0;
        
        // Loop backwards to allow safely removing closed positions
        for (let i = this.positions.length - 1; i >= 0; i--) {
            const pos = this.positions[i];
            const config = window.ASSET_CONFIGS ? (window.ASSET_CONFIGS[pos.pair] || window.ASSET_CONFIGS['EUR/USD']) : { pipScale: 0.0001 };
            const scale = config.pipScale;
            let pipDiff = 0;
            if (pos.type === 'BUY') {
                pipDiff = (currentPrice - pos.entryPrice) / scale;
            } else {
                pipDiff = (pos.entryPrice - currentPrice) / scale;
            }

            // PnL in IDR = Selisih Pip * Lot size * Nilai Pip per Lot
            // Nilai Pip per Lot = 150.000 (atau sesuai setelan pipValue)
            pos.pnl = parseFloat((pipDiff * pos.size * this.pipValue).toFixed(2));
            floatingPnL += pos.pnl;

            // Check Stop Loss & Take Profit
            let exitReason = null;
            if (pos.type === 'BUY') {
                if (currentPrice <= pos.sl) exitReason = "STOP LOSS DIKENAI";
                else if (currentPrice >= pos.tp) exitReason = "TAKE PROFIT DIKENAI";
            } else {
                if (currentPrice >= pos.sl) exitReason = "STOP LOSS DIKENAI";
                else if (currentPrice <= pos.tp) exitReason = "TAKE PROFIT DIKENAI";
            }

            if (exitReason) {
                this.closePosition(pos.id, currentPrice, `${exitReason}. Harga menyentuh batas aman.`);
            }
        }

        this.realtimeBalance = parseFloat((this.balance + floatingPnL).toFixed(2));
        this.notifyState();
    }

    // Opens a trade manually or automatically
    openPosition(type, price, reason = "Eksekusi manual oleh trader.") {
        // Limit max open positions to 3
        if (this.positions.length >= 3) {
            if (!this.isAutoTrading) {
                alert("Maksimum 3 posisi terbuka secara bersamaan untuk manajemen risiko.");
            }
            return;
        }

        // Calculate Position Sizing (Risk Management)
        // Standard formula: Size = (Balance * Risk%) / (SL in pips * pip value)
        const config = window.ASSET_CONFIGS ? (window.ASSET_CONFIGS[this.currentPair] || window.ASSET_CONFIGS['EUR/USD']) : { pipScale: 0.0001, decimals: 5 };
        const scale = config.pipScale;
        const isScalp = reason.includes("[Scalping HFT]");
        
        const balanceToRisk = this.balance * (this.riskPercent / 100);
        const slPips = isScalp ? 10 : 20; // 10 pips untuk scalping otomatis, 20 untuk manual
        const tpPips = isScalp ? 30 : 50; // 30 pips target untuk scalping, 50 untuk manual
        
        const lotSize = parseFloat((balanceToRisk / (slPips * this.pipValue)).toFixed(2)) || 0.1;

        let slPrice, tpPrice;
        if (type === 'BUY') {
            slPrice = price - (slPips * scale);
            tpPrice = price + (tpPips * scale);
        } else {
            slPrice = price + (slPips * scale);
            tpPrice = price - (tpPips * scale);
        }

        const position = {
            id: 'pos_' + Date.now() + Math.floor(Math.random()*100),
            pair: this.currentPair,
            type,
            entryPrice: price,
            size: lotSize,
            sl: parseFloat(slPrice.toFixed(config.decimals)),
            tp: parseFloat(tpPrice.toFixed(config.decimals)),
            pnl: 0.00,
            openTime: new Date(),
            reason
        };

        this.positions.push(position);
        this.addLog(`OPEN POSISI ${type} (${this.currentPair} Lot: ${lotSize})`, reason);
        this.saveState();
        this.notifyState();
    }

    // Closes a position by ID
    closePosition(id, currentPrice, reason = "Ditutup secara manual.") {
        const index = this.positions.findIndex(p => p.id === id);
        if (index === -1) return;

        const pos = this.positions[index];
        
        // Final PnL calculation
        const config = window.ASSET_CONFIGS ? (window.ASSET_CONFIGS[pos.pair] || window.ASSET_CONFIGS['EUR/USD']) : { pipScale: 0.0001 };
        const scale = config.pipScale;
        let pipDiff = 0;
        if (pos.type === 'BUY') {
            pipDiff = (currentPrice - pos.entryPrice) / scale;
        } else {
            pipDiff = (pos.entryPrice - currentPrice) / scale;
        }
        const finalPnL = parseFloat((pipDiff * pos.size * this.pipValue).toFixed(2));
        
        // Update realized balance
        this.balance = parseFloat((this.balance + finalPnL).toFixed(2));
        
        // Move to history
        const historicalTrade = {
            ...pos,
            closePrice: currentPrice,
            closeTime: new Date(),
            pnl: finalPnL,
            exitReason: reason
        };

        this.tradeHistory.push(historicalTrade);
        this.positions.splice(index, 1);
        
        const formattedPnL = window.formatRupiah ? window.formatRupiah(finalPnL) : 'Rp ' + finalPnL.toLocaleString('id-ID');
        this.addLog(`CLOSE POSISI ${pos.type}`, `${reason} Hasil: ${finalPnL >= 0 ? '+' : ''}${formattedPnL}`);
        this.saveState();
        this.notifyState();
    }

    // Run Strategy evaluations (Logic for the Auto-trading robot)
    evaluateRobotStrategy(chartEngine, newsEngine, forceImmediate = false) {
        if (!this.isAutoTrading) return;

        // Jangan buka posisi jika sudah mencapai batas maksimum (3)
        if (this.positions.length >= 3) return;

        // Pastikan ada data chart yang cukup
        const candles = chartEngine.candles;
        if (candles.length < 20) return;

        // Mengambil indikator teknikal & fundamental terkini
        const rsiVal = chartEngine.rsi[chartEngine.rsi.length - 1] || 50;
        const emaVal = chartEngine.ema20[chartEngine.ema20.length - 1] || chartEngine.currentPrice;
        const currentPrice = chartEngine.currentPrice;
        const sentimentVal = newsEngine.currentSentiment;

        // Algoritma Formula Scalping Berakurasi Tinggi:
        // Hitung Skor Sentimen dan Tren (-5 hingga +5)
        let buyScore = 0;
        
        // 1. Teknikal: Posisi harga terhadap EMA 20
        if (currentPrice > emaVal) buyScore += 2.0; // Harga di atas EMA 20 (Bullish Momentum)
        else buyScore -= 2.0; // Harga di bawah EMA 20 (Bearish Momentum)

        // 2. Teknikal: RSI Pullback / Rebound
        if (rsiVal < 45) buyScore += 1.5; // Kondisi oversold/aman untuk beli (Bullish)
        else if (rsiVal > 55) buyScore -= 1.5; // Kondisi overbought/risiko untuk jual (Bearish)

        // 3. Fundamental: Sentimen Berita Makro
        if (sentimentVal > 15) buyScore += 1.5; // Sentimen fundamental positif
        else if (sentimentVal < -15) buyScore -= 1.5; // Sentimen fundamental negatif

        // Ambil keputusan eksekusi:
        // Jika forceImmediate = true (baru dinyalakan), langsung ambil sisi dominan.
        // Jika normal, tunggu sinyal yang sangat kuat (Skor >= 2.5 untuk BUY, Skor <= -2.5 untuk SELL).
        let signal = 'NEUTRAL';
        if (forceImmediate) {
            signal = buyScore >= 0 ? 'BUY' : 'SELL';
        } else {
            if (buyScore >= 2.5) signal = 'BUY';
            else if (buyScore <= -2.5) signal = 'SELL';
        }

        const decimals = chartEngine.getDecimals();
        if (signal === 'BUY') {
            const reason = `[Scalping HFT] Sinyal Beli Akurat (Skor: ${buyScore.toFixed(1)}). Harga (${currentPrice.toFixed(decimals)}) di atas EMA20, RSI (${rsiVal.toFixed(1)}) aman, Sentimen (${sentimentVal}%).`;
            this.openPosition('BUY', currentPrice, reason);
        } else if (signal === 'SELL') {
            const reason = `[Scalping HFT] Sinyal Jual Akurat (Skor: ${buyScore.toFixed(1)}). Harga (${currentPrice.toFixed(decimals)}) di bawah EMA20, RSI (${rsiVal.toFixed(1)}) aman, Sentimen (${sentimentVal}%).`;
            this.openPosition('SELL', currentPrice, reason);
        }
    }

    // Persistence
    saveState() {
        const state = {
            initialBalance: this.initialBalance,
            balance: this.balance,
            realtimeBalance: this.realtimeBalance,
            finalBalance: this.finalBalance,
            positions: this.positions,
            tradeHistory: this.tradeHistory,
            tradeLogs: this.tradeLogs,
            currentPair: this.currentPair
        };
        localStorage.setItem('forex_robot_state', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('forex_robot_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.initialBalance = state.initialBalance ?? 150000000.00;
                this.balance = state.balance ?? 150000000.00;
                this.realtimeBalance = state.realtimeBalance ?? 150000000.00;
                this.finalBalance = state.finalBalance ?? 150000000.00;
                this.currentPair = state.currentPair ?? 'EUR/USD';
                this.positions = state.positions ?? [];
                
                // Parse date strings back to Date objects
                this.tradeHistory = (state.tradeHistory ?? []).map(t => ({
                    ...t,
                    openTime: new Date(t.openTime),
                    closeTime: new Date(t.closeTime)
                }));
                this.tradeLogs = (state.tradeLogs ?? []).map(l => ({
                    ...l,
                    time: new Date(l.time)
                }));
            } catch (e) {
                console.error("Failed to load trading state", e);
            }
        }
    }
}

// Export engine instance to global scope
window.forexTradingEngine = new ForexTradingEngine();
