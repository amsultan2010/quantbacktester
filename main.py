# Import Yahoo Finance historical stock data for OHLCV data
import yfinance as yf

# Import Pandas for data visualization and whatnot
import pandas as pd

# Import numpy for calculations 
import numpy as np

#Import matplotlib for graphing stuff
import matplotlib.pyplot as plt

# ==========================================
# 1. PARAMETERS & SETTINGS
# ==========================================

# Fixed ticker, start date, and end date
ticker = "AAPL"
start_date = "2015-01-01"
end_date = "2025-01-01"

# Initial capital, short window, long window, and transaction cost
initial_capital = 10000
short_window = 20
long_window = 50
transaction_cost = 0.001  # 0.1% fee on every buy and sell

# ==========================================
# 2. DATA LAYER
# ==========================================
# Download historical OHLCV data from Yahoo Finance
data = yf.download(ticker, start=start_date, end=end_date)

# ==========================================
# 3. STRATEGY LAYER
# ==========================================
# Calculate Simple Moving Averages
data['SMA20'] = data['Close'].rolling(window=short_window).mean()
data['SMA50'] = data['Close'].rolling(window=long_window).mean()

# Generate Trading Signals (1.0 = Own the stock, 0.0 = Hold cash)
data['Signal'] = np.where(data['SMA20'] > data['SMA50'], 1.0, 0.0)

# Document exact trading days (1.0 = Buy, -1.0 = Sell)
data['Positions'] = data['Signal'].diff()

# ==========================================
# 4. EXECUTION LAYER
# ==========================================
# Calculate raw daily market percentage returns
data['Market_Returns'] = data['Close'].pct_change()

# Calculate our strategy returns (Shifted to prevent Look-Ahead Bias!)
data['Strategy_Returns'] = data['Market_Returns'] * data['Signal'].shift()

# Apply Transaction Costs (Subtract 0.1% purely on days where a trade entered/exited)
data['Strategy_Returns'] -= np.abs(data['Positions']) * transaction_cost

# Calculate compounding portfolio dollar values over 10 years
data['Portfolio_Value'] = initial_capital * (1 + data['Strategy_Returns']).cumprod()
data['Buy_Hold_Value']  = initial_capital * (1 + data['Market_Returns']).cumprod()

# ==========================================
# 5. ANALYTICS LAYER
# ==========================================
# Strategy Risk Metrics
strategy_peak = data['Portfolio_Value'].cummax()
strategy_drawdown = (data['Portfolio_Value'] - strategy_peak) / strategy_peak
strategy_max_dd = strategy_drawdown.min() * 100
strategy_sharpe = (data['Strategy_Returns'].mean() / data['Strategy_Returns'].std()) * np.sqrt(252)

# Buy & Hold Risk Metrics
buy_hold_peak = data['Buy_Hold_Value'].cummax()
buy_hold_drawdown = (data['Buy_Hold_Value'] - buy_hold_peak) / buy_hold_peak
buy_hold_max_dd = buy_hold_drawdown.min() * 100
buy_hold_sharpe = (data['Market_Returns'].mean() / data['Market_Returns'].std()) * np.sqrt(252)

# ==========================================
# 6. RESULTS DASHBOARD
# ==========================================
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
plt.style.use('dark_background')

# Create 1 row, 3 columns layout
fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6), gridspec_kw={'width_ratios': [2, 1, 1]})

# Chart 1: Line chart for Portfolio Performance
ax1.plot(data.index, data['Portfolio_Value'], label='Moving Average Strategy', color='orange')
ax1.plot(data.index, data['Buy_Hold_Value'], label='Buy and Hold (Benchmark)', color='green', alpha=0.7)
ax1.set_title('20/50 Moving Average vs Buy & Hold (AAPL)')
ax1.set_ylabel('Portfolio Value ($)')
ax1.legend()

# Chart 2: Bar chart for Max Drawdown
ax2.bar(['Strategy', 'Buy & Hold'], [abs(strategy_max_dd.item()), abs(buy_hold_max_dd.item())], color=['orange', 'green'], alpha=0.7)
ax2.set_title('Maximum Drawdown % (Lower is Better)')
ax2.set_ylabel('Percentage Drop (%)')

# Chart 3: Bar chart for Sharpe Ratio
ax3.bar(['Strategy', 'Buy & Hold'], [strategy_sharpe.item(), buy_hold_sharpe.item()], color=['orange', 'green'], alpha=0.7)
ax3.set_title('Sharpe Ratio (Higher is Better)')
ax3.set_ylabel('Ratio')

# ==========================================
# 8. PARAMETER OPTIMIZATION HEATMAP
# ==========================================
print("Running Parameter Optimization Scan... This may take a few seconds.")

# Define ranges of windows to test
heatmap_short_windows = range(10, 60, 5)   # 10, 15, 20... 55
heatmap_long_windows = range(50, 200, 10)  # 50, 60, 70... 190

# Create an empty grid (matrix) to store the result of every single combination
results_grid = np.zeros((len(heatmap_short_windows), len(heatmap_long_windows)))

# Safely extract purely the 1D Close column to avoid multi-index DataFrame shape issues
close_df = data['Close'].squeeze()

# Nested loop to test every combination
for i, sw in enumerate(heatmap_short_windows):
    for j, lw in enumerate(heatmap_long_windows):
        
        # Skip chronologically invalid combinations
        if sw >= lw:
            results_grid[i, j] = np.nan
            continue
            
        # Fast Moving Averages
        sma_short = close_df.rolling(window=sw).mean()
        sma_long = close_df.rolling(window=lw).mean()
        
        # Fast Signal: We use pandas logic purely to ensure we don't lose our Datetime index!
        signal = (sma_short > sma_long).astype(float)
        
        # Fast Execution
        positions = signal.diff()
        market_returns = close_df.pct_change()
        
        # Shift signal and calculate returns with the transaction cost penalty
        strategy_returns = market_returns * signal.shift(1)
        strategy_returns -= np.abs(positions) * transaction_cost
        
        # Analytics Layer: Calculate Sharpe Ratio
        if strategy_returns.std() == 0:
            sharpe = 0.0
        else:
            sharpe = (strategy_returns.mean() / strategy_returns.std()) * np.sqrt(252)
            
        # Store result
        results_grid[i, j] = sharpe

print("Scan Complete! Rendering UI...")

# Draw the Heatmap on a new figure
fig2, ax_heat = plt.subplots(figsize=(12, 8))

# imshow takes a 2D matrix of numbers and assigns a color to every square. 
cax = ax_heat.imshow(results_grid, cmap='RdYlGn', origin='lower', aspect='auto')

# Labeling the X and Y axes
ax_heat.set_xticks(np.arange(len(heatmap_long_windows)))
ax_heat.set_yticks(np.arange(len(heatmap_short_windows)))
ax_heat.set_xticklabels(heatmap_long_windows)
ax_heat.set_yticklabels(heatmap_short_windows)

ax_heat.set_xlabel("Long Window Size (Days)")
ax_heat.set_ylabel("Short Window Size (Days)")
ax_heat.set_title("Sharpe Ratio Optimization Heatmap (AAPL 2015-2025)")

# Add a colorbar legend
fig2.colorbar(cax, label="Sharpe Ratio (Higher = Greener = Better)")

# Loop over the matrix one last time to print the physical numbers inside the colored squares
for i in range(len(heatmap_short_windows)):
    for j in range(len(heatmap_long_windows)):
        val = results_grid[i, j]
        if not np.isnan(val):
            ax_heat.text(j, i, f"{val:.2f}", ha="center", va="center", color="black" if val > 0.8 else "white", fontsize=8)

# Render all the UI (both the Portfolio charts and the Heatmap) at once!
plt.tight_layout()
plt.show()