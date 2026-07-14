// Broker Connection and Top-up Simulation Engine

class BrokerEngine {
    constructor() {
        this.brokers = [
            { id: 'exness', name: 'Exness Group', code: 'exness', connected: false, accountId: '', server: '' },
            { id: 'mifx', name: 'MIFX Indonesia', code: 'mifx', connected: false, accountId: '', server: '' },
            { id: 'ajaib', name: 'Ajaib Prime', code: 'ajaib', connected: false, accountId: '', server: '' }
        ];
        
        // Mock data saldo & riwayat rill akun broker
        this.brokerBalances = {
            exness: {
                initialBalance: 250000000.00,
                balance: 250000000.00,
                realtimeBalance: 250000000.00,
                finalBalance: 250000000.00,
                tradeHistory: [
                    { pair: 'XAU/USD', type: 'BUY', entryPrice: 2345.10, closePrice: 2351.40, size: 0.5, pnl: 4500000.00, openTime: new Date(Date.now() - 3600000), closeTime: new Date(Date.now() - 3300000), exitReason: 'TAKE PROFIT DIKENAI' },
                    { pair: 'EUR/USD', type: 'SELL', entryPrice: 1.0910, closePrice: 1.0902, size: 1.2, pnl: 1440000.00, openTime: new Date(Date.now() - 7200000), closeTime: new Date(Date.now() - 6900000), exitReason: 'CLOSE MANUAL' }
                ],
                tradeLogs: [
                    { action: 'KONEKSI EXNESS', time: new Date(Date.now() - 7200000), reason: 'Sesi akun Exness berhasil diverifikasi.' },
                    { action: 'CLOSE POSISI SELL', time: new Date(Date.now() - 6900000), reason: 'Ditutup manual oleh trader.' },
                    { action: 'CLOSE POSISI BUY', time: new Date(Date.now() - 3300000), reason: 'Take Profit dikenai.' }
                ]
            },
            mifx: {
                initialBalance: 80000000.00,
                balance: 80000000.00,
                realtimeBalance: 80000000.00,
                finalBalance: 80000000.00,
                tradeHistory: [
                    { pair: 'GBP/USD', type: 'BUY', entryPrice: 1.2720, closePrice: 1.2755, size: 0.8, pnl: 4200000.00, openTime: new Date(Date.now() - 5000000), closeTime: new Date(Date.now() - 4700000), exitReason: 'TAKE PROFIT DIKENAI' }
                ],
                tradeLogs: [
                    { action: 'KONEKSI MIFX', time: new Date(Date.now() - 5000000), reason: 'Koneksi API MIFX lokal sukses.' },
                    { action: 'CLOSE POSISI BUY', time: new Date(Date.now() - 4700000), reason: 'Take Profit dikenai.' }
                ]
            },
            ajaib: {
                initialBalance: 450000000.00,
                balance: 450000000.00,
                realtimeBalance: 450000000.00,
                finalBalance: 450000000.00,
                tradeHistory: [
                    { pair: 'BTC/USD', type: 'BUY', entryPrice: 63900.00, closePrice: 64180.00, size: 0.1, pnl: 4200000.00, openTime: new Date(Date.now() - 8600000), closeTime: new Date(Date.now() - 8000000), exitReason: 'CLOSE MANUAL' }
                ],
                tradeLogs: [
                    { action: 'KONEKSI AJAIB', time: new Date(Date.now() - 8600000), reason: 'Akun premium Ajaib terhubung.' },
                    { action: 'CLOSE POSISI BUY', time: new Date(Date.now() - 8000000), reason: 'Ditutup manual oleh trader.' }
                ]
            }
        };

        this.activeBrokerId = 'exness';
        this.isAutoTradingOnBroker = false;

        this.loadState();
    }

    connectBroker(brokerId, accountId, server) {
        const broker = this.brokers.find(b => b.id === brokerId);
        if (!broker) return false;

        broker.connected = true;
        broker.accountId = accountId;
        broker.server = server;
        
        // Sinkronisasi saldo & riwayat ke Trading Engine utama
        if (window.forexTradingEngine && this.brokerBalances[brokerId]) {
            const data = this.brokerBalances[brokerId];
            window.forexTradingEngine.initialBalance = data.initialBalance;
            window.forexTradingEngine.balance = data.balance;
            window.forexTradingEngine.realtimeBalance = data.realtimeBalance;
            window.forexTradingEngine.finalBalance = data.finalBalance;
            window.forexTradingEngine.tradeHistory = [...data.tradeHistory];
            window.forexTradingEngine.tradeLogs = [...data.tradeLogs];
            
            window.forexTradingEngine.addLog(
                `BROKER TERHUBUNG: ${broker.name.toUpperCase()}`, 
                `Saldo rill tersinkron: Rp ${data.balance.toLocaleString('id-ID')}. No Rek: ${accountId}`
            );
            window.forexTradingEngine.saveState();
        }
        
        this.saveState();
        return true;
    }

    disconnectBroker(brokerId) {
        const broker = this.brokers.find(b => b.id === brokerId);
        if (!broker) return;

        broker.connected = false;
        broker.accountId = '';
        broker.server = '';
        this.isAutoTradingOnBroker = false;

        // Kembalikan ke saldo Demo bawaan (Rp150.000.000) saat diputus
        if (window.forexTradingEngine) {
            window.forexTradingEngine.initialBalance = 150000000.00;
            window.forexTradingEngine.balance = 150000000.00;
            window.forexTradingEngine.realtimeBalance = 150000000.00;
            window.forexTradingEngine.finalBalance = 150000000.00;
            window.forexTradingEngine.tradeHistory = [];
            window.forexTradingEngine.tradeLogs = [];
            
            window.forexTradingEngine.addLog(
                "BROKER DIPUTUSKAN", 
                "Tautan akun rill dicabut. Kembali menggunakan akun Demo (Rp150.000.000)."
            );
            window.forexTradingEngine.saveState();
        }

        this.saveState();
    }

    toggleAutoTradingOnBroker(state) {
        const activeBroker = this.getActiveBroker();
        if (!activeBroker || !activeBroker.connected) {
            return { success: false, msg: "Broker harus ditautkan terlebih dahulu sebelum mengaktifkan trading otomatis!" };
        }
        this.isAutoTradingOnBroker = state;
        this.saveState();
        return { success: true };
    }

    getActiveBroker() {
        return this.brokers.find(b => b.id === this.activeBrokerId);
    }

    simulateTopup(amount, paymentMethod) {
        return new Promise((resolve) => {
            // Simulate 2-second delay for API authorization
            setTimeout(() => {
                const activeBroker = this.getActiveBroker();
                if (!activeBroker || !activeBroker.connected) {
                    resolve({ success: false, msg: "Tautkan akun broker sebelum melakukan deposit." });
                    return;
                }

                // Add balance to main trading engine
                if (window.forexTradingEngine) {
                    window.forexTradingEngine.balance = parseFloat((window.forexTradingEngine.balance + amount).toFixed(2));
                    window.forexTradingEngine.realtimeBalance = parseFloat((window.forexTradingEngine.realtimeBalance + amount).toFixed(2));
                    const formattedAmount = window.formatRupiah ? window.formatRupiah(amount) : 'Rp ' + amount.toLocaleString('id-ID');
                    window.forexTradingEngine.addLog(
                        "TOP UP BERHASIL", 
                        `Deposit sebesar ${formattedAmount} ditambahkan ke broker ${activeBroker.name} via ${paymentMethod.toUpperCase()}.`
                    );
                    window.forexTradingEngine.saveState();
                }
                
                resolve({ success: true, amount });
            }, 1800);
        });
    }

    saveState() {
        const state = {
            brokers: this.brokers,
            activeBrokerId: this.activeBrokerId,
            isAutoTradingOnBroker: this.isAutoTradingOnBroker
        };
        localStorage.setItem('forex_broker_state', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('forex_broker_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.brokers = state.brokers ?? this.brokers;
                this.activeBrokerId = state.activeBrokerId ?? 'exness';
                this.isAutoTradingOnBroker = state.isAutoTradingOnBroker ?? false;
            } catch (e) {
                console.error("Failed to load broker state", e);
            }
        }
    }
}

// Export engine instance to global scope
window.brokerEngine = new BrokerEngine();
