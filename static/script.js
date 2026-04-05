/* ============================================================
   QuantBacktest — Frontend Logic
   ============================================================ */

// ================================================================
// HERO CANVAS — animated particle network
// ================================================================
(function initHeroCanvas() {
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let rafId;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function makeParticles() {
    particles = [];
    const n = Math.max(30, Math.floor((canvas.width * canvas.height) / 14000));
    for (let i = 0; i < n; i++) {
      particles.push({
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r:  Math.random() * 1.8 + 0.6,
        a:  Math.random() * 0.28 + 0.06,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const LINK = 130;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // connections
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(0, 230, 118, ${0.12 * (1 - d / LINK)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 230, 118, ${p.a})`;
      ctx.fill();

      // move
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }

    rafId = requestAnimationFrame(draw);
  }

  resize();
  makeParticles();
  draw();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      resize();
      makeParticles();
      draw();
    }, 200);
  });
})();


// ================================================================
// PLOTLY THEME
// ================================================================
const STRAT_COLOR  = "#00E676";
const BENCH_COLOR  = "#FFC400";
const STRAT_FILL   = "rgba(0, 230, 118, 0.07)";
const BENCH_FILL   = "rgba(255, 196, 0, 0.07)";

const BASE_LAYOUT = {
  paper_bgcolor: "transparent",
  plot_bgcolor:  "transparent",
  font:  { family: "DM Sans, sans-serif", color: "#A8A8A8", size: 12 },
  margin: { t: 10, r: 20, b: 50, l: 68 },
  xaxis: {
    gridcolor:     "#222222",
    linecolor:     "#262626",
    zerolinecolor: "#333333",
    tickfont: { size: 11, color: "#6E6E6E" },
    automargin: true,
  },
  yaxis: {
    gridcolor:     "#222222",
    linecolor:     "#262626",
    zerolinecolor: "#333333",
    tickfont: { size: 11, color: "#6E6E6E" },
    automargin: true,
  },
  legend: {
    bgcolor:     "rgba(21, 21, 21, 0.95)",
    bordercolor: "#262626",
    borderwidth: 1,
    font: { size: 11, color: "#A8A8A8" },
  },
  hovermode: "x unified",
  hoverlabel: {
    bgcolor:     "#1A1A1A",
    bordercolor: "#333333",
    font: { size: 12, color: "#E8E8E8", family: "DM Sans, sans-serif" },
  },
};

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toggleSpikelines"],
  displaylogo: false,
  toImageButtonOptions: { format: "png", scale: 2, width: 1400, height: 700 },
};


// ================================================================
// STATE
// ================================================================
let currentParams = null;


// ================================================================
// RUN BACKTEST
// ================================================================
document.getElementById("run-btn").addEventListener("click", runBacktest);
document.querySelectorAll(".control-card input").forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") runBacktest(); })
);

async function runBacktest() {
  const ticker     = document.getElementById("ticker").value.trim().toUpperCase();
  const startDate  = document.getElementById("start-date").value;
  const endDate    = document.getElementById("end-date").value;
  const capital    = parseFloat(document.getElementById("initial-capital").value);
  const shortW     = parseInt(document.getElementById("short-window").value, 10);
  const longW      = parseInt(document.getElementById("long-window").value, 10);

  if (!ticker)                              return showError("Please enter a stock ticker.");
  if (!startDate || !endDate)               return showError("Please set start and end dates.");
  if (new Date(startDate) >= new Date(endDate)) return showError("Start date must be before end date.");
  if (shortW >= longW)                      return showError("Fast MA must be smaller than Slow MA.");
  if (capital <= 0 || isNaN(capital))       return showError("Starting capital must be a positive number.");

  currentParams = { ticker, start_date: startDate, end_date: endDate,
                    short_window: shortW, long_window: longW, initial_capital: capital };

  hideError();
  showLoading("Running simulation…");
  document.getElementById("heatmap-section").classList.add("hidden");
  document.getElementById("optimal-banner").classList.add("hidden");

  try {
    const res  = await fetch("/api/backtest", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(currentParams),
    });
    const data = await res.json();

    if (!res.ok || data.error) return showError(data.error || "Backtest failed.");

    renderResults(data);
  } catch (_) {
    showError("Network error — make sure the Flask server is running.");
  } finally {
    hideLoading();
  }
}


// ================================================================
// RENDER RESULTS
// ================================================================
function renderResults(data) {
  const a = data.analytics;

  // Header text
  document.getElementById("results-title").textContent =
    `${data.ticker} — Backtest Results`;
  document.getElementById("results-subtitle").textContent =
    `SMA${data.short_window} / SMA${data.long_window} crossover vs Buy & Hold  ·  ${currentParams.start_date} → ${currentParams.end_date}`;
  document.getElementById("strategy-label").textContent =
    `SMA${data.short_window} / SMA${data.long_window}`;
  document.getElementById("chart-capital").textContent =
    a.initial_capital.toLocaleString("en-US");

  // Show section first (so Plotly can measure DOM)
  const section = document.getElementById("results-section");
  section.classList.remove("hidden");

  // Animate stat cards in
  const cards = document.querySelectorAll(".stat-card");
  cards.forEach((c, i) => {
    c.style.animation = "none";
    void c.offsetHeight; // reflow
    c.style.animation = `cardIn 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s both`;
  });

  // Fill stat cards
  animCount("stat-strategy-final", a.strategy_final,
    v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  animCount("stat-bh-final", a.buy_hold_final,
    v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  setDelta("stat-strategy-return", a.strategy_return_pct, v =>
    (v >= 0 ? "+" : "") + v.toFixed(2) + "% total return");
  setDelta("stat-bh-return", a.buy_hold_return_pct, v =>
    (v >= 0 ? "+" : "") + v.toFixed(2) + "% total return");

  document.getElementById("stat-strategy-dd").textContent =
    (a.strategy_max_dd != null ? a.strategy_max_dd.toFixed(2) : "—") + "%";
  document.getElementById("stat-bh-dd").textContent =
    (a.buy_hold_max_dd != null ? a.buy_hold_max_dd.toFixed(2) : "—") + "%";
  document.getElementById("stat-strategy-sharpe").textContent =
    a.strategy_sharpe != null ? a.strategy_sharpe.toFixed(2) : "—";
  document.getElementById("stat-bh-sharpe").textContent =
    a.buy_hold_sharpe != null ? a.buy_hold_sharpe.toFixed(2) : "—";

  // Charts (small delay so DOM is painted)
  setTimeout(() => {
    renderPortfolioChart(data);
    renderPriceChart(data);
    renderDrawdownChart(data);
    renderBarCharts(data);
  }, 50);

  // Scroll
  setTimeout(() => section.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}


// ================================================================
// CHARTS
// ================================================================
function renderPortfolioChart(data) {
  const traces = [
    {
      x: data.dates, y: data.portfolio_value,
      name: `SMA${data.short_window}/${data.long_window} Strategy`,
      type: "scatter", mode: "lines",
      line:     { color: STRAT_COLOR, width: 2.5 },
      fill:     "tozeroy",
      fillcolor: STRAT_FILL,
    },
    {
      x: data.dates, y: data.buy_hold_value,
      name: "Buy & Hold",
      type: "scatter", mode: "lines",
      line: { color: BENCH_COLOR, width: 2, dash: "dot" },
    },
  ];

  const layout = {
    ...BASE_LAYOUT,
    margin: { t: 10, r: 20, b: 55, l: 80 },
    yaxis:  { ...BASE_LAYOUT.yaxis, tickprefix: "$", tickformat: ",.0f" },
    height: 400,
  };

  Plotly.newPlot("chart-portfolio", traces, layout, PLOTLY_CONFIG);
}


function renderPriceChart(data) {
  const traces = [
    {
      x: data.dates, y: data.close,
      name: "Close Price",
      type: "scatter", mode: "lines",
      line: { color: "#9C6240", width: 1.4, opacity: 0.75 },
    },
    {
      x: data.dates, y: data.sma_short,
      name: `SMA${data.short_window} (Fast)`,
      type: "scatter", mode: "lines",
      line: { color: STRAT_COLOR, width: 2 },
    },
    {
      x: data.dates, y: data.sma_long,
      name: `SMA${data.long_window} (Slow)`,
      type: "scatter", mode: "lines",
      line: { color: BENCH_COLOR, width: 2 },
    },
  ];

  const layout = {
    ...BASE_LAYOUT,
    yaxis:  { ...BASE_LAYOUT.yaxis, tickprefix: "$" },
    height: 320,
  };

  Plotly.newPlot("chart-price", traces, layout, PLOTLY_CONFIG);
}


function renderDrawdownChart(data) {
  const traces = [
    {
      x: data.dates, y: data.strategy_drawdown,
      name: `SMA${data.short_window}/${data.long_window}`,
      type: "scatter", mode: "lines",
      line:     { color: STRAT_COLOR, width: 2 },
      fill:     "tozeroy",
      fillcolor: STRAT_FILL,
    },
    {
      x: data.dates, y: data.buy_hold_drawdown,
      name: "Buy & Hold",
      type: "scatter", mode: "lines",
      line:     { color: BENCH_COLOR, width: 2 },
      fill:     "tozeroy",
      fillcolor: BENCH_FILL,
    },
  ];

  const layout = {
    ...BASE_LAYOUT,
    yaxis: { ...BASE_LAYOUT.yaxis, ticksuffix: "%" },
    height: 320,
  };

  Plotly.newPlot("chart-drawdown", traces, layout, PLOTLY_CONFIG);
}


function renderBarCharts(data) {
  const a   = data.analytics;
  const labels = [`SMA${data.short_window}/${data.long_window}`, "Buy & Hold"];
  const BAR_CONFIG = { staticPlot: false, displayModeBar: false, responsive: false };

  // ── Max Drawdown ──────────────────────────────────────────
  const ddVals = [
    Math.abs(a.strategy_max_dd ?? 0),
    Math.abs(a.buy_hold_max_dd ?? 0),
  ];

  Plotly.newPlot("chart-dd-bar", [{
    x: labels,
    y: ddVals,
    type: "bar",
    marker: { color: [STRAT_COLOR, BENCH_COLOR] },
    text: ddVals.map(v => v.toFixed(2) + "%"),
    textposition: "inside",
    insidetextanchor: "middle",
    textfont: { size: 15, color: "#031A0D", family: "IBM Plex Mono, monospace" },
    width: [0.4, 0.4],
    hovertemplate: "%{x}<br>%{y:.2f}%<extra></extra>",
  }], {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "transparent",
    font:  { family: "Inter, sans-serif", color: "#787B86" },
    margin: { t: 16, r: 20, b: 48, l: 60 },
    height: 280,
    xaxis: { fixedrange: true, gridcolor: "#222222", linecolor: "#262626", tickfont: { size: 12, color: "#6E6E6E" } },
    yaxis: { ticksuffix: "%", gridcolor: "#222222", linecolor: "#262626", rangemode: "tozero", tickfont: { size: 11, color: "#6E6E6E" }, zerolinecolor: "#333333" },
    showlegend: false,
    hovermode: "closest",
    hoverlabel: { bgcolor: "#1A1A1A", bordercolor: "#333333", font: { size: 12, color: "#E8E8E8", family: "DM Sans" } },
  }, BAR_CONFIG);

  // ── Sharpe Ratio ──────────────────────────────────────────
  const shVals = [
    a.strategy_sharpe ?? 0,
    a.buy_hold_sharpe ?? 0,
  ];

  Plotly.newPlot("chart-sharpe-bar", [{
    x: labels,
    y: shVals,
    type: "bar",
    marker: { color: [STRAT_COLOR, BENCH_COLOR] },
    text: shVals.map(v => v.toFixed(2)),
    textposition: "inside",
    insidetextanchor: "middle",
    textfont: { size: 15, color: "#031A0D", family: "IBM Plex Mono, monospace" },
    width: [0.4, 0.4],
    hovertemplate: "%{x}<br>Sharpe: %{y:.3f}<extra></extra>",
  }], {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "transparent",
    font:  { family: "Inter, sans-serif", color: "#787B86" },
    margin: { t: 16, r: 20, b: 48, l: 60 },
    height: 280,
    xaxis: { fixedrange: true, gridcolor: "#222222", linecolor: "#262626", tickfont: { size: 12, color: "#6E6E6E" } },
    yaxis: { gridcolor: "#222222", linecolor: "#262626", rangemode: "tozero", tickfont: { size: 11, color: "#6E6E6E" }, zerolinecolor: "#333333" },
    showlegend: false,
    hovermode: "closest",
    hoverlabel: { bgcolor: "#1A1A1A", bordercolor: "#333333", font: { size: 12, color: "#E8E8E8", family: "DM Sans" } },
  }, BAR_CONFIG);
}


// ================================================================
// PARAMETER OPTIMIZATION
// ================================================================
document.getElementById("optimize-btn").addEventListener("click", runOptimize);

async function runOptimize() {
  if (!currentParams) return showError("Run a backtest first before optimizing.");

  showLoading("Scanning 150 parameter combinations…");

  try {
    const res  = await fetch("/api/optimize", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker:     currentParams.ticker,
        start_date: currentParams.start_date,
        end_date:   currentParams.end_date,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) return showError(data.error || "Optimization failed.");

    renderHeatmap(data);
  } catch (_) {
    showError("Network error during optimization.");
  } finally {
    hideLoading();
  }
}


function renderHeatmap(data) {
  // Find best combo
  let bestVal = -Infinity, bestSW = null, bestLW = null;
  data.grid.forEach((row, i) => {
    row.forEach((val, j) => {
      if (val !== null && val > bestVal) {
        bestVal = val;
        bestSW  = data.short_windows[i];
        bestLW  = data.long_windows[j];
      }
    });
  });

  // Compute min/max for text contrast decisions
  const allVals = data.grid.flat().filter(v => v !== null);
  const zMin = Math.min(...allVals);
  const zMax = Math.max(...allVals);
  const zRange = zMax - zMin || 1;

  // Build per-cell annotations: value in every valid cell, star on best
  const annotations = [];
  data.grid.forEach((row, i) => {
    row.forEach((val, j) => {
      if (val === null) return;
      const norm = (val - zMin) / zRange;           // 0 = darkest red, 1 = darkest green
      // use white text on dark ends, dark brown on light middle
      const textColor = (norm < 0.28 || norm > 0.72) ? "#FFFFFF" : "#0D1020";
      const isBest = (data.short_windows[i] === bestSW && data.long_windows[j] === bestLW);
      annotations.push({
        x:          data.long_windows[j],
        y:          data.short_windows[i],
        text:       isBest ? `<b>${val.toFixed(2)}</b>` : val.toFixed(2),
        font:       { size: 10, color: textColor, family: "JetBrains Mono, monospace" },
        showarrow:  false,
        xref:       "x",
        yref:       "y",
      });
    });
  });

  // Add a subtle ring around the best cell
  if (bestSW !== null) {
    annotations.push({
      x:          bestLW,
      y:          bestSW,
      text:       "★",
      font:       { size: 14, color: "#FFD700", family: "Inter" },
      showarrow:  false,
      xanchor:    "left",
      yanchor:    "bottom",
      xshift:     18,
      yshift:     10,
    });
  }

  const trace = {
    z:    data.grid,
    x:    data.long_windows,
    y:    data.short_windows,
    type: "heatmap",
    zmin: zMin,
    zmax: zMax,
    colorscale: [
      [0.00, "#6B1A1A"],
      [0.18, "#C0392B"],
      [0.35, "#E67E22"],
      [0.50, "#F5CBA7"],
      [0.65, "#A9DFBF"],
      [0.82, "#27AE60"],
      [1.00, "#145A32"],
    ],
    colorbar: {
      title:        { text: "Sharpe Ratio", font: { size: 12, color: "#787B86" }, side: "right" },
      tickfont:     { size: 11, color: "#787B86" },
      thickness:    16,
      len:          0.85,
      outlinewidth: 0,
    },
    hoverongaps: false,
    hovertemplate: "<b>Fast MA:</b> %{y} days<br><b>Slow MA:</b> %{x} days<br><b>Sharpe:</b> %{z:.3f}<extra></extra>",
    zsmooth: false,
    showscale: true,
    xgap: 2,
    ygap: 2,
  };

  const layout = {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "rgba(18, 18, 18, 0.7)",
    font:  { family: "DM Sans, sans-serif", color: "#A8A8A8", size: 12 },
    annotations,
    xaxis: {
      title:      { text: "Slow MA Window (Days)", font: { size: 12, color: "#787B86" }, standoff: 12 },
      tickfont:   { size: 11, color: "#787B86" },
      gridcolor:  "transparent",
      linecolor:  "#2A2E45",
      tickvals:   data.long_windows,
      ticktext:   data.long_windows.map(String),
      fixedrange: true,
    },
    yaxis: {
      title:      { text: "Fast MA Window (Days)", font: { size: 12, color: "#787B86" }, standoff: 12 },
      tickfont:   { size: 11, color: "#787B86" },
      gridcolor:  "transparent",
      linecolor:  "#2A2E45",
      tickvals:   data.short_windows,
      ticktext:   data.short_windows.map(String),
      fixedrange: true,
    },
    height: 580,
    margin: { t: 24, r: 90, b: 72, l: 80 },
    hovermode: "closest",
    hoverlabel: {
      bgcolor:     "#1C2235",
      bordercolor: "#2A2E45",
      font: { size: 13, color: "#D1D4DC", family: "Inter, sans-serif" },
    },
  };

  document.getElementById("heatmap-sub").textContent =
    `${currentParams.ticker}  ·  ${currentParams.start_date} → ${currentParams.end_date}`;

  const heatSec = document.getElementById("heatmap-section");
  heatSec.classList.remove("hidden");
  Plotly.newPlot("chart-heatmap", [trace], layout, { ...PLOTLY_CONFIG, responsive: true });

  if (bestSW !== null) {
    document.getElementById("optimal-text").textContent =
      `Fast MA = ${bestSW} days,  Slow MA = ${bestLW} days  →  Sharpe = ${bestVal.toFixed(3)}`;
    document.getElementById("optimal-banner").classList.remove("hidden");
  }

  setTimeout(() => heatSec.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}


// ================================================================
// HELPERS
// ================================================================
function animCount(id, to, fmt, duration = 900) {
  if (to == null) return;
  const el   = document.getElementById(id);
  const start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = fmt(to * e);
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function setDelta(id, val, fmt) {
  const el = document.getElementById(id);
  el.textContent  = fmt(val);
  el.className    = "stat-delta " + (val >= 0 ? "c-positive" : "c-negative");
}

function showLoading(msg) {
  document.getElementById("loading-text").textContent = msg;
  document.getElementById("loading-overlay").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

function showError(msg) {
  hideLoading();
  document.getElementById("error-message").textContent = msg;
  document.getElementById("error-banner").classList.remove("hidden");
  setTimeout(() => document.getElementById("error-banner").classList.add("hidden"), 7000);
}

function hideError() {
  document.getElementById("error-banner").classList.add("hidden");
}
