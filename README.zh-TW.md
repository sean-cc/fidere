# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22.19+](https://img.shields.io/badge/node-%E2%89%A522.19-brightgreen.svg)](package.json)

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [繁體中文（香港）](README.zh-HK.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Русский](README.ru.md)

**一個常駐的助手：你不看的時候，它照時間表把活幹完，而且交得了帳。**

Fidere 是一個常駐的助手。平時你在瀏覽器裡跟它聊天、問問題、把想到的事丟給它記著；需要的時候，它按時間表自己去幹活——沒人看著也能幹完，幹完告訴你結果，花超了預算會自己停下來。

Fidere 是拉丁語裡的 **"to trust"**。信任不來自更聰明的模型，來自三件很樸素的事：**做對了能驗證，做錯了能回滾，花了多少有帳**。

![Fidere 對話介面](docs/screenshot-chat.jpg)

> **第一次來？** 直接跳到[快速開始](#快速開始)，大約五分鐘就能從複製專案跑到能用。

## 特色

### 小到可以自己讀完

一個依賴：[pi coding agent](https://github.com/earendil-works/pi)——Fidere 把它當函式庫用，你不需要自己裝 `pi` CLI。沒有前端框架、沒有打包器、不引用 CDN，約 8,300 行原生 JS/CSS。沒有資料庫、沒有訊息佇列、沒有第二個服務，`node scripts/start.mjs` 就是全部執行路徑。工作流程不是一套要學的新語法，就是你自己目錄裡的幾個檔案。

### 不為同一段歷史反覆付費

大多數自動化助手是一個永不下線的會話，每一輪都把全部歷史重新發給模型——用得越久越慢、越貴。Fidere 反過來：

- **每個任務單獨開一個會話，跑完就丟掉**，跨任務只交接一份幾百字的摘要，不背著整段歷史往前跑
- **不需要判斷的步驟不經過模型**：抓取、格式轉換、驗收、發通知都是腳本，0 token
- **便宜模型做判斷，貴的模型才動手**：路由、摘要、格式化用輕量模型，難題才升級
- **每個任務有預算上限**：超了立刻停，把做到哪、花了多少一起寫進帳本

### 模型說「做完了」不算數

每個任務都有一個可執行的驗收判據，退出碼不對就是沒做完。失敗按三級升級：同模型重試一次 → 換強一檔的模型一次 → 通知你，然後停下——不會無聲無息地轉到天亮。重跑不會造成重複副作用（重複通知、重複下單）。每個任務的會話、指令、花費、結果都留痕，出問題能回放。

### 花費按真實端點算

每條回覆都帶 token 用量，並按模型**實際呼叫的位址**取供應商官方價——DeepSeek 的峰谷價、OpenRouter 的按 token 價、智譜、Moonshot、阿里雲、Anthropic 各自的官網頁面，不是一張靜態價目表。代理和自建閘道按你自己設定的價格算。[每個端點怎麼定價 →](docs/pricing.md)

### 不會背著你換模型

新會話從你看得見、改得動的模型開始。重開舊會話時如果模型被替換，會在對話上方明確提示——被替換的模型可能貴好幾倍，這件事不能只寫在日誌裡。

## 功能

### 對話：想到什麼說什麼

- **連續會話** —— 可以一直聊下去；上下文快滿時自動摘要壓縮，不會突然失憶。
- **打得開的筆記** —— 想法、結論、待辦記成你能打開、能改、能搜的 markdown，不是黑盒。
- **即時串流** —— 思考過程和工具呼叫即時顯示，回覆結束後自動摺疊，單條可再展開。
- **刻度回跳** —— 右側刻度點一下回到之前的某次提問；看歷史時頁面不會被新輸出拉走。
- **分支重發與恢復** —— 編輯之前發過的訊息並在新分支上重發；複製回覆、重試被拒的請求、串流中斷後自動恢復。
- **會話與模型管理** —— 管理會話、切換模型、指定新會話的預設模型、上傳圖片和檔案。
- **七種介面語言** —— 英文、簡體中文、繁體中文（台灣 / 香港）、日文、韓文、俄文。
- **命令面板** —— 一個 `/` 搜命令、模型、技能、提示範本（見[快捷鍵](#快捷鍵)）。
- **讓 Mac 別睡** —— 長任務期間可選地持有 `caffeinate`。

### 任務：不用你看著

- **照時間表跑** —— 每 N 分鐘、每天某個時刻、或只在工作日。
- **硬預算** —— 超了就停，不會靜默燒錢。
- **可執行驗收** —— 模型自述完成只當線索，退出碼說了算。
- **升級與通知** —— 同模型 → 換更強的模型 → 通知你後停下。
- **一個時刻只跑一次** —— 並提供穩定的 `FIDERE_RUN_KEY`，讓工作流程給外部副作用（下單、發信）判重。
- **帳本與回執** —— 每天一條：跑了什麼、成沒成、花了多少。
- **補跑** —— 重啟或睡醒後補跑錯過的任務，回執裡寫明遲了多久。

### 工作流程：一頁說明加幾個腳本

不畫流程圖，不學新語法，不裝編排引擎。一個工作流程就是一個目錄：

```text
workflows/finance-daily/
├── SKILL.md       ← 給模型看的操作說明（散文）
├── fetch.mjs      ← 確定性的部分寫成腳本，0 token
└── verify.mjs     ← 驗收判據，退出碼 0 才算完成
```

`SKILL.md` 頂部是一小段 frontmatter，交給 Fidere 的排程器讀；下面是給模型讀的正文：

```markdown
---
name: finance-daily
description: 每天早上匯總財經要聞，輸出中文簡報。
schedule: daily 08:00
budget: ¥0.4
verify: node verify.mjs
notify: echo "$FIDERE_TASK ok=$FIDERE_TASK_OK" >> notify.log   # any shell command
tools: read,write,bash
---

# 每日財經簡報

1. 先執行 `node fetch.mjs`（不要自己寫 curl），結果在 `out/raw.json`
2. 讀 `out/raw.json`，挑出最可能影響指數的 5 條。
   公司層面的小新聞跳過。
3. 寫成 `out/digest.md`：每條 2 句話，最後加一段「今天要盯什麼」
4. 執行 `node verify.mjs` 自檢

不要編造數字，`raw.json` 裡沒有的一律不寫。
```

三層各管一件事：**frontmatter 給程式碼**（何時跑、花多少、怎麼驗收、通知誰），**正文給模型**（怎麼做、什麼重要、什麼別做），**腳本給機器**（確定性的活）。領域內容全在你自己的目錄裡，Fidere 一行都不預設。

格式就是標準的 [Agent Skills](https://agentskills.io/specification)，你手上現成的 skill 可以直接放進 `workflows/` 變成定時任務，不用重寫。

### 無人值守時的安全邊界

聊天時出錯你能當場看見；沒人看著的時候，錯誤會持續一整晚。所以這裡不靠提示詞求模型「別亂來」，而是靠硬邊界：

- **權限分檔**：唯讀 / 只能寫指定目錄 / 可以執行任意命令。預設前兩檔，第三檔要你自己顯式打開
- **危險動作攔在工具層**：刪除、強制推送、往外部上傳、改認證檔案，一律攔下並記錄，不靠模型自覺
- **工作目錄鎖**：任務在自己的一次性目錄裡幹活，目錄外唯讀
- **全量留痕**：會話、指令、花費、結果全部落地，能回放

Fidere 預設只監聽 `127.0.0.1`、單使用者、只認一個存取權杖。它是給你自己跑的東西，不是多租戶平台。

## 快速開始

### 環境要求

- Node.js **22.19 或更高版本**
- 一個支援的大模型 API Key（Anthropic、OpenAI、Google、DeepSeek、OpenRouter、Moonshot、MiniMax、xAI、Groq、Mistral 等）
- macOS、Linux、Windows 都行。只有兩處是 macOS 專屬：可選的防休眠（`npm run start:awake`）和長任務期間的 `caffeinate`；其餘部分只要能跑 Node 就能跑。

### 1. 複製並安裝

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
```

`--ignore-scripts` 跳過 npm 的生命週期腳本，安裝時什麼都不執行——Fidere 也用不上它們。`npm run setup` 讓你選服務商、填 API Key，儲存到 `~/.pi/agent/auth.json`。**不需要另外安裝 pi CLI**：它當作一般依賴裝進來。

### 2. 啟動

```bash
npm start
```

### 3. 打開並登入

打開 <http://localhost:3000>，貼上啟動時列印的存取權杖。權杖也儲存在 `~/.pi/agent/fidere-token`（權限 `0600`）。會話 Cookie 有效期 30 天。

### 4. 選模型

在左下角的模型選擇器裡選一個。不選的話，依序使用已儲存的預設模型、Fidere 自己的推薦（見[常見問題](#常見問題)），最後才是 pi 的 provider 預設表。

到這裡就能聊了。也可以直接在 `workflows/` 下寫第一個工作流程。

## 安裝與設定

上面的快速開始是推薦路徑，其餘都是可選項。

### 更新檢查

每次啟動時，`npm start` 會檢查 npm 上是否有新的 pi 版本。在互動式終端機裡會詢問是否更新；選擇更新後會先安裝新版本，再啟動服務。非互動環境只列印可更新版本，不會阻塞啟動。設定 `FIDERE_SDK_UPDATE=off` 可跳過檢查，`auto` 可自動更新。

### 用環境變數代替 `npm run setup`

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`DEEPSEEK_API_KEY` 等同樣可用，不需要安裝 pi CLI。

### 連接埠與監聽位址

```bash
PORT=8080 npm start          # 預設 3000
HOST=0.0.0.0 npm start       # 只用於可信網路，見下
```

### 存取控制

所有 API 都需要存取權杖：來自 `FIDERE_TOKEN`，沒有就首次啟動時產生到 `~/.pi/agent/fidere-token`。首次登入用 `/#token=<權杖>` 或直接在登入頁貼上——fragment 不會發給伺服器，也不進反向代理日誌。寫操作還需帶上雙重提交的 CSRF 權杖，前端會自動送出。[完整參數 →](docs/access-control.md)

服務預設只監聽 `127.0.0.1`。不要直接暴露到公網；請放在帶 TLS 的反向代理或私有通道後面。

## 快捷鍵

| 快捷鍵 | 作用 |
|--------|------|
| `Enter` | 傳送訊息 |
| `Shift+Enter` | 在輸入框內換行 |
| `/` | 打開命令面板（命令、模型、技能、提示範本） |
| `↑` / `↓` | 在命令面板結果中上下移動 |
| `Tab` / `Enter` | 選取目前的命令面板項目 |
| `Esc` | 關閉命令面板或恢復會話彈窗 |
| `↑` / `↓`、`Home` / `End` | 右側對話刻度取得焦點時，在之前的輸入之間跳轉 |

## 常見問題

- **價格從哪來？** 每個模型按**實際呼叫的端點**、用供應商自己的幣種定價：DeepSeek 官網峰谷價、OpenRouter 官方按 token 價格、智譜的人民幣頁面，以及 Anthropic、Moonshot、阿里雲、Hugging Face 各自公開的價格頁 / API。其他位址使用你在 `models.json` 裡為該 provider 設定的 `cost`，pi 內建價兜底。完整規則、匯率覆蓋和快取見 [docs/pricing.md](docs/pricing.md)。
- **模型清單是空的？** 先執行 `npm run setup`，或者設定一個 provider 的環境變數，然後重啟服務。
- **新會話預設用哪個模型？** 依序看：`~/.pi/agent/settings.json` 裡的 `defaultProvider`/`defaultModel`，然後是 Fidere 自己的推薦表（目前只有 DeepSeek → `deepseek-flash`），最後才是 pi 內建的 provider 預設表。`npm run setup` 會把推薦模型寫進 settings；模型選擇面板裡每行右側的 **set default** 也能隨時改。之所以要這一層：pi 的表把 DeepSeek 預設成 `deepseek-v4-pro`，輸入價是 `deepseek-flash` 的 4.4 倍且不支援圖片，新裝時容易一上來就燒錢。
- **Mac 合蓋後任務會停？** 服務可以在任務執行期間阻止閒置休眠，但合蓋睡眠無法完全避免，除非使用合蓋模式。要真正 7×24，建議放在常開的機器上。
- **Key 存在哪裡？** `~/.pi/agent/auth.json`。API Key 不會寫進這個儲存庫。

## 開發

```bash
npm test          # 單元測試：價格、markdown、預設模型、SDK 檢查、排程器
npm run smoke     # 無頭 Chrome 的介面冒煙測試（需要 Chrome/Chromium）
npm run dev       # 以 node --watch 啟動
npm run daemon    # 單獨執行排程器（--list、--run <name>、--once）
```

架構、API 端點、在地化和 pi 版本升級說明見 [DEVELOPMENT.md](DEVELOPMENT.md)。

### 參與貢獻

歡迎提交。做到下面幾條，PR 會好合很多：

1. 比修 bug 大的改動先開 issue，把方案聊清楚再動手。
2. 保持樸素：不引入前端框架、打包器，也不加新的執行期依賴，除非確實繞不開。
3. 推送前跑 `npm test`；動過介面的再跑 `npm run smoke`。
4. PR 裡寫清改了什麼、怎麼驗證的——一張截圖或一個測試名稱就夠了。

介面文案在 `public/i18n.js`，七種語言都要補齊，否則冒煙測試會掛。

## 授權

MIT，詳見 [LICENSE](LICENSE)。
