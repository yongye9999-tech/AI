import type {
  BacktestMetrics,
  BacktestResult,
  BacktestTrade,
  KlineBar,
  StrategyConfig,
} from "@ai-trading/shared";
import { generateSignals } from "@ai-trading/signals";

export interface BacktestOptions {
  symbol: string;
  bars: KlineBar[];
  config: StrategyConfig;
  initialEquity?: number;
  holdBars?: number;
  trainRatio?: number;
}

function computeMetrics(
  trades: BacktestTrade[],
  equityCurve: Array<{ time: number; equity: number }>,
  initialEquity: number,
): BacktestMetrics {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;

  const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const finalEquity = equityCurve.at(-1)?.equity ?? initialEquity;
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    const curr = equityCurve[i]!.equity;
    if (prev > 0) returns.push((curr - prev) / prev);
  }

  const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdReturn = Math.sqrt(
    returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / (returns.length || 1),
  );
  const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  let peak = initialEquity;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    const dd = (peak - point.equity) / peak;
    maxDrawdown = Math.max(maxDrawdown, dd);
  }

  const days =
    equityCurve.length > 1
      ? (equityCurve.at(-1)!.time - equityCurve[0]!.time) / (86400 * 1000)
      : 1;
  const years = Math.max(days / 365, 1 / 365);
  const cagr = Math.pow(finalEquity / initialEquity, 1 / years) - 1;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  return {
    totalTrades,
    winRate,
    profitFactor: Math.min(profitFactor, 999),
    sharpe,
    maxDrawdown,
    cagr,
    calmar,
    finalEquity,
  };
}

function runOnBars(
  symbol: string,
  bars: KlineBar[],
  config: StrategyConfig,
  initialEquity: number,
  holdBars: number,
): { trades: BacktestTrade[]; equityCurve: Array<{ time: number; equity: number }> } {
  const trades: BacktestTrade[] = [];
  let equity = initialEquity;
  const equityCurve: Array<{ time: number; equity: number }> = [{ time: bars[0]?.openTime ?? 0, equity }];
  let inPosition = false;
  let entryBar = 0;
  let entryPrice = 0;
  let qty = 0;

  for (let i = 48; i < bars.length; i++) {
    const window = bars.slice(Math.max(0, i - 48), i + 1);
    const current = bars[i]!;
    const open24hBar = bars[Math.max(0, i - 24)]!;
    const return24h = (current.close - open24hBar.open) / open24hBar.open;

    const vol48 = window.slice(-48).reduce((a, b) => a + b.quoteVolume, 0);
    const historical48: number[] = [];
    for (let j = 48; j <= window.length; j++) {
      historical48.push(window.slice(j - 48, j).reduce((a, b) => a + b.quoteVolume, 0));
    }
    const sorted = [...historical48].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? vol48;
    const volumeSurge = median > 0 ? vol48 / median : 1;

    if (inPosition) {
      if (i - entryBar >= holdBars || current.low <= entryPrice * (1 - config.risk.defaultStopLossPct)) {
        const exitPrice =
          current.low <= entryPrice * (1 - config.risk.defaultStopLossPct)
            ? entryPrice * (1 - config.risk.defaultStopLossPct)
            : current.close;
        const pnl = (exitPrice - entryPrice) * qty;
        equity += pnl;
        trades.push({
          symbol,
          side: "LONG",
          entryTime: bars[entryBar]!.openTime,
          exitTime: current.openTime,
          entryPrice,
          exitPrice,
          qty,
          pnl,
          pnlPct: (exitPrice - entryPrice) / entryPrice,
        });
        inPosition = false;
      }
    }

    if (!inPosition) {
      const signals = generateSignals({
        markets: [
          {
            symbol,
            lastPrice: current.close,
            open24h: open24hBar.open,
            return24h,
            quoteVolume24h: window.slice(-24).reduce((a, b) => a + b.quoteVolume, 0),
            volumeSurge,
            timestamp: new Date(current.openTime),
          },
        ],
        sentiment: [],
        config,
      });

      if (signals.length > 0) {
        const riskUsd = Math.min(
          config.risk.maxLossPerTradeUsd,
          equity * config.risk.maxRiskPerTradePct,
        );
        entryPrice = current.close * (1 + config.execution.slippageBps / 10_000);
        qty = riskUsd / (entryPrice * config.risk.defaultStopLossPct);
        inPosition = true;
        entryBar = i;
        equity -= entryPrice * qty * config.execution.takerFeePct;
      }
    }

    equityCurve.push({ time: current.openTime, equity });
  }

  return { trades, equityCurve };
}

export function runBacktest(options: BacktestOptions): BacktestResult {
  const {
    symbol,
    bars,
    config,
    initialEquity = 10_000,
    holdBars = 12,
    trainRatio = 0.7,
  } = options;

  const splitIdx = Math.floor(bars.length * trainRatio);
  const trainBars = bars.slice(0, splitIdx);
  const testBars = bars.slice(splitIdx);

  const full = runOnBars(symbol, bars, config, initialEquity, holdBars);
  const metrics = computeMetrics(full.trades, full.equityCurve, initialEquity);

  let trainMetrics: BacktestMetrics | undefined;
  let testMetrics: BacktestMetrics | undefined;

  if (trainBars.length > 48) {
    const train = runOnBars(symbol, trainBars, config, initialEquity, holdBars);
    trainMetrics = computeMetrics(train.trades, train.equityCurve, initialEquity);
  }
  if (testBars.length > 48) {
    const test = runOnBars(symbol, testBars, config, initialEquity, holdBars);
    testMetrics = computeMetrics(test.trades, test.equityCurve, initialEquity);
  }

  return {
    metrics,
    trades: full.trades,
    equityCurve: full.equityCurve,
    trainMetrics,
    testMetrics,
  };
}

export function passesBacktestGate(result: BacktestResult): boolean {
  const test = result.testMetrics ?? result.metrics;
  return (
    test.totalTrades >= 10 &&
    test.sharpe > 0.5 &&
    test.maxDrawdown < 0.25
  );
}
