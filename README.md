# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)

English | [简体中文](README.zh-CN.md)

Fidere is a small agent workspace that runs in your browser. It is built on the [pi coding agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) SDK (usually just called **pi agent**), so the agent can read and write files, run commands, and stream its thinking and tool calls live — without dragging a framework, a bundler or a second service onto your machine.

![Fidere conversation view](docs/screenshot-chat.jpg)

- **Small on purpose** — one dependency (the pi SDK), no frontend framework, no bundler, no CDN. ~8,300 lines of plain JS/CSS, and `node scripts/start.mjs` is the entire run path.
- **Streams the work, not just the answer** — thinking and tool calls appear inline, fold when a reply finishes, and can be reopened per reply.
- **Shows what it costs** — every reply carries token usage and the vendor's own price for the endpoint it actually used, not a static rate card.
- **Never picks an expensive model behind your back** — new sessions start on a model you can see and change, and a silent model swap on a reopened session is announced above the transcript.

![Model picker with a saved default](docs/screenshot-models.jpg)

## What you can do

- Chat with the agent in the browser and watch thinking/tool calls as they happen
- Collapse or expand each reply's thinking and tool calls; finished replies fold automatically
- Jump back to earlier prompts with the timeline on the right
- Read history without being pulled to the bottom; return to the latest output when you are ready
- Manage sessions, switch models, and attach images or files
- Pick the model new sessions start on (`set default` in the picker) and see a notice when a reopened session had to change models
- See each reply's timestamp, token usage and cost (vendor prices, with an estimated CNY conversion)
- Edit an earlier message and resend it on a new branch, copy replies, retry rejected prompts, and recover after a dropped stream
- Keep a Mac awake during long tasks (optional)

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send the message |
| `Shift+Enter` | Insert a new line in the composer |
| `/` | Open the command palette (commands, models, skills, prompt templates) |
| `↑` / `↓` | Move through palette results |
| `Tab` / `Enter` | Accept the selected palette item |
| `Esc` | Close the command palette or the resume-session dialog |
| `↑` / `↓`, `Home` / `End` | Jump between earlier prompts when the timeline on the right has focus |

## Requirements

- Node.js **22.19+**
- An API key from a supported provider (Anthropic, OpenAI, Google, DeepSeek, OpenRouter, Moonshot, MiniMax, xAI, Groq, Mistral, and others)

## Install and run

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
npm start
```

Open <http://localhost:3000> and sign in with the access token printed on startup (it is also stored in `~/.pi/agent/fidere-token`). The session cookie lasts 30 days; see **Access control** below for the full list of options.

On each start, `npm start` asks npm whether a newer pi SDK is published. In an interactive terminal it asks whether to update; choosing yes installs the new SDK before starting the server. In a non-interactive environment it only prints the available version and starts normally. Set `FIDERE_SDK_UPDATE=off` to skip the check, or `FIDERE_SDK_UPDATE=auto` to update without asking.

`npm run setup` asks you to choose a provider and enter its API key. It only needs the dependencies installed with Fidere — **you do not need to install the pi CLI**. The key is saved to `~/.pi/agent/auth.json`.

After starting, choose a model from the model selector in the lower-left corner. If you do not choose one, Fidere uses the saved default, then its own recommendation (see below), then the SDK's per-provider fallback.

### Use an environment variable instead

If you prefer not to use the interactive setup:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` and the other provider environment variables work too. No pi CLI is required.

Custom port:

```bash
PORT=8080 npm start
```

## Notes

- **Prices:** Fidere prices each model by the endpoint it is actually called through. Models on `api.deepseek.com` use DeepSeek's official peak/off-peak page in the matching currency (Chinese page/CNY for a `zh` locale, English page/USD otherwise; override with `FIDERE_PRICE_CURRENCY=CNY|USD`); models on `openrouter.ai` use OpenRouter's official per-token pricing; models on `open.bigmodel.cn` use Zhipu's GLM pricing docs (CNY); models on `api.anthropic.com`, `api.moonshot.cn`, `dashscope.aliyuncs.com` and `router.huggingface.co` use their official price pages/APIs as well. Every other endpoint uses the `cost` you configured for that provider in `models.json` (proxies and gateways keep their own price), with the SDK's bundled price as the last fallback. Prices keep the vendor's currency (CNY for DeepSeek in a zh locale, GLM, Moonshot and Aliyun; USD for OpenRouter, Anthropic and HuggingFace, and DeepSeek outside a zh locale); the CNY tooltip for USD prices is an estimate at 7.2 USD/CNY (`localStorage.setItem('fidere-usd-cny', '7.30')`). Checks start as the server boots; failed checks keep the previous cache, models missing from the latest vendor list keep their last official price, and only when neither exists does the SDK price apply. The cache is `~/.pi/agent/fidere-prices.json`; `FIDERE_PRICES=off` disables vendor fetching. Status: `GET /api/prices`.
- **No models?** Run `npm run setup` or set a provider environment variable, then restart the server.
- **Which model do new sessions start on?** `defaultProvider`/`defaultModel` from `~/.pi/agent/settings.json` first, then Fidere's own recommendation table (currently DeepSeek → `deepseek-flash`), then the SDK's built-in per-provider table. `npm run setup` writes the recommended model into settings, and **set default** on any row of the model picker changes it later; the **default** badge marks what new sessions will use. That override exists because the SDK table starts DeepSeek on `deepseek-v4-pro` — 4.4x the input price of `deepseek-flash` and text-only — which is a costly surprise on a fresh install.
- **Access control:** every API route needs an access token. It is read from `FIDERE_TOKEN`, or generated on first start into `~/.pi/agent/fidere-token` (mode 0600); the path is printed at startup. Sign in once by opening `/#token=<token>` or pasting it into the login overlay — the fragment never reaches the server or the proxy log. The session cookie is `HttpOnly`, `SameSite=Strict`, and lasts 30 days (`FIDERE_SESSION_MAX_AGE`, seconds). State-changing requests also need a double-submit CSRF token that the UI sends automatically; scripts may send `Authorization: Bearer <token>` instead. `FIDERE_COOKIE_SECURE=auto|on|off` controls the `Secure` flag (default: follow `X-Forwarded-Proto`). `FIDERE_AUTH=off` disables all of it — only for a machine nobody else can reach.
- **Remote access:** the server listens on `127.0.0.1` by default. Do not expose it directly to the internet. Use a reverse proxy with TLS, or a private tunnel. `HOST=0.0.0.0` is only for trusted networks.
- **Mac sleep:** the server can hold a `caffeinate` assertion during active tasks. Closing the lid still sleeps unless the Mac is in clamshell mode; for unattended long tasks, use an always-on machine.
- **Where are keys stored?** `~/.pi/agent/auth.json`. API keys are never written to this repository.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, tests, API endpoints and SDK upgrade notes.

## License

MIT. See [LICENSE](LICENSE).
