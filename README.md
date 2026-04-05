Quantitative Backtesting Engine
By A.M. Sultan

I'm a 10th-grade high school student and I built this stock backtesting engine in Python as a portfolio project for college applications. My goal is to eventually become a Quantitative Developer, so I wanted to prove to myself that I could build an engine that tests trading strategies using historical data. 

This project answers a simple question: If I had followed an exact mathematical trading rule starting 10 years ago, using only information available at the time, how much money would I have made compared to just doing nothing and passively holding the stock?

The strategy I built is a Moving Average Crossover. I wrote code to calculate a 20-day and 50-day Simple Moving Average of Apple's closing price. When the 20-day crosses above the 50-day, my program buys the stock. When it crosses below, it sells and stays entirely in cash. I simulated a $10,000 portfolio following these exact signals for a whole decade.

Through building this, I actually learned a lot about how quantitative finance works under the hood. For example, I learned what look-ahead bias is. At first, you might accidentally tell the code to buy at the end of the day but give yourself the profits for that entire day as if you had a time machine. I learned to use the shift function in pandas to push the signal to the next day to fix this flaw. 

I also learned why vectorization is so much better than writing standard for-loops in Python. By using pandas and numpy, the code can process 10 years of daily data in a fraction of a second by running operations across the whole spreadsheet at once instead of looking at it day by day. I also had to learn about Adjusted Close prices, because stock splits and dividends can make your backtest think a company crashed 75 percent overnight if you don't use adjusted data.

But the most interesting part of this project was the analytics layer. I programmed the engine to calculate Risk-Adjusted Returns using the Sharpe Ratio, and measure the worst-case scenario using Max Drawdown. 

When I finally ran the simulation on Apple from 2015 to 2025, my robot successfully turned $10,000 into $37,000. It also dodged the massive 38 percent COVID crash, only dropping 29 percent itself. But the benchmark test completely humbled my strategy. 

Because Apple went on such a legendary bull run, simply buying and holding the stock would have turned $10,000 into over $100,000. My robot stayed in cash too long during the uptrends, so the Sharpe Ratio of the simple buy-and-hold strategy ended up being much higher than my robot's ratio. The simulation mathematically proved that playing it too safe and using a moving average crossover strategy can actually underperform a buy-and-hold approach during a massive tech boom.

I'm currently working on making the engine even smarter by calculating Transaction Costs to simulate broker fees, and eventually building a Parameter Optimization Heatmap to mathematically test thousands of different moving average combinations instead of just guessing.