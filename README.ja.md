# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [繁體中文（香港）](README.zh-HK.md) | **日本語** | [한국어](README.ko.md) | [Русский](README.ru.md)


Fidere はブラウザで動く小さなエージェントワークスペースです。[pi coding agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) の SDK で構築されているため、エージェントはファイルの読み書きやコマンドの実行ができ、思考とツール呼び出しをリアルタイムでストリーミング表示します。しかも、フレームワークやバンドラー、別のサービスをあなたのマシンに持ち込むことはありません。

![Fidere の会話画面](docs/screenshot-chat.jpg)

- **意図的に小さく** —— 依存パッケージは pi SDK の 1 つだけ。フロントエンドのフレームワークもバンドラーも CDN も使いません。約 8,300 行の素の JS/CSS で、実行経路は `node scripts/start.mjs` だけです。
- **答えだけでなく、作業の過程も流す** —— 思考とツール呼び出しが会話の中にリアルタイムで現れ、応答が終わると折りたたまれ、応答ごとに開き直せます。
- **あなたの言語で使えます** —— インターフェースは English、简体中文、繁體中文（台灣／香港）、日本語、한국어、Русский の 7 言語。サイドバーの地球ボタンから切り替えられます。
- **コストがわかる** —— すべての応答にトークン使用量が付き、実際に呼び出したエンドポイントのベンダー公式価格で計算されます。固定の料金表ではありません。
- **勝手に高価なモデルを選びません** —— 新しいセッションは、あなたが見て変更できるモデルから始まります。セッションを開き直したときにモデルが黙って差し替えられた場合は、会話の上に明示されます。

![モデル選択画面と保存済みの既定モデル](docs/screenshot-models.jpg)

## できること

- ブラウザでエージェントと会話し、思考とツール呼び出しをその場で確認できます
- 応答ごとに思考とツール呼び出しを折りたたみ／展開できます。終わった応答は自動で折りたたまれます
- 右側のタイムラインから、以前のプロンプトに戻れます
- 履歴を読んでいるときに下へ引き戻されません。最新の出力に戻りたいときだけ戻れます
- セッションの管理、モデルの切り替え、画像やファイルの添付
- 新しいセッションが使うモデルを指定できます（モデル選択画面の `set default`）。セッションを開き直してモデルが変わった場合は会話の上に通知が出ます
- 各応答の時刻、トークン使用量、コストを確認できます（ベンダー公式価格、人民元換算の目安付き）
- 以前のメッセージを編集して新しいブランチで再送信、応答のコピー、拒否されたプロンプトの再試行、ストリーム切断後の自動復帰
- 長いタスクの実行中に Mac のスリープを防ぐ（任意）
- サイドバーの地球ボタンからインターフェースの言語を切り替え（English / 简体中文 / 繁體中文（台灣）/ 繁體中文（香港）/ 日本語 / 한국어 / Русский）

## キーボードショートカット

| ショートカット | 動作 |
|----------|--------|
| `Enter` | メッセージを送信 |
| `Shift+Enter` | 入力欄で改行 |
| `/` | コマンドパレットを開く（コマンド、モデル、スキル、プロンプトテンプレート） |
| `↑` / `↓` | パレットの候補を移動 |
| `Tab` / `Enter` | 選択中の候補を決定 |
| `Esc` | コマンドパレットまたはセッション再開ダイアログを閉じる |
| `↑` / `↓`、`Home` / `End` | 右側のタイムラインにフォーカスがあるとき、以前のプロンプト間を移動 |

## 動作環境

- Node.js **22.19 以上**
- 対応プロバイダーの API キー（Anthropic、OpenAI、Google、DeepSeek、OpenRouter、Moonshot、MiniMax、xAI、Groq、Mistral など）

## インストールと起動

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
npm start
```

<http://localhost:3000> を開き、起動時に表示されたアクセストークンでサインインします（トークンは `~/.pi/agent/fidere-token` にも保存されています）。セッション Cookie の有効期間は 30 日です。オプションの一覧は下記の「アクセス制御」を参照してください。

起動のたびに、`npm start` は npm に新しい pi SDK が公開されていないか確認します。対話的なターミナルでは更新するか尋ねられ、承諾すると新しい SDK をインストールしてからサーバーを起動します。非対話環境では利用可能なバージョンを表示するだけで、通常どおり起動します。`FIDERE_SDK_UPDATE=off` で確認を省略でき、`FIDERE_SDK_UPDATE=auto` で確認なしに更新します。

`npm run setup` はプロバイダーを選び、その API キーを入力するだけです。Fidere と一緒にインストールされた依存関係だけで動作し、**pi CLI を別途インストールする必要はありません**。キーは `~/.pi/agent/auth.json` に保存されます。

起動後、左下のモデル選択画面でモデルを選んでください。選ばない場合は、保存済みの既定モデル、Fidere 独自の推奨（下記）、SDK のプロバイダー別フォールバックの順に使われます。

### 環境変数を使う場合

対話的なセットアップを使わない場合は、環境変数でも設定できます。

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`DEEPSEEK_API_KEY` などのプロバイダー用環境変数も同様に使えます。pi CLI は不要です。

ポートを変更する場合：

```bash
PORT=8080 npm start
```

## 補足

- **価格について：** Fidere は、モデルが実際に呼び出されるエンドポイントで価格を決めます。`api.deepseek.com` のモデルは DeepSeek 公式のピーク／オフピーク価格を該当する通貨で使い（`zh` ロケールなら中文ページ／人民元、それ以外は英語ページ／米ドル。`FIDERE_PRICE_CURRENCY=CNY|USD` で上書き可能）、`openrouter.ai` のモデルは OpenRouter 公式のトークン単価、`open.bigmodel.cn` のモデルは智譜の公式価格ドキュメント（人民元）を使います。`api.anthropic.com`、`api.moonshot.cn`、`dashscope.aliyuncs.com`、`router.huggingface.co` のモデルも、それぞれの公式価格ページ／API を使います。それ以外のエンドポイントは `models.json` でそのプロバイダーに設定した `cost`（プロキシやゲートウェイは独自の価格）を使い、最後の保険として SDK 同梱の価格が適用されます。価格はベンダーの通貨のまま表示されます（`zh` ロケールでの DeepSeek、GLM、Moonshot、Aliyun は人民元、OpenRouter、Anthropic、HuggingFace、および `zh` 以外のロケールでの DeepSeek は米ドル）。米ドル価格の人民元ツールチップは 1 米ドル = 7.2 人民元での概算です（`localStorage.setItem('fidere-usd-cny', '7.30')` で変更可能）。確認はサーバー起動時に始まります。失敗した確認は前回のキャッシュを保持し、最新のベンダー一覧にないモデルは前回の公式価格を保持し、どちらも無い場合にだけ SDK 価格が使われます。キャッシュは `~/.pi/agent/fidere-prices.json`、`FIDERE_PRICES=off` でベンダーへの問い合わせを無効にできます。状態確認：`GET /api/prices`。
- **モデルが出てこない？** `npm run setup` を実行するか、プロバイダーの環境変数を設定してから、サーバーを再起動してください。
- **新しいセッションはどのモデルで始まる？** まず `~/.pi/agent/settings.json` の `defaultProvider`／`defaultModel`、次に Fidere 独自の推奨表（現在は DeepSeek → `deepseek-flash` のみ）、最後に SDK 内蔵のプロバイダー別テーブル、の順です。`npm run setup` は推奨モデルを settings に書き込み、モデル選択画面の各行にある **set default** で後から変更できます。**default** バッジが付いた行が、新しいセッションで使われるモデルです。この上書き層がある理由：SDK のテーブルは DeepSeek を `deepseek-v4-pro` で開始しますが、これは `deepseek-flash` の 4.4 倍の入力価格で画像にも対応していません。インストール直後にいきなり費用がかさむのを避けるためです。
- **アクセス制御：** すべての API ルートにはアクセストークンが必要です。`FIDERE_TOKEN` から読むか、初回起動時に `~/.pi/agent/fidere-token`（パーミッション 0600）へ生成されます。パスは起動時に表示されます。初回は `/#token=<トークン>` を開くか、ログイン画面に貼り付けてサインインします。fragment はサーバーにもプロキシのログにも送られません。セッション Cookie は `HttpOnly`、`SameSite=Strict` で 30 日間有効です（`FIDERE_SESSION_MAX_AGE`、秒単位）。状態を変更するリクエストには二重送信 CSRF トークンも必要で、UI が自動で送ります。スクリプトからは `Authorization: Bearer <トークン>` でも構いません。`FIDERE_COOKIE_SECURE=auto|on|off` は `Secure` フラグを制御します（既定は `X-Forwarded-Proto` に従う）。`FIDERE_AUTH=off` はこれらすべてを無効にします。他の誰も到達できないマシンでのみ使ってください。
- **外部からアクセスしたい：** サーバーは既定で `127.0.0.1` のみをリッスンします。インターネットに直接公開しないでください。TLS 付きのリバースプロキシか、プライベートなトンネルを使ってください。`HOST=0.0.0.0` は信頼できるネットワークでのみ使えます。
- **Mac のスリープ：** タスクの実行中は `caffeinate` アサーションを保持できます。ただし蓋を閉じると、クラムシェルモードでない限りスリープします。無人で長いタスクを動かす場合は、常時起動のマシンを使ってください。
- **キーはどこに保存される？** `~/.pi/agent/auth.json` です。API キーがこのリポジトリに書き込まれることはありません。

## 開発

アーキテクチャ、テスト、API エンドポイント、SDK アップグレードの注意点は [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください。

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
