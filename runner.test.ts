import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KlineBar, StrategyConfig } from "@ai-trading/shared";
import { runBacktest, passesBacktestGate } from "./runner.js";

const config: StrategyConfig = {
  mode: "paper",
  sentiment: { windowHours: 12, minUniqueAuthors: 5, botDownweight: 0.5 },
  market: {
    minQuoteVolume24hUsd: 1_000_000,
    volumeSurgeThreshold: 1.5,
    maxChaseReturn24h: 0.15,
    maxReturn24hForH2: 0.08,
  },
  signal: { scoreThreshold: 40, minReturn24hLong: 0.01 },
  risk: {
    maxLossPerTradeUsd: 200,
    maxDailyLossUsd: 600,
    maxOpenPositions: 3,
    maxLeverage: 5,
    maxRiskPerTradePct: 0.02,
    cooldownMinutes: 30,
    defaultStopLossPct: 0.05,
  },
  execution: { slippageBps: 5, takerFeePct: 0.0004 },
};

function syntheticBars(count: number): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const surge = i > count * 0.6 && i < count * 0.65 ? 5 : 1;
    const change = (Math.random() - 0.48) * 0.02;
    price *= 1 + change;
    bars.push({
      openTime: Date.now() - (count - i) * 3600_000,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000 * surge,
      quoteVolume: 100_000 * surge,
    });
  }
  return bars;
}

describe("backtest runner", () => {
  it("runs backtest and produces metrics", () => {
    const result = runBacktest({
      symbol: "TESTUSDT",
      bars: syntheticBars(200),
      config,
    });

    assert.ok(result.metrics);
    assert.ok(typeof result.metrics.sharpe === "number");
    assert.ok(result.equityCurve.length > 0);
  });

  it("evaluates backtest gate", () => {
    const result = runBacktest({
      symbol: "TESTUSDT",
      bars: syntheticBars(100),
      config,
    });
    assert.equal(typeof passesBacktestGate(result), "boolean");
  });
});
