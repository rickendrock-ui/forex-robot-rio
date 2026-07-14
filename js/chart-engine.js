// Forex Robot Chart Engine
// Custom Canvas-based Candlestick & Technical Indicators renderer

const ASSET_CONFIGS = {
    'EUR/USD': { startPrice: 1.0925, volatility: 0.0002, decimals: 5, pipScale: 0.0001 },
    'GBP/USD': { startPrice: 1.2750, volatility: 0.0002, decimals: 5, pipScale: 0.0001 },
    'XAU/USD': { startPrice: 2350.50, volatility: 0.8, decimals: 2, pipScale: 0.1 },
    'ETH/USD': { startPrice: 3120.00, volatility: 1.5, decimals: 2, pipScale: 1.0 },
    'BTC/USD': { startPrice: 64250.00, volatility: 35.0, decimals: 2, pipScale: 1.0 }
};
window.ASSET_CONFIGS = ASSET_CONFIGS;

class ForexChartEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.candles = [];
        this.maxCandles = 50;
        this.pair = 'EUR/USD';
        this.currentPrice = 1.0925;
        this.ema20 = [];
        this.rsi = [];
        
        // Settings
        this.paddingLeft = 20;
        this.paddingRight = 60;
        this.paddingTop = 30;
        this.paddingBottom = 40;
        
        // Loop
        this.animationFrameId = null;
    }

    init(canvasId, pairName = 'EUR/USD') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.pair = pairName;

        // Generate base historical data
        this.generateMockHistory();
        
        // Handle resizing
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width * window.devicePixelRatio;
            this.canvas.height = rect.height * window.devicePixelRatio;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            this.draw();
        };
        
        window.addEventListener('resize', resize);
        resize();
        
        // Start animation/redraw loop
        const loop = () => {
            this.draw();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    generateMockHistory() {
        const config = ASSET_CONFIGS[this.pair] || ASSET_CONFIGS['EUR/USD'];
        this.currentPrice = config.startPrice;
        let price = this.currentPrice - (config.volatility * 20); // Start lower
        const now = Date.now();
        
        for (let i = 0; i < this.maxCandles; i++) {
            const open = price;
            const change = (Math.random() - 0.49) * config.volatility * 2;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * config.volatility;
            const low = Math.min(open, close) - Math.random() * config.volatility;
            
            this.candles.push({
                time: new Date(now - (this.maxCandles - i) * 60000),
                open,
                high,
                low,
                close
            });
            price = close;
        }
        this.currentPrice = price;
        this.calculateIndicators();
    }

    tick(change) {
        // Tick current candle
        if (this.candles.length === 0) return;
        
        const lastCandle = this.candles[this.candles.length - 1];
        lastCandle.close += change;
        if (lastCandle.close > lastCandle.high) lastCandle.high = lastCandle.close;
        if (lastCandle.close < lastCandle.low) lastCandle.low = lastCandle.close;
        
        this.currentPrice = lastCandle.close;
        this.calculateIndicators();
    }

    addNewCandle() {
        // Close current candle and start a new one
        const lastCandle = this.candles[this.candles.length - 1];
        const open = lastCandle.close;
        const high = open;
        const low = open;
        const close = open;
        
        this.candles.shift(); // Remove oldest
        this.candles.push({
            time: new Date(),
            open,
            high,
            low,
            close
        });
        this.calculateIndicators();
    }

    calculateIndicators() {
        // Calculate EMA 20
        this.ema20 = [];
        const period = 14;
        let sum = 0;
        
        // Simple starting EMA
        for (let i = 0; i < this.candles.length; i++) {
            if (i < period) {
                sum += this.candles[i].close;
                this.ema20.push(this.candles[i].close); // fallback
            } else {
                const k = 2 / (period + 1);
                const ema = this.candles[i].close * k + this.ema20[i - 1] * (1 - k);
                this.ema20.push(ema);
            }
        }

        // Calculate RSI (14)
        this.rsi = [];
        let gains = 0;
        let losses = 0;
        
        for (let i = 0; i < this.candles.length; i++) {
            if (i === 0) {
                this.rsi.push(50); // initial
                continue;
            }
            const diff = this.candles[i].close - this.candles[i - 1].close;
            let gain = diff > 0 ? diff : 0;
            let loss = diff < 0 ? -diff : 0;

            if (i < 14) {
                gains += gain;
                losses += loss;
                this.rsi.push(50);
            } else if (i === 14) {
                gains = gains / 14;
                losses = losses / 14;
                const rs = gains / (losses || 0.00001);
                this.rsi.push(100 - (100 / (1 + rs)));
            } else {
                gains = (gains * 13 + gain) / 14;
                losses = (losses * 13 + loss) / 14;
                const rs = gains / (losses || 0.00001);
                this.rsi.push(100 - (100 / (1 + rs)));
            }
        }
    }
    switchPair(newPair) {
        this.pair = newPair;
        const config = ASSET_CONFIGS[newPair] || ASSET_CONFIGS['EUR/USD'];
        this.currentPrice = config.startPrice;
        this.candles = [];
        this.generateMockHistory();
        this.draw();
    }

    getVolatility() {
        const config = ASSET_CONFIGS[this.pair] || ASSET_CONFIGS['EUR/USD'];
        return config.volatility;
    }

    getDecimals() {
        const config = ASSET_CONFIGS[this.pair] || ASSET_CONFIGS['EUR/USD'];
        return config.decimals;
    }
    draw() {
        if (!this.ctx || !this.canvas) return;
        
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Deteksi tema broker yang dikaitkan (mirroring)
        const activeBroker = window.brokerEngine ? window.brokerEngine.getActiveBroker() : null;
        const isConnected = activeBroker && activeBroker.connected;
        const brokerId = isConnected ? activeBroker.id : 'demo';
        
        const themes = {
            exness: {
                bg: '#fdfbfa',
                bullish: '#d97706', // Gold Exness (Slate Amber)
                bearish: '#dc2626', // Red
                ema: '#d97706',
                hudLabel: 'EXNESS LIVE FEED'
            },
            mifx: {
                bg: '#f0f5fc',
                bullish: '#0284c7', // Cyan-blue MIFX
                bearish: '#be185d', // Rose
                ema: '#0891b2',
                hudLabel: 'MIFX REAL FEED'
            },
            ajaib: {
                bg: '#f3faf7',
                bullish: '#059669', // Emerald Ajaib
                bearish: '#ea580c', // Orange
                ema: '#10b981',
                hudLabel: 'AJAIB PREMIUM FEED'
            },
            demo: {
                bg: '#ffffff',
                bullish: '#2563eb', // Electric Blue
                bearish: '#db2777', // Rose/Pink
                ema: '#0ea5e9',
                hudLabel: 'DEMO SANDBOX FEED'
            }
        };

        const theme = themes[brokerId] || themes.demo;
        this.ctx.fillStyle = theme.bg;
        this.ctx.fillRect(0, 0, width, height);

        const mainChartHeight = height * 0.65;
        const rsiChartHeight = height * 0.25;
        const rsiTop = height * 0.72;

        this.drawGrid(width, mainChartHeight, rsiTop, rsiChartHeight);
        this.drawMainChart(width, mainChartHeight, theme);
        this.drawRsiChart(width, rsiTop, rsiChartHeight);
        this.drawHUD(width, height, theme);
    }

    drawGrid(width, mainHeight, rsiTop, rsiHeight) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        const stepX = (width - this.paddingLeft - this.paddingRight) / 10;
        for (let i = 0; i <= 10; i++) {
            const x = this.paddingLeft + i * stepX;
            ctx.beginPath();
            ctx.moveTo(x, this.paddingTop);
            ctx.lineTo(x, mainHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, rsiTop);
            ctx.lineTo(x, rsiTop + rsiHeight);
            ctx.stroke();
        }

        // Horizontal grid lines - Main Chart
        const stepY = (mainHeight - this.paddingTop) / 5;
        for (let i = 0; i <= 5; i++) {
            const y = this.paddingTop + i * stepY;
            ctx.beginPath();
            ctx.moveTo(this.paddingLeft, y);
            ctx.lineTo(width - this.paddingRight, y);
            ctx.stroke();
        }

        // Horizontal grid lines - RSI Chart (Overbought 70, Middle 50, Oversold 30)
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
        const rsiLines = [30, 50, 70];
        rsiLines.forEach(val => {
            const y = rsiTop + rsiHeight * (1 - val / 100);
            ctx.beginPath();
            ctx.moveTo(this.paddingLeft, y);
            ctx.lineTo(width - this.paddingRight, y);
            ctx.setLineDash(val !== 50 ? [4, 4] : []);
            ctx.strokeStyle = val !== 50 ? 'rgba(121, 40, 202, 0.12)' : 'rgba(15, 23, 42, 0.04)';
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Labels
            ctx.fillStyle = '#475569';
            ctx.font = '9px Rajdhani';
            ctx.fillText(val, width - this.paddingRight + 5, y + 3);
        });
    }

    drawMainChart(width, mainHeight, theme = { bullish: '#00ff87', bearish: '#ff007f', ema: '#00f2fe', bg: '#070712' }) {
        const ctx = this.ctx;
        const visibleCandlesCount = this.candles.length;
        if (visibleCandlesCount === 0) return;

        // Find min/max prices to scale
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        
        for (let i = 0; i < visibleCandlesCount; i++) {
            const c = this.candles[i];
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
        }

        // Add 5% padding to price range
        const priceDiff = maxPrice - minPrice || 0.0001;
        minPrice -= priceDiff * 0.08;
        maxPrice += priceDiff * 0.08;

        const getX = (index) => {
            const chartWidth = width - this.paddingLeft - this.paddingRight;
            return this.paddingLeft + (index / (this.maxCandles - 1)) * chartWidth;
        };

        const getY = (price) => {
            const chartHeight = mainHeight - this.paddingTop;
            return mainHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
        };

        // Draw candles
        const candleWidth = (width - this.paddingLeft - this.paddingRight) / this.maxCandles * 0.65;
        
        for (let i = 0; i < visibleCandlesCount; i++) {
            const c = this.candles[i];
            const x = getX(i);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const isBullish = c.close >= c.open;

            // Wick
            ctx.strokeStyle = isBullish ? theme.bullish : theme.bearish;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            // Body
            ctx.fillStyle = isBullish ? theme.bullish : theme.bearish;
            const top = Math.min(yOpen, yClose);
            const height = Math.max(Math.abs(yOpen - yClose), 1.5);
            
            // Neon Glow on hover/active tick
            if (i === visibleCandlesCount - 1) {
                ctx.save();
                ctx.shadowBlur = 12;
                ctx.shadowColor = isBullish ? theme.bullish : theme.bearish;
            }
            
            ctx.fillRect(x - candleWidth / 2, top, candleWidth, height);
            
            if (i === visibleCandlesCount - 1) {
                ctx.restore();
            }
        }

        // Draw EMA 20 Line (Themed Glow)
        ctx.strokeStyle = theme.ema;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < visibleCandlesCount; i++) {
            if (this.ema20[i]) {
                const x = getX(i);
                const y = getY(this.ema20[i]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = theme.ema;
        ctx.stroke();
        ctx.restore();

        // Draw Y Axis Labels (Prices)
        ctx.fillStyle = '#475569';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'left';
        
        const priceTicksCount = 5;
        for (let i = 0; i <= priceTicksCount; i++) {
            const priceVal = minPrice + (i / priceTicksCount) * (maxPrice - minPrice);
            const y = getY(priceVal);
            ctx.fillText(priceVal.toFixed(this.getDecimals()), width - this.paddingRight + 5, y + 3);
        }

        // Draw Current Price Horizontal Line & Tag
        const currentY = getY(this.currentPrice);
        const lastCandle = this.candles[this.candles.length - 1];
        const color = lastCandle.close >= lastCandle.open ? theme.bullish : theme.bearish;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(this.paddingLeft, currentY);
        ctx.lineTo(width - this.paddingRight, currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Current Price Label Badge
        ctx.fillStyle = color;
        ctx.fillRect(width - this.paddingRight, currentY - 8, this.paddingRight, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Rajdhani';
        ctx.fillText(this.currentPrice.toFixed(this.getDecimals()), width - this.paddingRight + 4, currentY + 4);
    }

    drawRsiChart(width, rsiTop, rsiHeight) {
        const ctx = this.ctx;
        const visibleCount = this.candles.length;
        if (visibleCount === 0) return;

        const getX = (index) => {
            const chartWidth = width - this.paddingLeft - this.paddingRight;
            return this.paddingLeft + (index / (this.maxCandles - 1)) * chartWidth;
        };

        const getRsiY = (rsiVal) => {
            return rsiTop + rsiHeight * (1 - rsiVal / 100);
        };

        // Draw RSI line (Neon Purple Glow)
        ctx.strokeStyle = '#d800ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < visibleCount; i++) {
            if (this.rsi[i] !== undefined) {
                const x = getX(i);
                const y = getRsiY(this.rsi[i]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(216,0,255,0.4)';
        ctx.stroke();
        ctx.restore();

        // Label indicator
        ctx.fillStyle = '#7928ca';
        ctx.font = '10px Outfit';
        ctx.fillText(`RSI (14): ${this.rsi[this.rsi.length - 1]?.toFixed(2) || '50.00'}`, this.paddingLeft + 5, rsiTop - 6);
    }

    drawHUD(width, height, theme = { ema: '#00f2fe', hudLabel: 'DEMO SANDBOX FEED' }) {
        // Draw HUD details: Pair Name, timeframe, etc.
        const ctx = this.ctx;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px Rajdhani';
        ctx.fillText(`${this.pair} • ${theme.hudLabel}`, this.paddingLeft, this.paddingTop - 12);
        
        ctx.fillStyle = theme.ema;
        ctx.font = '11px Outfit';
        ctx.fillText(`EMA(20): ${this.ema20[this.ema20.length - 1]?.toFixed(this.getDecimals()) || '0.00000'}`, this.paddingLeft + 220, this.paddingTop - 12);
    }
}

// Export engine instance to global scope
window.forexChartEngine = new ForexChartEngine();
