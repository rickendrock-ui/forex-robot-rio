// Automated & Manual Trading Engine (Forex Robot)

class ForexTradingEngine {
    constructor() {
        this.isAutoTrading = false;
        
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
    }

    stopAutoTrading() {
        this.isAutoTrading = false;
        const formattedBal = window.formatRupiah ? window.formatRupiah(this.finalBalance) : 'Rp ' + this.finalBalance.toLocaleString('id-ID');
        this.addLog("Auto Trading DINAKTIFKAN", `Robot berhenti mendeteksi sinyal. Saldo akhir terkunci pada ${formattedBal}.`);
        this.saveState();
        this.notifyState();
    }

    resetAccount() {
        this.initialBalance = 150000000.00;
        this.balance = 150000000.00;
        this.realtimeBalance = 150000000.00;
        this.finalBalance = 150000000.00;
        this.positions = [];
        this.tradeHistory = [];
        this.tradeLogs = [];
        this.addLog("Akun Direset", "Semua riwayat perdagangan dan saldo telah diatur ulang ke kondisi awal (Rp150.000.000).");
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
            
            // Calculate Profit/Loss in Pips
            let pipDiff = 0;
            if (pos.type === 'BUY') {
                pipDiff = (currentPrice - pos.entryPrice) * 10000; // 4 decimals = 1 pip
            } else {
                pipDiff = (pos.entryPrice - currentPrice) * 10000;
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
        // Risk: 1% of Rp150M = Rp1.5M. SL = 30 pips. Size = 1,500,000 / (30 * 150,000) = 0.33 Lots.
        const balanceToRisk = this.balance * (this.riskPercent / 100);
        const slPips = 30; // 30 pips safe distance
        const tpPips = 60; // 1:2 Risk-Reward
        
        const lotSize = parseFloat((balanceToRisk / (slPips * this.pipValue)).toFixed(2)) || 0.1;

        let slPrice, tpPrice;
        if (type === 'BUY') {
            slPrice = price - (slPips * 0.0001);
            tpPrice = price + (tpPips * 0.0001);
        } else {
            slPrice = price + (slPips * 0.0001);
            tpPrice = price - (tpPips * 0.0001);
        }

        const position = {
            id: 'pos_' + Date.now() + Math.floor(Math.random()*100),
            pair: 'EUR/USD',
            type,
            entryPrice: price,
            size: lotSize,
            sl: parseFloat(slPrice.toFixed(5)),
            tp: parseFloat(tpPrice.toFixed(5)),
            pnl: 0.00,
            openTime: new Date(),
            reason
        };

        this.positions.push(position);
        this.addLog(`OPEN POSISI ${type} (Lot: ${lotSize})`, reason);
        this.saveState();
        this.notifyState();
    }

    // Closes a position by ID
    closePosition(id, currentPrice, reason = "Ditutup secara manual.") {
        const index = this.positions.findIndex(p => p.id === id);
        if (index === -1) return;

        const pos = this.positions[index];
        
        // Final PnL calculation
        let pipDiff = 0;
        if (pos.type === 'BUY') {
            pipDiff = (currentPrice - pos.entryPrice) * 10000;
        } else {
            pipDiff = (pos.entryPrice - currentPrice) * 10000;
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
    evaluateRobotStrategy(chartEngine, newsEngine) {
        if (!this.isAutoTrading) return;

        // Ensure we don't spam trades: wait at least 30 seconds between trades
        const lastLog = this.tradeLogs[0];
        if (lastLog && (Date.now() - new Date(lastLog.time).getTime() < 30000)) {
            return; 
        }

        // Get technical data
        const candles = chartEngine.candles;
        if (candles.length < 20) return;

        const lastCandle = candles[candles.length - 1];
        const rsiVal = chartEngine.rsi[chartEngine.rsi.length - 1];
        const emaVal = chartEngine.ema20[chartEngine.ema20.length - 1];
        const currentPrice = chartEngine.currentPrice;

        // Technical Signals
        let techSignal = 'NEUTRAL';
        if (rsiVal < 35 && currentPrice > emaVal) {
            techSignal = 'BULLISH'; // Oversold + price reclaiming EMA20
        } else if (rsiVal > 65 && currentPrice < emaVal) {
            techSignal = 'BEARISH'; // Overbought + price dropping below EMA20
        }

        // Fundamental Signals
        const sentimentVal = newsEngine.currentSentiment;
        let fundSignal = 'NEUTRAL';
        if (sentimentVal > 30) {
            fundSignal = 'BULLISH';
        } else if (sentimentVal < -30) {
            fundSignal = 'BEARISH';
        }

        // Match Logic
        if (techSignal === 'BULLISH' && fundSignal === 'BULLISH') {
            const reason = `Teknikal (RSI=${rsiVal.toFixed(1)} oversold, Harga > EMA20) selaras dengan Fundamental Sentimen (${newsEngine.getSentimentLabel()}: ${sentimentVal}%).`;
            this.openPosition('BUY', currentPrice, reason);
        } else if (techSignal === 'BEARISH' && fundSignal === 'BEARISH') {
            const reason = `Teknikal (RSI=${rsiVal.toFixed(1)} overbought, Harga < EMA20) selaras dengan Fundamental Sentimen (${newsEngine.getSentimentLabel()}: ${sentimentVal}%).`;
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
            tradeLogs: this.tradeLogs
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
