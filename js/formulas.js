// Advanced Trading Formulas and Calculator Functions

const TradingFormulas = {
    // 1. Position Sizing
    // Formula: Lot Size = (Balance * Risk%) / (Stop Loss in Pips * Pip Value)
    // Risk amount = Balance * (Risk% / 100)
    calculatePositionSize: (balance, riskPercent, stopLossPips, currency = 'EUR/USD') => {
        const riskAmount = balance * (riskPercent / 100);
        // For EUR/USD: 1 Standard Lot has pip value of $10
        const pipValueStandardLot = 10.0;
        const lots = riskAmount / (stopLossPips * pipValueStandardLot);
        return {
            riskAmount: parseFloat(riskAmount.toFixed(2)),
            lots: parseFloat(lots.toFixed(2))
        };
    },

    // 2. Kelly Criterion
    // Formula: K% = W - ( (1 - W) / R )
    // W = Win Rate (probability of win: 0 to 1)
    // R = Win/Loss Ratio (average gain / average loss)
    calculateKelly: (winRatePercent, winLossRatio) => {
        const w = winRatePercent / 100;
        const r = winLossRatio;
        if (r <= 0) return 0;
        
        const kellyFraction = w - ((1 - w) / r);
        const kellyPercent = kellyFraction * 100;
        
        return parseFloat(Math.max(0, kellyPercent).toFixed(2)); // return capped at 0 (don't bet if negative expectation)
    },

    // 3. Fibonacci Retracement Levels
    // Levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%
    calculateFibonacci: (high, low, trend = 'Uptrend') => {
        const diff = high - low;
        const levels = {};
        
        if (trend === 'Uptrend') {
            levels['0%'] = high;
            levels['23.6%'] = high - (diff * 0.236);
            levels['38.2%'] = high - (diff * 0.382);
            levels['50.0%'] = high - (diff * 0.500);
            levels['61.8%'] = high - (diff * 0.618);
            levels['78.6%'] = high - (diff * 0.786);
            levels['100%'] = low;
        } else {
            levels['0%'] = low;
            levels['23.6%'] = low + (diff * 0.236);
            levels['38.2%'] = low + (diff * 0.382);
            levels['50.0%'] = low + (diff * 0.500);
            levels['61.8%'] = low + (diff * 0.618);
            levels['78.6%'] = low + (diff * 0.786);
            levels['100%'] = high;
        }

        // Format all levels
        for (let key in levels) {
            levels[key] = parseFloat(levels[key].toFixed(5));
        }

        return levels;
    },

    // 4. Standard Pivot Points
    // Pivot (P) = (High + Low + Close) / 3
    // Resistance 1 (R1) = (2 * P) - Low
    // Support 1 (S1) = (2 * P) - High
    // Resistance 2 (R2) = P + (High - Low)
    // Support 2 (S2) = P - (High - Low)
    // Resistance 3 (R3) = High + 2 * (P - Low)
    // Support 3 (S3) = Low - 2 * (High - P)
    calculatePivotPoints: (high, low, close) => {
        const p = (high + low + close) / 3;
        const r1 = (2 * p) - low;
        const s1 = (2 * p) - high;
        const r2 = p + (high - low);
        const s2 = p - (high - low);
        const r3 = high + 2 * (p - low);
        const s3 = low - 2 * (high - p);

        return {
            p: parseFloat(p.toFixed(5)),
            r1: parseFloat(r1.toFixed(5)),
            s1: parseFloat(s1.toFixed(5)),
            r2: parseFloat(r2.toFixed(5)),
            s2: parseFloat(s2.toFixed(5)),
            r3: parseFloat(r3.toFixed(5)),
            s3: parseFloat(s3.toFixed(5))
        };
    }
};

window.TradingFormulas = TradingFormulas;
