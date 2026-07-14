// Forex Trading Journal, Calendar, and Targets Manager

class ForexJournalEngine {
    constructor() {
        this.targets = {
            dailyProfit: 3000000.00,
            weeklyProfit: 15000000.00,
            maxDailyLoss: -2250000.00
        };

        this.manualEntries = [];
        
        // Static Calendar of important upcoming news events (Economic Calendar)
        this.calendarEvents = [
            { id: 1, date: "15", month: "JUL", time: "19:30", currency: "USD", title: "Core Retail Sales (MoM)", impact: "HIGH", forecast: "0.2%", previous: "0.1%" },
            { id: 2, date: "16", month: "JUL", time: "18:45", currency: "EUR", title: "ECB Interest Rate Decision", impact: "HIGH", forecast: "4.25%", previous: "4.25%" },
            { id: 3, date: "16", month: "JUL", time: "19:30", currency: "USD", title: "Unemployment Claims", impact: "MED", forecast: "220K", previous: "223K" },
            { id: 4, date: "17", month: "JUL", time: "07:30", currency: "AUD", title: "Employment Change", impact: "HIGH", forecast: "25.0K", previous: "39.7K" },
            { id: 5, date: "20", month: "JUL", time: "15:00", currency: "GBP", title: "CPI Inflation Rate (YoY)", impact: "HIGH", forecast: "2.1%", previous: "2.0%" }
        ];

        this.loadState();
    }

    setTargets(dailyProfit, weeklyProfit, maxDailyLoss) {
        this.targets.dailyProfit = parseFloat(dailyProfit) || 0;
        this.targets.weeklyProfit = parseFloat(weeklyProfit) || 0;
        this.targets.maxDailyLoss = parseFloat(maxDailyLoss) || 0;
        this.saveState();
    }

    addJournalEntry(note, mood) {
        const entry = {
            id: 'journal_' + Date.now(),
            time: new Date(),
            note,
            mood, // 'POSITIVE', 'NEUTRAL', 'NEGATIVE'
        };
        this.manualEntries.unshift(entry);
        this.saveState();
        return entry;
    }

    deleteJournalEntry(id) {
        this.manualEntries = this.manualEntries.filter(e => e.id !== id);
        this.saveState();
    }

    getStatistics(history) {
        if (history.length === 0) {
            return {
                winRate: 0,
                totalTrades: 0,
                wins: 0,
                losses: 0,
                netProfit: 0,
                avgProfit: 0,
                buyCount: 0,
                sellCount: 0
            };
        }

        let wins = 0;
        let losses = 0;
        let netProfit = 0;
        let buyCount = 0;
        let sellCount = 0;

        history.forEach(trade => {
            netProfit += trade.pnl;
            if (trade.pnl >= 0) wins++;
            else losses++;

            if (trade.type === 'BUY') buyCount++;
            else sellCount++;
        });

        return {
            winRate: Math.round((wins / history.length) * 100),
            totalTrades: history.length,
            wins,
            losses,
            netProfit: parseFloat(netProfit.toFixed(2)),
            avgProfit: parseFloat((netProfit / history.length).toFixed(2)),
            buyCount,
            sellCount
        };
    }

    saveState() {
        const state = {
            targets: this.targets,
            manualEntries: this.manualEntries
        };
        localStorage.setItem('forex_journal_state', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('forex_journal_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.targets = state.targets ?? this.targets;
                this.manualEntries = (state.manualEntries ?? []).map(e => ({
                    ...e,
                    time: new Date(e.time)
                }));
            } catch (e) {
                console.error("Failed to load journal state", e);
            }
        }
    }
}

// Export engine instance to global scope
window.forexJournalEngine = new ForexJournalEngine();
