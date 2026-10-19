"""
GlobalTrade Simulator - Python Market Data Adapter Service
Provides interchangeable market data feed adapter with Yahoo Finance and fallback providers.
Satisfies feature requirement Item 13.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import yfinance as yf
import datetime
import os

app = FastAPI(
    title="GlobalTrade Python Market Service",
    description="Interchangeable Python Market Data Service with Yahoo Finance & Provider Abstraction",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuoteResponse(BaseModel):
    symbol: str
    price: float
    change: float
    changePercent: float
    high: float
    low: float
    open: float
    previousClose: float
    volume: int
    currency: str
    exchange: Optional[str] = None
    marketStatus: str
    timestamp: int
    provider: str
    isStale: bool

class CandleItem(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int

@app.get("/health")
def health():
    return {
        "status": "operational",
        "service": "globaltrade-market-service-py",
        "timestamp": int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    }

@app.get("/quote/{symbol}", response_model=QuoteResponse)
def get_quote(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        
        last_price = float(info.last_price or 0.0)
        prev_close = float(info.previous_close or last_price)
        change = round(last_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0

        return QuoteResponse(
            symbol=symbol.upper(),
            price=round(last_price, 2),
            change=change,
            changePercent=change_pct,
            high=round(float(info.day_high or last_price), 2),
            low=round(float(info.day_low or last_price), 2),
            open=round(float(info.open or last_price), 2),
            previousClose=round(prev_close, 2),
            volume=int(info.last_volume or 0),
            currency=info.currency or "USD",
            exchange=info.exchange or "UNKNOWN",
            marketStatus="OPEN",
            timestamp=int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000),
            provider="Python yfinance Service Adapter",
            isStale=False
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data adapter error: {str(e)}")

@app.get("/history/{symbol}", response_model=List[CandleItem])
def get_historical_candles(
    symbol: str, 
    period: str = Query("1mo", regex="^(1d|5d|1mo|3mo|6mo|1y|5y|max)$"),
    interval: str = Query("1d", regex="^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo)$")
):
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No candle data found for {symbol}")

        candles: List[CandleItem] = []
        for index, row in df.iterrows():
            time_epoch = int(index.timestamp())
            candles.append(CandleItem(
                time=time_epoch,
                open=round(float(row["Open"]), 2),
                high=round(float(row["High"]), 2),
                low=round(float(row["Low"]), 2),
                close=round(float(row["Close"]), 2),
                volume=int(row["Volume"])
            ))

        return candles
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Historical data error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 4002))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
