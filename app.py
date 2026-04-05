from flask import Flask, render_template, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np
import math

app = Flask(__name__)


def safe_float(val):
    """Convert to Python float, returning None for NaN/inf."""
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


def get_close_series(raw):
    """Safely extract a 1D Close price Series from a yfinance DataFrame."""
    close = raw["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    else:
        close = close.squeeze()
    return close


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/backtest", methods=["POST"])
def backtest():
    req = request.json
    ticker = req.get("ticker", "AAPL").upper().strip()
    start_date = req.get("start_date", "2015-01-01")
    end_date = req.get("end_date", "2025-01-01")
    short_window = int(req.get("short_window", 20))
    long_window = int(req.get("long_window", 50))
    initial_capital = float(req.get("initial_capital", 10000))
    tx_cost = 0.001

    if short_window >= long_window:
        return jsonify({"error": "Fast MA window must be smaller than Slow MA window."}), 400

    try:
        raw = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if raw.empty:
            return jsonify({"error": f'No data found for "{ticker}". Check the ticker symbol.'}), 400

        close = get_close_series(raw)

        sma_s = close.rolling(window=short_window).mean()
        sma_l = close.rolling(window=long_window).mean()
        signal = pd.Series(np.where(sma_s > sma_l, 1.0, 0.0), index=close.index)
        positions = signal.diff()

        mkt_ret = close.pct_change()
        strat_ret = mkt_ret * signal.shift(1) - np.abs(positions) * tx_cost

        port_val = initial_capital * (1 + strat_ret).cumprod()
        bh_val = initial_capital * (1 + mkt_ret).cumprod()

        sp = port_val.cummax()
        sd = (port_val - sp) / sp
        bhp = bh_val.cummax()
        bhd = (bh_val - bhp) / bhp

        strat_sharpe = safe_float((strat_ret.mean() / strat_ret.std()) * np.sqrt(252))
        bh_sharpe = safe_float((mkt_ret.mean() / mkt_ret.std()) * np.sqrt(252))

        dates = [str(d.date()) for d in raw.index]

        return jsonify({
            "success": True,
            "ticker": ticker,
            "short_window": short_window,
            "long_window": long_window,
            "dates": dates,
            "close": [safe_float(v) for v in close],
            "sma_short": [safe_float(v) for v in sma_s],
            "sma_long": [safe_float(v) for v in sma_l],
            "portfolio_value": [safe_float(v) for v in port_val],
            "buy_hold_value": [safe_float(v) for v in bh_val],
            "strategy_drawdown": [safe_float(v * 100) for v in sd],
            "buy_hold_drawdown": [safe_float(v * 100) for v in bhd],
            "analytics": {
                "initial_capital": initial_capital,
                "strategy_final": safe_float(port_val.iloc[-1]),
                "buy_hold_final": safe_float(bh_val.iloc[-1]),
                "strategy_return_pct": safe_float((port_val.iloc[-1] / initial_capital - 1) * 100),
                "buy_hold_return_pct": safe_float((bh_val.iloc[-1] / initial_capital - 1) * 100),
                "strategy_max_dd": safe_float(sd.min() * 100),
                "buy_hold_max_dd": safe_float(bhd.min() * 100),
                "strategy_sharpe": strat_sharpe,
                "buy_hold_sharpe": bh_sharpe,
            },
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/optimize", methods=["POST"])
def optimize():
    req = request.json
    ticker = req.get("ticker", "AAPL").upper().strip()
    start_date = req.get("start_date", "2015-01-01")
    end_date = req.get("end_date", "2025-01-01")
    tx_cost = 0.001

    try:
        raw = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if raw.empty:
            return jsonify({"error": f'No data found for "{ticker}"'}), 400

        close = get_close_series(raw)
        short_windows = list(range(10, 60, 5))
        long_windows = list(range(50, 200, 10))
        grid = []

        for sw in short_windows:
            row = []
            for lw in long_windows:
                if sw >= lw:
                    row.append(None)
                    continue
                sma_s = close.rolling(window=sw).mean()
                sma_l = close.rolling(window=lw).mean()
                sig = (sma_s > sma_l).astype(float)
                pos = sig.diff()
                mr = close.pct_change()
                sr = mr * sig.shift(1) - np.abs(pos) * tx_cost
                std = sr.std()
                if std == 0 or pd.isna(std):
                    row.append(0.0)
                else:
                    sharpe = safe_float((sr.mean() / std) * np.sqrt(252))
                    row.append(sharpe if sharpe is not None else 0.0)
            grid.append(row)

        return jsonify({
            "success": True,
            "grid": grid,
            "short_windows": short_windows,
            "long_windows": long_windows,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
