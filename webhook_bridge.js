const http = require('http');

// Simpan sinyal terbaru di memori
let latestSignal = {};

const PORT = 5000;

const server = http.createServer((req, res) => {
    // Aktifkan CORS agar dashboard Netlify (atau localhost browser) bisa mengirim POST request
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request dari browser
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/signals' || req.url === '/api/signals') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const signal = JSON.parse(body);
                    latestSignal = signal;
                    
                    console.log(`\n[${new Date().toLocaleTimeString()}] 📬 Sinyal Diterima dari Dashboard:`);
                    console.log(`   Aksi        : ${signal.action}`);
                    console.log(`   Tipe        : ${signal.type}`);
                    console.log(`   Instrumen   : ${signal.symbol}`);
                    console.log(`   Lot Volume  : ${signal.volume} Lot`);
                    console.log(`   Stop Loss   : ${signal.sl}`);
                    console.log(`   Take Profit : ${signal.tp}`);
                    console.log(`   Ticket ID   : ${signal.ticket}`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: "Sinyal berhasil disimpan di Bridge." }));
                } catch (e) {
                    console.error("Gagal melakukan parse payload JSON:", e.message);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: "Format JSON tidak valid" }));
                }
            });
        } else if (req.method === 'GET') {
            // MT5 EA akan melakukan polling GET ke sini untuk mengambil sinyal terbaru
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(latestSignal));
        } else {
            res.writeHead(405);
            res.end();
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`==================================================================`);
    console.log(`        RICKTRADES WEBHOOK BRIDGE SERVER SEDANG BERJALAN `);
    console.log(`==================================================================`);
    console.log(`* Port Lokal Bridge : http://localhost:${PORT}/signals`);
    console.log(`* Menunggu sinyal POST dari Dashboard Netlify...`);
    console.log(`* Menunggu polling GET dari EA MT5 Terminal...`);
    console.log(`\nCARA PENYAMBUNGAN DENGAN NGROK (Untuk Netlify HTTPS):`);
    console.log(`1. Jalankan perintah ngrok di terminal laptop/PC Anda:`);
    console.log(`   ngrok http ${PORT}`);
    console.log(`2. Salin URL HTTPS ngrok yang dihasilkan`);
    console.log(`   (contoh: https://abcd-123-456.ngrok-free.app)`);
    console.log(`3. Buka Dashboard di Netlify, masuk ke menu Koneksi Broker,`);
    console.log(`   dan tempelkan URL tersebut ke kolom "Webhook EA URL" dengan akhiran /signals:`);
    console.log(`   Contoh: https://abcd-123-456.ngrok-free.app/signals`);
    console.log(`==================================================================\n`);
});
