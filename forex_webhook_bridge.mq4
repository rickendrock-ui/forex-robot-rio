//+------------------------------------------------------------------+
//|                                     forex_webhook_bridge.mq4    |
//|                        Copyright 2026, Antigravity AI Forex Bot  |
//|                                   https://github.com/rickendrock |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Antigravity AI Forex Bot"
#property link      "https://github.com/rickendrock"
#property version   "1.00"
#property strict

// Input Parameters
input string   SignalURL   = "http://localhost:5000/signals"; // URL Server Signal
input int      PollIntervalSeconds = 1;                        // Interval polling (detik)
input int      Slippage    = 3;                                // Slippage pips

// Global variables
string lastExecutedTicket = "";
datetime lastPollTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Webhook Bridge EA Diinisialisasi. Polling URL: ", SignalURL);
   EventSetTimer(PollIntervalSeconds);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("Webhook Bridge EA Dimatikan.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Cegah tabrakan request
   if(TimeCurrent() - lastPollTime < PollIntervalSeconds) return;
   lastPollTime = TimeCurrent();
   
   string cookie = NULL, headers;
   char post[], result[];
   int res;
   
   // Izinkan WebRequest di opsi Terminal -> Expert Advisors
   ResetLastError();
   res = WebRequest("GET", SignalURL, cookie, NULL, 5000, post, 0, result, headers);
   
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4060) {
         Print("Error WebRequest: Tambahkan URL '", SignalURL, "' di Opsi Terminal -> tab Expert Advisors.");
      } else {
         Print("WebRequest Gagal. Error code = ", err);
      }
      return;
   }
   
   string response = CharArrayToString(result);
   if(StringLen(response) < 10) return; // Response kosong atau tidak valid
   
   // Parse JSON sederhana
   string action = GetJSONValue(response, "action");
   string type   = GetJSONValue(response, "type");
   string symbol = GetJSONValue(response, "symbol");
   double volume = NormalizeDouble(StringToDouble(GetJSONValue(response, "volume")), 2);
   double sl     = StringToDouble(GetJSONValue(response, "sl"));
   double tp     = StringToDouble(GetJSONValue(response, "tp"));
   string ticket = GetJSONValue(response, "ticket");
   
   if(ticket == "" || ticket == lastExecutedTicket) return; // Sinyal lama atau kosong
   
   Print("Sinyal Baru Diterima: ", action, " | Ticket ID: ", ticket);
   
   if(action == "OPEN")
   {
      int cmd = (type == "BUY") ? OP_BUY : OP_SELL;
      double price = (cmd == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
      
      int orderTicket = OrderSend(symbol, cmd, volume, price, Slippage, sl, tp, "Antigravity Signal: " + ticket, 1002, 0, (cmd == OP_BUY) ? clrGreen : clrRed);
      
      if(orderTicket > 0)
      {
         Print("Order Berhasil Dibuka! Ticket Broker: ", orderTicket);
         lastExecutedTicket = ticket;
      }
      else
      {
         Print("Order Gagal Dibuka. Error Code: ", GetLastError());
      }
   }
   else if(action == "CLOSE")
   {
      // Cari posisi terbuka yang memiliki komentar dengan ID ticket ini
      string commentToSearch = "Antigravity Signal: " + ticket;
      bool closed = false;
      
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         {
            if(OrderComment() == commentToSearch || StringFind(OrderComment(), ticket) >= 0)
            {
               double closePrice = (OrderType() == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
               if(OrderClose(OrderTicket(), OrderLots(), closePrice, Slippage, clrWhite))
               {
                  Print("Order ", OrderTicket(), " Berhasil Ditutup Manual dari Web.");
                  closed = true;
               }
               else
               {
                  Print("Gagal Menutup Order: ", GetLastError());
               }
            }
         }
      }
      
      if(closed)
      {
         lastExecutedTicket = ticket;
      }
   }
}

//+------------------------------------------------------------------+
//| Simple JSON string parsing helper                                |
//+------------------------------------------------------------------+
string GetJSONValue(string json, string key) {
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos == -1) return "";
   
   int valStart = pos + StringLen(searchKey);
   
   // Skip spaces, quotes, colons
   while(valStart < StringLen(json) && 
         (StringSubstr(json, valStart, 1) == " " || 
          StringSubstr(json, valStart, 1) == "\"" ||
          StringSubstr(json, valStart, 1) == ":")) {
      valStart++;
   }
   
   int valEnd = valStart;
   while(valEnd < StringLen(json) && 
         StringSubstr(json, valEnd, 1) != "\"" && 
         StringSubstr(json, valEnd, 1) != "," && 
         StringSubstr(json, valEnd, 1) != "}" &&
         StringSubstr(json, valEnd, 1) != "\n" &&
         StringSubstr(json, valEnd, 1) != "\r") {
      valEnd++;
   }
   
   return StringSubstr(json, valStart, valEnd - valStart);
}
