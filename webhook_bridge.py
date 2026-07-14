import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

# Global variable untuk menyimpan sinyal trading terbaru
latest_signal = {}
PORT = 5000

class WebhookBridgeHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Tambahkan header CORS agar browser dashboard Netlify diizinkan mengirim request POST
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle CORS preflight request dari peramban web
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        global latest_signal
        if self.path in ['/signals', '/api/signals']:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                signal = json.loads(post_data.decode('utf-8'))
                latest_signal = signal
                
                print(f"\n[{time.strftime('%H:%M:%S')}] 📬 Sinyal Diterima dari Dashboard:")
                print(f"   Aksi        : {signal.get('action')}")
                print(f"   Tipe        : {signal.get('type')}")
                print(f"   Instrumen   : {signal.get('symbol')}")
                print(f"   Lot Volume  : {signal.get('volume')} Lot")
                print(f"   Stop Loss   : {signal.get('sl')}")
                print(f"   Take Profit : {signal.get('tp')}")
                print(f"   Ticket ID   : {signal.get('ticket')}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {"success": True, "message": "Sinyal berhasil disimpan di Bridge Python."}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                print("Gagal memproses JSON payload:", str(e))
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {"success": False, "error": str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        global latest_signal
        if self.path in ['/signals', '/api/signals']:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(latest_signal).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    # Menonaktifkan logging request bawaan agar output terminal tetap bersih
    def log_message(self, format, *args):
        return

def run(server_class=HTTPServer, handler_class=WebhookBridgeHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"==================================================================")
    print(f"     RICKTRADES PYTHON WEBHOOK BRIDGE SERVER SEDANG BERJALAN ")
    print(f"==================================================================")
    print(f"* Port Lokal Bridge : http://localhost:{PORT}/signals")
    print(f"* Menunggu sinyal POST dari Dashboard Netlify...")
    print(f"* Menunggu polling GET dari EA MT5 Terminal...")
    print(f"\nCARA PENYAMBUNGAN DENGAN NGROK (Untuk Netlify HTTPS):")
    print(f"1. Jalankan perintah ngrok di terminal laptop/PC Anda:")
    print(f"   ngrok http {PORT}")
    print(f"2. Salin URL HTTPS ngrok yang dihasilkan")
    print(f"   (contoh: https://abcd-123-456.ngrok-free.app)")
    print(f"3. Buka Dashboard di Netlify, masuk ke menu Koneksi Broker,")
    print(f"   dan tempelkan URL tersebut ke kolom 'Webhook EA URL' dengan akhiran /signals:")
    print(f"   Contoh: https://abcd-123-456.ngrok-free.app/signals")
    print(f"==================================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan oleh pengguna.")
        httpd.server_close()

if __name__ == '__main__':
    run()
