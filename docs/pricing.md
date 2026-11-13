# How prices are resolved

Every reply carries its token usage and a price for the endpoint that was actually called. There is no single static rate card: the price depends on where the request went.

## Per-endpoint sources

| Endpoint | Price source |
|----------|--------------|
| `api.deepseek.com` | DeepSeek's official peak/off-peak page, in the matching currency (Chinese page/CNY for a `zh` locale, English page/USD otherwise) |
| `openrouter.ai` | OpenRouter's official per-token pricing |
| `open.bigmodel.cn` | Zhipu's official pages (CNY) |
| `api.anthropic.com` | Anthropic's published price page |
| `api.moonshot.cn` | Moonshot's published price page |
| `dashscope.aliyuncs.com` | Aliyun's published price page |
| `router.huggingface.co` | Hugging Face's official price API |
| Anything else | The `cost` you configured for that provider in `models.json` (proxies and gateways keep their own price), falling back to pi's bundled price |

## Currency

Prices keep the vendor's currency. The CNY figure shown for USD prices in the tooltip is an estimate at a fixed 7.2 USD/CNY rate. You can change that rate for local display:

```js
localStorage.setItem('fidere-usd-cny', '7.30')
```

To force which vendor page is used, set `FIDERE_PRICE_CURRENCY=CNY` or `FIDERE_PRICE_CURRENCY=USD`.

## Cache and settings

- Cache: `~/.pi/agent/fidere-prices.json`
- `FIDERE_PRICES=off` disables vendor price fetching entirely (configured `cost` values and pi's bundled prices still apply)
- Status: `GET /api/prices`
