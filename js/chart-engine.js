// Forex Robot Chart Engine
// Custom Canvas-based Candlestick & Technical Indicators renderer

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
        let price = this.currentPrice - 0.0050; // Start slightly lower
        const now = Date.now();
        
        for (let i = 0; i < this.maxCandles; i++) {
            const open = price;
            const change = (Math.random() - 0.49) * 0.0004;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 0.0002;
            const low = Math.min(open, close) - Math.random() * 0.0002;
            
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

    draw() {
        if (!this.ctx || !this.canvas) return;
        
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear screen with neon space vibe
        this.ctx.fillStyle = '#070712';
        this.ctx.fillRect(0, 0, width, height);

        // Subdivide height: 70% main chart, 30% RSI pane
        const mainChartHeight = height * 0.65;
        const rsiChartHeight = height * 0.25;
        const rsiTop = height * 0.72;

        this.drawGrid(width, mainChartHeight, rsiTop, rsiChartHeight);
        this.drawMainChart(width, mainChartHeight);
        this.drawRsiChart(width, rsiTop, rsiChartHeight);
        this.drawHUD(width, height);
    }

    drawGrid(width, mainHeight, rsiTop, rsiHeight) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        const rsiLines = [30, 50, 70];
        rsiLines.forEach(val => {
            const y = rsiTop + rsiHeight * (1 - val / 100);
            ctx.beginPath();
            ctx.moveTo(this.paddingLeft, y);
            ctx.lineTo(width - this.paddingRight, y);
            ctx.setLineDash(val !== 50 ? [4, 4] : []);
            ctx.strokeStyle = val !== 50 ? 'rgba(216, 0, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Labels
            ctx.fillStyle = '#8c9bb4';
            ctx.font = '9px Rajdhani';
            ctx.fillText(val, width - this.paddingRight + 5, y + 3);
        });
    }

    drawMainChart(width, mainHeight) {
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
            ctx.strokeStyle = isBullish ? '#00ff87' : '#ff007f';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            // Body
            ctx.fillStyle = isBullish ? '#00ff87' : '#ff007f';
            const top = Math.min(yOpen, yClose);
            const height = Math.max(Math.abs(yOpen - yClose), 1.5);
            
            // Neon Glow on hover/active tick
            if (i === visibleCandlesCount - 1) {
                ctx.save();
                ctx.shadowBlur = 12;
                ctx.shadowColor = isBullish ? 'rgba(0,255,135,0.7)' : 'rgba(255,0,127,0.7)';
            }
            
            ctx.fillRect(x - candleWidth / 2, top, candleWidth, height);
            
            if (i === visibleCandlesCount - 1) {
                ctx.restore();
            }
        }

        // Draw EMA 20 Line (Neon Blue Glow)
        ctx.strokeStyle = '#00f2fe';
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
        ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
        ctx.stroke();
        ctx.restore();

        // Draw Y Axis Labels (Prices)
        ctx.fillStyle = '#8c9bb4';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'left';
        
        const priceTicksCount = 5;
        for (let i = 0; i <= priceTicksCount; i++) {
            const priceVal = minPrice + (i / priceTicksCount) * (maxPrice - minPrice);
            const y = getY(priceVal);
            ctx.fillText(priceVal.toFixed(5), width - this.paddingRight + 5, y + 3);
        }

        // Draw Current Price Horizontal Line & Tag
        const currentY = getY(this.currentPrice);
        const lastCandle = this.candles[this.candles.length - 1];
        const color = lastCandle.close >= lastCandle.open ? '#00ff87' : '#ff007f';
        
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
        ctx.fillStyle = '#070712';
        ctx.font = 'bold 10px Rajdhani';
        ctx.fillText(this.currentPrice.toFixed(5), width - this.paddingRight + 4, currentY + 4);
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
        ctx.fillStyle = '#d800ff';
        ctx.font = '10px Outfit';
        ctx.fillText(`RSI (14): ${this.rsi[this.rsi.length - 1]?.toFixed(2) || '50.00'}`, this.paddingLeft + 5, rsiTop - 6);
    }

    drawHUD(width, height) {
        // Draw HUD details: Pair Name, timeframe, etc.
        const ctx = this.ctx;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Rajdhani';
        ctx.fillText(`${this.pair} • Live 1m Candle`, this.paddingLeft, this.paddingTop - 12);
        
        ctx.fillStyle = '#00f2fe';
        ctx.font = '11px Outfit';
        ctx.fillText(`EMA(20): ${this.ema20[this.ema20.length - 1]?.toFixed(5) || '0.00000'}`, this.paddingLeft + 160, this.paddingTop - 12);
    }
}

// Export engine instance to global scope
window.forexChartEngine = new ForexChartEngine();
