# Quantitative Backtesting Engine - Line by Line Explanation

Below is the entirety of `main.py`, with detailed comments explaining the Python syntax and mathematical logic of *every single line* of code we wrote.

```python
# Import Yahoo Finance historical stock data for OHLCV (Open, High, Low, Close, Volume) data
import yfinance as yf

# Import Pandas, the data science library that lets us manipulate spreadsheets in Python
import pandas as pd

# Import numpy, the math library that lets us run fast calculations on arrays of numbers
import numpy as np

# Import matplotlib, the library we use to draw graphs and visualizations
import matplotlib.pyplot as plt

# ==========================================
# 1. PARAMETERS & SETTINGS
# ==========================================

# Fixed ticker (Apple), start date, and end date for the simulation
ticker = "AAPL"
start_date = "2015-01-01"
end_date = "2025-01-01"

# We start the simulation with a $10,000 cash balance
initial_capital = 10000

# The fast-moving average will look at the last 20 days of prices
short_window = 20

# The slow-moving average will look at the last 50 days of prices
long_window = 50

# The broker charges us a 0.1% fee every time we execute a buy or sell order
transaction_cost = 0.001

# ==========================================
# 2. DATA LAYER
# ==========================================
# yfinance hits the Yahoo Finance API to download 10 years of daily stock prices into a Pandas DataFrame called 'data'
data = yf.download(ticker, start=start_date, end=end_date)

# ==========================================
# 3. STRATEGY LAYER
# ==========================================
# Look at the 'Close' column. Grab the last 20 rows (.rolling(20)) and calculate their average (.mean()). Save it as 'SMA20'
data['SMA20'] = data['Close'].rolling(window=short_window).mean()

# Look at the 'Close' column. Grab the last 50 rows (.rolling(50)) and calculate their average (.mean()). Save it as 'SMA50'
data['SMA50'] = data['Close'].rolling(window=long_window).mean()

# np.where checks the math logic: If SMA20 is heavily greater than SMA50, it assigns 1.0 (Meaning we should own the stock). Otherwise, 0.0 (Meaning we should be in cash).
data['Signal'] = np.where(data['SMA20'] > data['SMA50'], 1.0, 0.0)

# .diff() subtracts yesterday's signal from today's signal. If we went from 0 to 1, this equals 1 (BUY). If we went 1 to 0, it equals -1 (SELL).
data['Positions'] = data['Signal'].diff()

# ==========================================
# 4. EXECUTION LAYER
# ==========================================
# .pct_change() looks at today's closing price vs yesterday's closing price and tells us the percentage it moved (e.g., +0.02 for a 2% gain)
data['Market_Returns'] = data['Close'].pct_change()

# We multiply the market return by YESTERDAY'S signal (.shift(1)). This prevents Look-Ahead Bias so we don't accidentally "predict the past" on the day we buy!
data['Strategy_Returns'] = data['Market_Returns'] * data['Signal'].shift()

# We use np.abs() to turn negative 1 (sells) into positive 1. Then we multiply it by our 0.1% fee to mathematically deduct the broker charge from our daily profits.
data['Strategy_Returns'] -= np.abs(data['Positions']) * transaction_cost

# We take the $10,000, and compound it daily (.cumprod()) by whatever percentage our strategy returned. This tracks our literal dollar value over the decade.
data['Portfolio_Value'] = initial_capital * (1 + data['Strategy_Returns']).cumprod()

# We do the exact same thing, but compounding the raw market returns! This tracks what would happen if we just bought it 10 years ago and never touched it.
data['Buy_Hold_Value']  = initial_capital * (1 + data['Market_Returns']).cumprod()

# ==========================================
# 5. ANALYTICS LAYER
# ==========================================
# .cummax() looks back and finds the absolute highest peak our portfolio EVER reached up until this day.
strategy_peak = data['Portfolio_Value'].cummax()

# We subtract the current value from the peak to find out how much money we have currently lost from the top (the drawdown).
strategy_drawdown = (data['Portfolio_Value'] - strategy_peak) / strategy_peak

# .min() finds the deepest, worst drop of the entire 10 year period. We multiply by 100 to make it a percentage.
strategy_max_dd = strategy_drawdown.min() * 100

# The formula for Sharpe Ratio is (Average Daily Return / Standard Deviation of Daily Return) * sqrt(252 trading days in a year). This calculates Risk-Adjusted Reward.
strategy_sharpe = (data['Strategy_Returns'].mean() / data['Strategy_Returns'].std()) * np.sqrt(252)

# Repeating all the exact same math to find out the absolute worst drop for the Buy and Hold strategy.
buy_hold_peak = data['Buy_Hold_Value'].cummax()
buy_hold_drawdown = (data['Buy_Hold_Value'] - buy_hold_peak) / buy_hold_peak
buy_hold_max_dd = buy_hold_drawdown.min() * 100

# Repeating the exact same math to calculate the risk-adjusted Sharpe Ratio for the Buy and Hold strategy.
buy_hold_sharpe = (data['Market_Returns'].mean() / data['Market_Returns'].std()) * np.sqrt(252)

# ==========================================
# 6. RESULTS DASHBOARD
# ==========================================
# These print statements simply use Python's formatted strings (f"") to neatly print out all the math we just calculated onto the terminal log!
print("\n" + "="*40)
print("       BACKTEST RESULTS SUMMARY         ")
print("="*40)
print(f"Initial Capital:       ${initial_capital:,.2f}")
print(f"Strategy Final Value:  ${data['Portfolio_Value'].iloc[-1].item():,.2f}")
print(f"Buy & Hold Final:      ${data['Buy_Hold_Value'].iloc[-1].item():,.2f}")
print("-" * 40)
print(f"Strategy Max Drawdown: {strategy_max_dd.item():.2f}%")
print(f"Buy & Hold Max DD:     {buy_hold_max_dd.item():.2f}%")
print("-" * 40)
print(f"Strategy Sharpe:       {strategy_sharpe.item():.2f}")
print(f"Buy & Hold Sharpe:     {buy_hold_sharpe.item():.2f}")
print("="*40 + "\n")

# ==========================================
# 7. MATPLOTLIB VISUALIZATIONS
# ==========================================
# Tells matplotlib to use a completely black background with contrasting colors
plt.style.use('dark_background')

# Divides the window into 1 row with 3 columns. The gridspec_kw makes the first column twice as wide as the other two!
fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6), gridspec_kw={'width_ratios': [2, 1, 1]})

# Charts the Portfolio Dollar Value as an orange line across the 10 year timeline on the big left chart.
ax1.plot(data.index, data['Portfolio_Value'], label='Moving Average Strategy', color='orange')

# Charts the Buy & Hold Dollar value as a slightly transparent (alpha=0.7) green line underneath it.
ax1.plot(data.index, data['Buy_Hold_Value'], label='Buy and Hold (Benchmark)', color='green', alpha=0.7)
ax1.set_title('20/50 Moving Average vs Buy & Hold (AAPL)')
ax1.set_ylabel('Portfolio Value ($)')
ax1.legend()

# Charts a simple bar graph comparing the two Max Drawdowns (how bad the crashes were). We use abs() to make the negative number plot upwards as a magnitude.
ax2.bar(['Strategy', 'Buy & Hold'], [abs(strategy_max_dd.item()), abs(buy_hold_max_dd.item())], color=['orange', 'green'], alpha=0.7)
ax2.set_title('Maximum Drawdown % (Lower is Better)')
ax2.set_ylabel('Percentage Drop (%)')

# Charts a simple bar graph comparing the two Sharpe Ratios (how smooth the ride was). Higher means more profit per unit of stress!
ax3.bar(['Strategy', 'Buy & Hold'], [strategy_sharpe.item(), buy_hold_sharpe.item()], color=['orange', 'green'], alpha=0.7)
ax3.set_title('Sharpe Ratio (Higher is Better)')
ax3.set_ylabel('Ratio')

# ==========================================
# 8. PARAMETER OPTIMIZATION HEATMAP
# ==========================================
print("Running Parameter Optimization Scan... This may take a few seconds.")

# Generates a list of Short windows to test (10, 15, 20... up to 55)
heatmap_short_windows = range(10, 60, 5)

# Generates a list of Long windows to test (50, 60, 70... up to 190)
heatmap_long_windows = range(50, 200, 10)

# Creates a massive blank matrix (a grid) of zeros to hold the final grade for every single combination of the above!
results_grid = np.zeros((len(heatmap_short_windows), len(heatmap_long_windows)))

# We use .squeeze() to safely extract the 'Close' prices into a pure 1D list, ignoring weird formatting from Yahoo Finance
close_df = data['Close'].squeeze()

# A "Nested Loop" that iterates through every possible combination of Short Window and Long Window
for i, sw in enumerate(heatmap_short_windows):
    for j, lw in enumerate(heatmap_long_windows):
        
        # If we accidentally try to test a 60-day Short moving average vs a 50-day Long moving average, that breaks the chronological timeline. Skip it!
        if sw >= lw:
            results_grid[i, j] = np.nan
            continue
            
        # Re-calculates the moving averages for this specific loop combination
        sma_short = close_df.rolling(window=sw).mean()
        sma_long = close_df.rolling(window=lw).mean()
        
        # Re-calculates the Buys (1) and Sells (0). We use .astype(float) to preserve the Datetime tracking so Pandas doesn't crash here.
        signal = (sma_short > sma_long).astype(float)
        
        # Re-calculates the trades and the market baseline
        positions = signal.diff()
        market_returns = close_df.pct_change()
        
        # Multiplies baseline by signal (shifted to cheat Lookahead Bias) and deducts the broker transaction fee!
        strategy_returns = market_returns * signal.shift(1)
        strategy_returns -= np.abs(positions) * transaction_cost
        
        # Re-calculates the final grade (the Sharpe Ratio). If it mathematically failed, just assign it a 0.
        if strategy_returns.std() == 0:
            sharpe = 0.0
        else:
            sharpe = (strategy_returns.mean() / strategy_returns.std()) * np.sqrt(252)
            
        # Assigns the final Sharpe Ratio grade into the specific slot in our matrix map!
        results_grid[i, j] = sharpe

print("Scan Complete! Rendering UI...")

# Spawns a second window strictly dedicated to graphing the Matrix Grid we just calculated!
fig2, ax_heat = plt.subplots(figsize=(12, 8))

# imshow() is an incredibly powerful tool. It takes our 2D Matrix of numbers, and turns it into a color-scaled visual image! RdYlGn means (Red, Yellow, Green).
cax = ax_heat.imshow(results_grid, cmap='RdYlGn', origin='lower', aspect='auto')

# All 4 of these lines simply apply labels exactly to the X and Y axes so we can read the window sizes.
ax_heat.set_xticks(np.arange(len(heatmap_long_windows)))
ax_heat.set_yticks(np.arange(len(heatmap_short_windows)))
ax_heat.set_xticklabels(heatmap_long_windows)
ax_heat.set_yticklabels(heatmap_short_windows)

ax_heat.set_xlabel("Long Window Size (Days)")
ax_heat.set_ylabel("Short Window Size (Days)")
ax_heat.set_title("Sharpe Ratio Optimization Heatmap (AAPL 2015-2025)")

# Appends the visual color legend to the side of the heatmap
fig2.colorbar(cax, label="Sharpe Ratio (Higher = Greener = Better)")

# One final loop through the grid. We use ax_heat.text to literally print the exact decimal number directly inside the colored squares!
for i in range(len(heatmap_short_windows)):
    for j in range(len(heatmap_long_windows)):
        val = results_grid[i, j]
        if not np.isnan(val):
            ax_heat.text(j, i, f"{val:.2f}", ha="center", va="center", color="black" if val > 0.8 else "white", fontsize=8)

# This command ensures all the borders and margins exist safely inside the screen window
plt.tight_layout()

# Because this is placed at the absolute bottom of the code, it triggers both Window 1 (Portfolio Graph) and Window 2 (Heatmap Graph) to display at the exact same time!
plt.show()
```
