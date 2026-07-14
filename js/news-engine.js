// Forex News Generator and Fundamental Sentiment Analyzer

class ForexNewsEngine {
    constructor() {
        this.newsHistory = [];
        this.currentSentiment = 0; // -100 (extreme bearish) to +100 (extreme bullish) for EUR/USD
        this.onNewNewsCallbacks = [];
        
        // Library of news templates
        this.templates = [
            {
                title: "Federal Reserve AS Mengisyaratkan Kenaikan Suku Bunga",
                desc: "Ketua Fed menyatakan inflasi tetap membandel, menyarankan suku bunga mungkin perlu bertahan lebih tinggi untuk waktu lebih lama. Imbal hasil obligasi AS melonjak.",
                impact: "HIGH",
                sentiment: -65, // EUR/USD drops (USD strengthens)
                pair: "EUR/USD"
            },
            {
                title: "Inflasi Zona Euro Turun ke 1,8%, di Bawah Target ECB",
                desc: "Eurostat melaporkan IHK turun lebih cepat dari perkiraan. Analis mempercayai ECB akan mempercepat pemotongan suku bunga, menyeret Euro turun.",
                impact: "HIGH",
                sentiment: -75, // Bearish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "NFP AS Melonjak ke 245 Ribu",
                desc: "Pasar tenaga kerja AS melampaui perkiraan dengan penambahan lapangan kerja yang besar di bulan Juni. Tingkat pengangguran turun menjadi 3,4%. Dolar mendominasi mata uang utama lainnya.",
                impact: "HIGH",
                sentiment: -80, // Bearish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Bank Sentral Eropa Mempertahankan Suku Bunga, Lagarde Nyatakan Optimisme Ekonomi",
                desc: "ECB mempertahankan suku bunga deposito utama tetap stabil tetapi menyoroti pertumbuhan upah yang kuat dan inflasi sektor jasa yang membandel. Euro menguat.",
                impact: "HIGH",
                sentiment: 70, // Bullish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Penjualan Ritel AS Turun sebesar 0,4% di Bulan Juni",
                desc: "Pengeluaran konsumen menunjukkan tanda-tanda pelemahan karena biaya pinjaman yang tinggi. Pasar meningkatkan taruhan pada penurunan suku bunga Fed mendatang.",
                impact: "MED",
                sentiment: 50, // Bullish EUR/USD (USD weakens)
                pair: "EUR/USD"
            },
            {
                title: "PDB Zona Euro Tumbuh sebesar 0,4% di Kuartal II, Lampaui Ekspektasi",
                desc: "Kinerja yang kuat di Jerman dan Prancis mendorong pemulihan Zona Euro. Kekhawatiran resesi ekonomi mereda.",
                impact: "MED",
                sentiment: 60, // Bullish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Ketegangan Geopolitik Meningkat, Mendorong Permintaan Safe-Haven Dolar AS",
                desc: "Gesekan regional yang tiba-tiba memicu sentimen risk-off di pasar saham global. Investor berbondong-bondong membeli USD dan Emas.",
                impact: "HIGH",
                sentiment: -55, // Bearish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Inflasi IHK AS Mendingin ke 2,9% y/y",
                desc: "Indeks Harga Konsumen mencatat angka terendah dalam 3 tahun. Trader meningkatkan ekspektasi pemotongan suku bunga di bulan September.",
                impact: "HIGH",
                sentiment: 65, // Bullish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Moody's Menaikkan Prospek Kredit Zona Euro Menjadi Positif",
                desc: "Lembaga pemeringkat mengutip peningkatan disiplin fiskal dan stabilitas transisi energi di seluruh blok mata uang tunggal.",
                impact: "LOW",
                sentiment: 30, // Mildly Bullish EUR/USD
                pair: "EUR/USD"
            },
            {
                title: "Klaim Pengangguran AS Naik secara Tak Terduga ke 238 Ribu",
                desc: "Klaim awal menunjukkan pendinginan bertahap pasar tenaga kerja AS. Dolar tergelincir sedikit terhadap mata uang utama.",
                impact: "LOW",
                sentiment: 25, // Mildly Bullish EUR/USD
                pair: "EUR/USD"
            }
        ];

        // Generate baseline news
        this.generateInitialNews();
    }

    generateInitialNews() {
        for (let i = 0; i < 4; i++) {
            const temp = this.templates[Math.floor(Math.random() * this.templates.length)];
            const time = new Date(Date.now() - (4 - i) * 600000); // Back-dated
            this.newsHistory.unshift({
                ...temp,
                time
            });
        }
        this.recalculateSentiment();
    }

    triggerNewNews() {
        // Pick random template
        const template = this.templates[Math.floor(Math.random() * this.templates.length)];
        
        // Add minor randomness to sentiment value
        const randomModifier = Math.floor((Math.random() - 0.5) * 15);
        const adjustedSentiment = Math.max(-100, Math.min(100, template.sentiment + randomModifier));

        const newsItem = {
            title: template.title,
            desc: template.desc,
            impact: template.impact,
            sentiment: adjustedSentiment,
            pair: template.pair,
            time: new Date()
        };

        this.newsHistory.unshift(newsItem);
        if (this.newsHistory.length > 30) {
            this.newsHistory.pop();
        }

        this.recalculateSentiment();

        // Notify subscribers
        this.onNewNewsCallbacks.forEach(cb => cb(newsItem));
        
        return newsItem;
    }

    subscribe(callback) {
        this.onNewNewsCallbacks.push(callback);
    }

    recalculateSentiment() {
        if (this.newsHistory.length === 0) {
            this.currentSentiment = 0;
            return;
        }

        // Weighted average sentiment based on impact
        // HIGH = weight 3, MED = weight 2, LOW = weight 1
        let totalWeight = 0;
        let weightedSentimentSum = 0;

        // Take only the last 5 news items for current sentiment tracking
        const recentNews = this.newsHistory.slice(0, 5);
        recentNews.forEach(item => {
            let weight = 1;
            if (item.impact === "HIGH") weight = 3;
            else if (item.impact === "MED") weight = 2;

            weightedSentimentSum += item.sentiment * weight;
            totalWeight += weight;
        });

        this.currentSentiment = Math.round(weightedSentimentSum / totalWeight);
    }

    getSentimentLabel() {
        const val = this.currentSentiment;
        if (val > 40) return "Strongly Bullish (Beli)";
        if (val > 10) return "Moderately Bullish (Beli)";
        if (val < -40) return "Strongly Bearish (Jual)";
        if (val < -10) return "Moderately Bearish (Jual)";
        return "Neutral (Sideways)";
    }
}

// Export engine instance to global scope
window.forexNewsEngine = new ForexNewsEngine();
