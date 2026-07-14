//+------------------------------------------------------------------+
//|                                     forex_webhook_bridge.mq5    |
//|                        Copyright 2026, Antigravity AI Forex Bot  |
//|                                   https://github.com/rickendrock |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Antigravity AI Forex Bot"
#property link      "https://github.com/rickendrock"
#property version   "1.00"

// Include MQL5 Standard Trade Class
#include <Trade\Trade.mqh>
CTrade trade;

// Input Parameters
input string   SignalURL   = "http://localhost:5000/signals"; // URL Server Signal
input int      PollIntervalSeconds = 1;                        // Interval polling (detik)
input int      Slippage    = 30;                               // Slippage points (MT5 uses points)

// Global variables
string lastExecutedTicket = "";
datetime lastPollTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Webhook Bridge EA MT5 Diinisialisasi. Polling URL: ", SignalURL);
   EventSetTimer(PollIntervalSeconds);
   
   // Set Slippage on trade object
   trade.SetDeviationInPoints(Slippage);
   trade.SetExpertMagicNumber(1002);
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("Webhook Bridge EA MT5 Dimatikan.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Cegah request menumpuk
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
      if(err == 4014) {
         Print("Error WebRequest: Tambahkan URL '", SignalURL, "' di Opsi Terminal -> tab Expert Advisors.");
      } else {
         Print("WebRequest MT5 Gagal. Error code = ", err);
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
   
   Print("Sinyal Baru MT5 Diterima: ", action, " | Ticket ID: ", ticket);
   
   if(action == "OPEN")
   {
      bool success = false;
      string comment = "Antigravity Signal: " + ticket;
      
      if(type == "BUY")
      {
         double price = SymbolInfoDouble(symbol, SYMBOL_ASK);
         success = trade.Buy(volume, symbol, price, sl, tp, comment);
      }
      else if(type == "SELL")
      {
         double price = SymbolInfoDouble(symbol, SYMBOL_BID);
         success = trade.Sell(volume, symbol, price, sl, tp, comment);
      }
      
      if(success)
      {
         ulong orderTicket = trade.ResultOrder();
         Print("Order MT5 Berhasil Dibuka! Ticket Broker: ", orderTicket);
         lastExecutedTicket = ticket;
      }
      else
      {
         Print("Order MT5 Gagal Dibuka. RetCode: ", trade.ResultRetcode(), " | Description: ", trade.ResultRetcodeDescription());
      }
   }
   else if(action == "CLOSE")
   {
      string commentToSearch = "Antigravity Signal: " + ticket;
      bool closed = false;
      
      // Cari di posisi aktif MT5
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong posTicket = PositionGetTicket(i);
         if(posTicket > 0)
         {
            if(PositionGetString(POSITION_SYMBOL) == symbol && 
               (PositionGetString(POSITION_COMMENT) == commentToSearch || StringFind(PositionGetString(POSITION_COMMENT), ticket) >= 0))
            {
               if(trade.PositionClose(posTicket))
               {
                  Print("Posisi MT5 ", posTicket, " Berhasil Ditutup Manual dari Web.");
                  closed = true;
               }
               else
               {
                  Print("Gagal Menutup Posisi MT5: ", trade.ResultRetcodeDescription());
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
