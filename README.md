# AI Trading Stack

Objective, rule-based trading research platform inspired by [Binance sentiment + momentum strategies](https://www.youtube.com/watch?v=mX6lXiJe_24). **Paper trading by default** — not a get-rich-quick bot.

## Features

- **Binance Square** sentiment collection (Playwright + bot heuristics)
- **Market data** via official Binance Futures API (volume surge, momentum)
- **Rule signal engine** H1 (sentiment) + H2 (volume) with composite scoring
- **Risk engine** — fixed USD loss per trade, daily limits, cooldowns
- **Paper / approve execution** modes
- **Walk-forward backtest** with Sharpe / MaxDD gates
- **Next.js dashboard** — signals, square radar, backtest, Polymarket explorer
- **MCP server** for Hermes Agent integration

## Quick Start

```bash
# Install dependencies
pnpm install --ignore-scripts

# Copy env and push DB schema
cp .env.example .env
pnpm db:push

# Build all packages
pnpm build

# Offline demo (no Binance network required)
pnpm demo

# Run API + Web (two terminals)
pnpm --filter @ai-trading/api dev
pnpm --filter @ai-trading/web dev
```

- API: http://localhost:3001
- Web: http://localhost:3000

## Offline Demo

Runs synthetic market + square data through signal engine, risk, paper execution, and backtest:

```bash
pnpm build
pnpm demo
```

Output saved to `data/demo.db`.

## Run Pipeline (live)

Requires Binance API access and Playwright (`pnpm --filter @ai-trading/collector-square exec playwright install chromium`):

```bash
curl -X POST http://localhost:3001/api/pipeline/run
```

## Backtest

```bash
curl -X POST http://localhost:3001/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT"}'
```

## Hermes MCP

See [configs/HERMES.md](configs/HERMES.md) for full setup. Quick config in [configs/hermes-mcp.json](configs/hermes-mcp.json):

```json
{
  "mcpServers": {
    "ai-trading": {
      "command": "node",
      "args": ["D:/AI/mcp-server/dist/index.js"],
      "env": { "API_URL": "http://localhost:3001" }
    }
  }
}
```

Build MCP first: `pnpm --filter @ai-trading/mcp-server build`

Tools: `get_latest_signals`, `run_backtest`, `explain_symbol_sentiment`, `list_polymarket_markets`, `run_signal_pipeline`, `get_portfolio`

## Architecture

```
collector-square ─┐
collector-market ─┼─► signals ─► risk ─► execution ─► db
                  │                              ▲
                  └──────── backtest ────────────┘
                         API ◄── Web / MCP
```

## Disclaimer

- Past backtest performance does not guarantee future results
- Binance Square scraping may violate ToS — use at your own risk, low frequency only
- Polymarket availability varies by jurisdiction
- Never enable `live` mode without testnet validation
