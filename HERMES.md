# Hermes Agent MCP 集成

将 [`configs/hermes-mcp.json`](hermes-mcp.json) 中的 `ai-trading` 服务合并到 Hermes 的 MCP 配置中。

## 前置条件

1. API 服务已启动：`pnpm --filter @ai-trading/api dev`
2. Hermes Agent 已安装：<https://hermes-agent.nousresearch.com/docs/>

## Windows 配置步骤

### 方式 A：Hermes Desktop / 配置文件

在 Hermes 的 MCP 配置（通常为 `%USERPROFILE%\.hermes\` 下的 MCP 相关配置）中加入：

```json
{
  "mcpServers": {
    "ai-trading": {
      "command": "pnpm",
      "args": ["--dir", "D:/AI/mcp-server", "dev"],
      "env": {
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```

若 `pnpm` 不在 PATH 中，改用 node 直接启动：

```json
{
  "mcpServers": {
    "ai-trading": {
      "command": "node",
      "args": ["D:/AI/mcp-server/dist/index.js"],
      "env": {
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```

先构建 MCP：`pnpm --filter @ai-trading/mcp-server build`

### 方式 B：命令行验证 MCP

```powershell
cd D:\AI\mcp-server
$env:API_URL = "http://localhost:3001"
pnpm dev
```

## 可用工具

| 工具 | 说明 |
|------|------|
| `get_latest_signals` | 最新规则引擎信号 |
| `run_backtest` | 对指定 symbol 跑 walk-forward 回测 |
| `explain_symbol_sentiment` | 币安广场舆情解读 |
| `list_polymarket_markets` | Polymarket 市场列表 |
| `run_signal_pipeline` | 触发完整采集+信号流水线 |
| `get_portfolio` | 纸面账户状态 |

## 示例对话

在 Hermes 中可尝试：

- 「调用 get_portfolio 看我的纸面账户」
- 「run_backtest symbol=BTCUSDT」
- 「explain_symbol_sentiment symbol=BTC」

## 安全说明

- MCP 仅调用本地 API，**不**直接持有 Binance API Key
- 默认 `paper` 模式，不会自动主网下单
- API Key 只放在服务端 `.env`，勿写入 Hermes 对话或 MCP env
