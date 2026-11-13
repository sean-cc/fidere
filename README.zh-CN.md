# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22.19+](https://img.shields.io/badge/node-%E2%89%A522.19-brightgreen.svg)](package.json)

[English](README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [繁體中文（香港）](README.zh-HK.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Русский](README.ru.md)

**一个常驻的助手：你不在的时候，它按时间表把活干完，而且交得了账。**

Fidere 是一个常驻的助手。平时你在浏览器里跟它聊天、问问题、把想到的事丢给它记着；需要的时候，它按时间表自己去干活——没人看着也能干完，干完告诉你结果，花超了预算会自己停下。

Fidere 是拉丁语里的 **"to trust"**。信任不来自更聪明的模型，来自三件很朴素的事：**做对了能验证，做错了能回滚，花了多少有账**。

![Fidere 对话界面](docs/screenshot-chat.jpg)

> **第一次来？** 直接跳到[快速开始](#快速开始)，大约五分钟就能从克隆跑到能用。

## 特色

### 小到可以自己读完

一个依赖：[pi coding agent](https://github.com/earendil-works/pi)——Fidere 把它当库用，你不需要自己装 `pi` CLI。没有前端框架、没有打包器、不引 CDN，约 8,300 行原生 JS/CSS。没有数据库、没有消息队列、没有第二个服务，`node scripts/start.mjs` 就是全部运行链路。工作流不是一套要学的新语法，就是你自己目录里的几个文件。

### 不为同一段历史反复付费

大多数自动化助手是一个永不下线的会话，每一轮都把全部历史重新发给模型——用得越久越慢、越贵。Fidere 反过来：

- **每个任务单独开一个会话，跑完就丢掉**，跨任务只交接一份几百字的摘要，不背着整段历史往前跑
- **不需要判断的步骤不经过模型**：抓取、格式转换、验收、发通知都是脚本，0 token
- **便宜模型做判断，贵的模型才动手**：路由、摘要、格式化用轻量模型，难题才升级
- **每个任务有预算上限**：超了立刻停，把做到哪、花了多少一起写进账本

### 模型说「做完了」不算数

每个任务都有一个可执行的验收判据，退出码不对就是没做完。失败按三级升级：同模型重试一次 → 换强一档的模型一次 → 通知你，然后停下——不会无声无息地转到天亮。重跑不会造成重复副作用（重复通知、重复下单）。每个任务的会话、命令、花费、结果都留痕，出问题能回放。

### 花费按真实端点算

每条回复都带 token 用量，并按模型**实际调用的地址**取供应商官方价——DeepSeek 的峰谷价、OpenRouter 的按 token 价、智谱、Moonshot、阿里云、Anthropic 各自的官网页面，不是一张静态价目表。代理和自建网关按你自己配置的价格算。[每个端点怎么定价 →](docs/pricing.md)

### 不会背着你换模型

新会话从你看得见、改得动的模型开始。重开旧会话时如果模型被替换，会在对话上方明确提示——被替换的模型可能贵好几倍，这件事不能只写在日志里。

## 功能

### 对话：想到什么说什么

- **连续会话** —— 可以一直聊下去；上下文快满时自动摘要压缩，不会突然失忆。
- **能打开的笔记** —— 想法、结论、待办记成你能打开、能改、能搜的 markdown，不是黑盒。
- **实时流式** —— 思考过程和工具调用实时显示，回复结束后自动折叠，单条可再展开。
- **刻度回跳** —— 右侧刻度点一下回到之前的某次提问；看历史时页面不会被新输出拉走。
- **分支重发与恢复** —— 编辑之前发过的消息并在新分支上重发；复制回复、重试被拒的请求、流中断后自动恢复。
- **会话与模型管理** —— 管理会话、切换模型、指定新会话的默认模型、上传图片和文件。
- **七种界面语言** —— 英文、简体中文、繁体中文（台湾 / 香港）、日文、韩文、俄文。
- **命令面板** —— 一个 `/` 搜命令、模型、技能、提示模板（见[快捷键](#快捷键)）。
- **让 Mac 别睡** —— 长任务期间可选地持有 `caffeinate`。

### 任务：不用你看着

- **按时间表跑** —— 每 N 分钟、每天某个时刻、或只在工作日。
- **硬预算** —— 超了就停，不会静默烧钱。
- **可执行验收** —— 模型自述完成只当线索，退出码说了算。
- **升级与通知** —— 同模型 → 换更强的模型 → 通知你后停下。
- **一个时刻只跑一次** —— 并提供稳定的 `FIDERE_RUN_KEY`，让工作流给外部副作用（下单、发信）判重。
- **账本与回执** —— 每天一条：跑了什么、成没成、花了多少。
- **补跑** —— 重启或睡醒后补跑错过的任务，回执里写明迟了多久。

### 工作流：一页说明加几个脚本

不画流程图，不学新语法，不装编排引擎。一个工作流就是一个目录：

```text
workflows/finance-daily/
├── SKILL.md       ← 给模型看的操作说明（散文）
├── fetch.mjs      ← 确定性的部分写成脚本，0 token
└── verify.mjs     ← 验收判据，退出码 0 才算完成
```

`SKILL.md` 顶部是一小段 frontmatter，交给 Fidere 的调度器读；下面是给模型读的正文：

```markdown
---
name: finance-daily
description: 每天早上汇总财经要闻，输出中文简报。
schedule: daily 08:00
budget: ¥0.4
verify: node verify.mjs
notify: echo "$FIDERE_TASK ok=$FIDERE_TASK_OK" >> notify.log   # any shell command
tools: read,write,bash
---

# 每日财经简报

1. 先运行 `node fetch.mjs`（不要自己写 curl），结果在 `out/raw.json`
2. 读 `out/raw.json`，挑出最可能影响指数的 5 条。
   公司层面的小新闻跳过。
3. 写成 `out/digest.md`：每条 2 句话，最后加一段「今天要盯什么」
4. 运行 `node verify.mjs` 自检

不要编造数字，`raw.json` 里没有的一律不写。
```

三层各管一件事：**frontmatter 给代码**（何时跑、花多少、怎么验收、通知谁），**正文给模型**（怎么做、什么重要、什么别做），**脚本给机器**（确定性的活）。领域内容全在你自己的目录里，Fidere 一行都不预设。

格式就是标准的 [Agent Skills](https://agentskills.io/specification)，你手上现成的 skill 可以直接放进 `workflows/` 变成定时任务，不用重写。

### 无人值守时的安全边界

聊天时出错你能当场看见；没人看着的时候，错误会持续一整晚。所以这里不靠提示词求模型「别乱来」，而是靠硬边界：

- **权限分档**：只读 / 只能写指定目录 / 可以执行任意命令。默认前两档，第三档要你自己显式打开
- **危险动作拦在工具层**：删除、强制推送、往外部上传、改认证文件，一律拦下并记录，不靠模型自觉
- **工作目录锁**：任务在自己的一次性目录里干活，目录外只读
- **全量留痕**：会话、命令、花费、结果全部落地，能回放

Fidere 默认只监听 `127.0.0.1`、单用户、只认一个访问令牌。它是给你自己跑的东西，不是多租户平台。

## 快速开始

### 环境要求

- Node.js **22.19 或更高版本**
- 一个支持的大模型 API Key（Anthropic、OpenAI、Google、DeepSeek、OpenRouter、Moonshot、MiniMax、xAI、Groq、Mistral 等）
- macOS、Linux、Windows 都行。只有两处是 macOS 专属：可选的防休眠（`npm run start:awake`）和长任务期间的 `caffeinate`；其余部分只要能跑 Node 就能跑。

### 1. 克隆并安装

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
```

`--ignore-scripts` 跳过 npm 的生命周期脚本，安装时什么都不执行——Fidere 也用不上它们。`npm run setup` 让你选服务商、填 API Key，保存到 `~/.pi/agent/auth.json`。**不需要另外安装 pi CLI**：它作为普通依赖装进来。

### 2. 启动

```bash
npm start
```

### 3. 打开并登录

打开 <http://localhost:3000>，粘贴启动时打印的访问令牌。令牌也保存在 `~/.pi/agent/fidere-token`（权限 `0600`）。会话 Cookie 有效期 30 天。

### 4. 选模型

在左下角的模型选择器里选一个。不选的话，依次使用已保存的默认模型、Fidere 自己的推荐（见[常见问题](#常见问题)），最后才是 pi 的 provider 默认表。

到这里就能聊了。也可以直接在 `workflows/` 下写第一个工作流。

## 安装与配置

上面的快速开始是推荐路径，其余都是可选项。

### 更新检查

每次启动时，`npm start` 会检查 npm 上是否有新的 pi 版本。在交互式终端里会询问是否更新；选择更新后会先安装新版本，再启动服务。非交互环境只打印可更新版本，不会阻塞启动。设置 `FIDERE_SDK_UPDATE=off` 可跳过检查，`auto` 可自动更新。

### 用环境变量代替 `npm run setup`

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`DEEPSEEK_API_KEY` 等同样可用，不需要安装 pi CLI。

### 端口与监听地址

```bash
PORT=8080 npm start          # 默认 3000
HOST=0.0.0.0 npm start       # 只用于可信网络，见下
```

### 访问控制

所有 API 都需要访问令牌：来自 `FIDERE_TOKEN`，没有就首次启动时生成到 `~/.pi/agent/fidere-token`。首次登录用 `/#token=<令牌>` 或直接在登录页粘贴——fragment 不会发给服务器，也不进反代日志。写操作还需带上双重提交的 CSRF 令牌，前端会自动发送。[完整参数 →](docs/access-control.md)

服务默认只监听 `127.0.0.1`。不要直接暴露到公网；请放在带 TLS 的反向代理或私有隧道后面。

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

## 常见问题

- **价格从哪来？** 每个模型按**实际调用的端点**、用供应商自己的币种定价：DeepSeek 官网峰谷价、OpenRouter 官方按 token 价、智谱的人民币页面，以及 Anthropic、Moonshot、阿里云、Hugging Face 各自公开的价格页 / API。其他地址使用你在 `models.json` 里为该 provider 配置的 `cost`，pi 内置价兜底。完整规则、汇率覆盖和缓存见 [docs/pricing.md](docs/pricing.md)。
- **模型列表是空的？** 先运行 `npm run setup`，或者设置一个 provider 的环境变量，然后重启服务。
- **新会话默认用哪个模型？** 依次看：`~/.pi/agent/settings.json` 里的 `defaultProvider`/`defaultModel`，然后是 Fidere 自己的推荐表（目前只有 DeepSeek → `deepseek-flash`），最后才是 pi 内置的 provider 默认表。`npm run setup` 会把推荐模型写进 settings；模型选择面板里每行右侧的 **set default** 也能随时改。之所以要这一层：pi 的表把 DeepSeek 默认成 `deepseek-v4-pro`，输入价是 `deepseek-flash` 的 4.4 倍且不支持图片，新装时容易一上来就烧钱。
- **Mac 合盖后任务会停？** 服务可以在任务运行期间阻止空闲休眠，但合盖睡眠无法完全避免，除非使用合盖模式。要真正 7×24，建议放在常开的机器上。
- **Key 存在哪里？** `~/.pi/agent/auth.json`。API Key 不会写进这个仓库。

## 开发

```bash
npm test          # 单元测试：价格、markdown、默认模型、SDK 检查、调度器
npm run smoke     # 无头 Chrome 的界面冒烟测试（需要 Chrome/Chromium）
npm run dev       # 以 node --watch 启动
npm run daemon    # 单独运行调度器（--list、--run <name>、--once）
```

架构、API 端点、本地化和 pi 版本升级说明见 [DEVELOPMENT.md](DEVELOPMENT.md)。

### 参与贡献

欢迎提交。做到下面几条，PR 会好合很多：

1. 比修 bug 大的改动先开 issue，把方案聊清楚再动手。
2. 保持朴素：不引入前端框架、打包器，也不加新的运行时依赖，除非确实绕不开。
3. 推送前跑 `npm test`；动过界面的再跑 `npm run smoke`。
4. PR 里写清改了什么、怎么验证的——一张截图或一个测试名就够了。

界面文案在 `public/i18n.js`，七种语言都要补齐，否则冒烟测试会挂。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
