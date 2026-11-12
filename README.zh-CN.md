# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)

[English](README.md) | 简体中文

Fidere 是一个跑在浏览器里的小型 agent 工作台。它基于 [pi coding agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent)（大家一般就叫它 **pi agent**）的 SDK 构建，所以 agent 能读写文件、执行命令，并实时显示思考和工具调用——同时不会把框架、打包器或第二个服务拖到你的机器上。

![Fidere 对话界面](docs/screenshot-chat.jpg)

- **小，而且没有多余的外部包** —— 只依赖 pi SDK 一个包；前端零框架、无打包器、不引 CDN。约 8,300 行原生 JS/CSS，`node scripts/start.mjs` 就是全部运行链路。
- **看到过程，不只看结论** —— 思考和工具调用实时出现在对话里，回复结束后自动折叠，单条可再展开。
- **看得到花多少钱** —— 每条回复都带 token 用量，并按实际调用的端点取供应商官方价，不是一张静态价目表。
- **不会背着你用贵模型** —— 新会话从你看得见、改得动的模型开始；重开旧会话时模型被悄悄换掉，会在对话上方明确提示。

![模型选择面板与已保存的默认模型](docs/screenshot-models.jpg)

## 主要功能

- 在浏览器里和 agent 对话，实时显示思考过程和工具调用
- 每条回复可单独折叠/展开思考过程和工具调用；回复结束后自动折叠，只看问答正文
- 右侧对话刻度：点一下就能回到之前的某次输入
- 看历史时页面不会被新输出拉走；想继续看最新内容时再回到最新位置
- 管理会话、切换模型、上传图片和文件
- 指定新会话使用的模型（模型面板里的 `set default`），重开旧会话时若模型被替换会在对话上方提示
- 查看每条回复的时间、token 用量和费用（供应商官方价，含人民币估算）
- 编辑之前发过的消息并在新分支上重新提交；复制回复、重试被拒绝的请求；流中断后自动恢复
- macOS 长任务运行期间可选择阻止空闲休眠

## 快捷键

| 快捷键 | 作用 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift+Enter` | 在输入框内换行 |
| `/` | 打开命令面板（命令、模型、技能、提示模板） |
| `↑` / `↓` | 在命令面板结果中上下移动 |
| `Tab` / `Enter` | 选中当前命令面板项 |
| `Esc` | 关闭命令面板或恢复会话弹窗 |
| `↑` / `↓`、`Home` / `End` | 右侧对话刻度获得焦点时，在之前的输入之间跳转 |

## 环境要求

- Node.js **22.19 或更高版本**
- 一个支持的大模型 API Key（Anthropic、OpenAI、Google、DeepSeek、OpenRouter、Moonshot、MiniMax、xAI、Groq、Mistral 等）

## 安装和启动

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
npm start
```

然后打开 <http://localhost:3000>，用启动时打印的访问令牌登录（令牌也保存在 `~/.pi/agent/fidere-token`）。会话 Cookie 有效期 30 天；完整参数见下面的「访问令牌」一节。

每次启动时，`npm start` 会检查 npm 上是否有新的 pi SDK。在交互式终端里会询问是否更新；选择更新后会先安装新版本，再启动服务。非交互环境（后台/服务管理）只打印可更新版本，不会阻塞启动。设置 `FIDERE_SDK_UPDATE=off` 可跳过检查，`FIDERE_SDK_UPDATE=auto` 可自动更新。

`npm run setup` 会列出常用模型服务商，选择后输入 API Key 即可。它只依赖安装 Fidere 时一起装好的依赖，**不需要另外安装 pi CLI**。Key 会保存到 `~/.pi/agent/auth.json`。

启动后，在左下角的模型选择器里选一个模型。不选的话，依次使用已保存的默认模型、Fidere 自己的推荐（见下文），最后才是 SDK 的 provider 默认表。

### 用环境变量配置（可选）

不想用交互式 setup 的话，也可以直接设置环境变量：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`DEEPSEEK_API_KEY` 等环境变量同样可用，不需要安装 pi CLI。

修改端口：

```bash
PORT=8080 npm start
```

## 常见问题

- **价格从哪来？** Fidere 按模型实际调用的地址（baseUrl）定价：调用 `api.deepseek.com` 的模型使用 DeepSeek 官网峰谷价（中文环境用中文页/人民币，其他环境用英文页/美元；可用 `FIDERE_PRICE_CURRENCY=CNY|USD` 强制），调用 `openrouter.ai` 的模型使用 OpenRouter 官方按 token 价格，调用 `open.bigmodel.cn` 的模型使用智谱官方定价文档（人民币）；调用 `api.anthropic.com`、`api.moonshot.cn`、`dashscope.aliyuncs.com`、`router.huggingface.co` 的模型也会使用各自官网价格页/API；其他地址使用你在 `models.json` 中为该 provider 配置的 `cost`（代理/第三方网关按其自己的价格），SDK 内置价作为最后兜底。价格保留供应商币种（DeepSeek 中文环境、GLM、Moonshot、Aliyun 为人民币；OpenRouter、Anthropic、HuggingFace 及非中文环境的 DeepSeek 为美元）；美元价格在提示里按 7.2 的固定汇率估算人民币（可用 `localStorage.setItem('fidere-usd-cny', '7.30')` 调整）。服务启动时就开始检查；检查失败的保留上一版缓存，最新列表里没有的模型保留上次官方价，只有两者都没有时才用 SDK 价。缓存位于 `~/.pi/agent/fidere-prices.json`；设置 `FIDERE_PRICES=off` 可关闭。状态查看：`GET /api/prices`。
- **模型列表是空的？** 先运行 `npm run setup`，或者设置一个 provider 的环境变量，然后重启服务。
- **新会话默认用哪个模型？** 依次看：`~/.pi/agent/settings.json` 里的 `defaultProvider`/`defaultModel`，然后是 Fidere 自己的推荐表（目前只有 DeepSeek → `deepseek-flash`），最后才是 SDK 内置的 provider 默认表。`npm run setup` 会把推荐模型写进 settings；模型选择面板里每行右侧的 **set default** 也能随时改，选中行的 **default** 标记就是新会话会用的模型。之所以要这一层：SDK 表把 DeepSeek 默认成 `deepseek-v4-pro`，输入价是 `deepseek-flash` 的 4.4 倍且不支持图片，新装时容易一上来就烧钱。
- **访问令牌：** 所有 API 都需要令牌。它来自 `FIDERE_TOKEN`，没有就首次启动时生成到 `~/.pi/agent/fidere-token`（权限 0600，启动日志会打出路径）。首次登录用 `/#token=<令牌>` 或直接在登录页粘贴——fragment 不会发给服务器，也不进反代日志。会话 Cookie 为 `HttpOnly` + `SameSite=Strict`，有效期 30 天（`FIDERE_SESSION_MAX_AGE`，单位秒）。写操作还需带上双重提交的 CSRF 令牌，前端会自动发送；脚本可以用 `Authorization: Bearer <令牌>` 代替。`FIDERE_COOKIE_SECURE=auto|on|off` 控制 Cookie 的 `Secure` 标记（默认读 `X-Forwarded-Proto`）。`FIDERE_AUTH=off` 可关闭认证，仅限别人碰不到的机器。
- **想从别的电脑访问？** 服务默认只监听 `127.0.0.1`。不要直接暴露到公网；请放在带 TLS 的反向代理或私有隧道后面。`HOST=0.0.0.0` 只适合可信局域网。
- **Mac 合盖后任务会停？** 服务在任务运行期间可以阻止空闲休眠，但合盖睡眠无法完全避免，除非使用合盖模式。需要无人值守长任务时，建议放在常开的机器上。
- **Key 存在哪里？** `~/.pi/agent/auth.json`。API Key 不会写进这个仓库。

## 开发

架构、测试、API 端点和 SDK 升级说明见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
