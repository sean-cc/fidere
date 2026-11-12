// ── i18n ────────────────────────────────────────────────────────────────────
// Dependency-free translation layer for the Fidere UI.
//
// Strings that the agent reads (attachment markers, tool output, file paths)
// are deliberately NOT translated: only what a human sees in the interface is.
//
// A dictionary value is either a string or a plural object keyed by
// Intl.PluralRules categories (one / few / many / other). Interpolation uses
// {name} and is driven by the `params` argument; plural selection is driven by
// `params.count`.

const STORAGE_KEY = 'fidere-locale';

export const LOCALES = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'zh-CN', label: '简体中文', short: '简' },
  { id: 'zh-TW', label: '繁體中文', short: '繁' },
  { id: 'zh-HK', label: '繁體中文（香港）', short: '港' },
  { id: 'ja', label: '日本語', short: '日' },
  { id: 'ko', label: '한국어', short: '한' },
  { id: 'ru', label: 'Русский', short: 'RU' },
];

// ── English (source of truth) ──────────────────────────────────────────────
const en = {
  'login.hint': 'Paste the access token printed at startup, or read it from <code>~/.pi/agent/fidere-token</code>.',
  'login.token': 'Access token',
  'login.continue': 'Continue',
  'login.err.network': 'Could not reach the server.',
  'login.err.rate': 'Too many attempts. Wait a minute and try again.',
  'login.err.rejected': 'Token rejected.',

  'sidebar.newChat': 'New chat',
  'sidebar.closeMenu': 'Close menu',
  'sidebar.noModel': 'No model configured',
  'sidebar.selectModel': 'Select model',
  'sidebar.toggleTheme': 'Toggle theme',
  'sidebar.language': 'Language',
  'sidebar.noSessions': 'No sessions yet',

  'models.title': 'Select Model',
  'models.loading': 'Loading models...',
  'models.empty': 'No models available. Configure API keys first.',
  'models.recommended': ' (Fidere recommends this one)',
  'models.defaultBadge': 'default',
  'models.defaultTitle': 'Default for new sessions',
  'models.setDefault': 'set default',
  'models.setDefaultTitle': 'Use this model for every new session',
  'models.saveFailed': 'Failed to save the default model: {message}',
  'models.switchFailed': 'Failed to switch model: {message}',

  'sessions.title': 'Resume Session',
  'sessions.search': 'Search sessions...',
  'sessions.loading': 'Loading sessions...',
  'sessions.empty': 'No sessions yet',
  'sessions.noMatch': 'No matching sessions',
  'sessions.loadFailed': 'Failed to load sessions: {message}',
  'sessions.delete': 'Delete',
  'sessions.confirmDelete': 'Delete this session?',
  'sessions.stillGenerating': 'This session is still generating. It will refresh when finished.',
  'sessions.count': { one: '{count} message', other: '{count} messages' },
  'sessions.modelLabel': 'Model: {model}',
  'sessions.info': {
    one: 'Session {id} · model: {model} · {count} message',
    other: 'Session {id} · model: {model} · {count} messages',
  },

  'chat.welcome': 'A small agent workspace, built on pi agent',
  'chat.timeline': 'Conversation timeline',
  'chat.timelineHint': 'Conversation timeline (↑ / ↓ to navigate)',
  'chat.jumpLatest': 'Jump to latest',
  'chat.jumpLatestMessage': 'Jump to latest message',
  'chat.editBanner': 'Editing an earlier message. Sending starts a new branch.',
  'chat.editCancel': 'Cancel',
  'chat.slash': 'Slash commands',
  'chat.attach': 'Attach images or files',
  'chat.placeholder': 'Message Fidere...  Type / for commands',
  'chat.inputTitle': 'Type / to see commands. Attach with the paperclip, drag, or paste.',
  'chat.send': 'Send message',
  'chat.stop': 'Stop generating',
  'chat.dropFiles': 'Drop files to attach',
  'chat.disclaimer': 'Built on pi agent · Images, text and files can be attached · Check results carefully',
  'chat.dismiss': 'Dismiss',

  'msg.copy': 'Copy message text',
  'msg.details': 'Thinking &amp; tools',
  'msg.edit': 'Edit',
  'msg.editTitle': 'Edit and resend this message',
  'msg.you': 'You',
  'msg.agent': 'Fidere',
  'msg.empty': '(empty message)',

  'tools.running': 'Running...',
  'tools.error': 'Error',
  'tools.done': 'Done',
  'tools.tool': 'Tool',
  'tools.hidden': '… ({count} characters hidden) …',

  'details.showTitle': 'Show thinking and tool calls',
  'details.hideTitle': 'Hide thinking and tool calls',
  'details.show': {
    one: 'Show thinking & tools · {count} step',
    other: 'Show thinking & tools · {count} steps',
  },
  'details.hide': {
    one: 'Hide thinking & tools · {count} step',
    other: 'Hide thinking & tools · {count} steps',
  },

  'usage.sessionTotals': 'Session totals — {details}',
  'usage.title': 'input {input} · output {output} · cache read {cacheRead} · cache write {cacheWrite} · cost {cost} · {source}',
  'usage.priceFrom': 'price: {source}',
  'usage.priceLocal': 'price: local models.json / SDK',
  'usage.priceMixed': 'price: mixed sources',
  'usage.usdApprox': ' (≈¥{cny} at {rate})',

  'err.prefix': 'Error: {message}',
  'err.retry': 'Retry',
  'err.upload': 'Upload failed',
  'err.maxFiles': 'You can attach at most {count} files per message.',
  'err.roomFiles': {
    one: 'Only {count} more file can be attached.',
    other: 'Only {count} more files can be attached.',
  },
  'err.tooLarge': '{name} is larger than 25 MB.',
  'err.attachFailed': 'Could not attach {name}: {message}',
  'err.branchFailed': 'Could not start a branch: {message}',
  'err.compactFailed': 'Compaction failed: {message}',
  'err.createSession': 'Failed to create session. Check your API key configuration.',
  'err.connect': 'Could not connect to server. Make sure the server is running and API keys are configured.',

  'attach.uploading': 'Uploading…',
  'attach.refTitle': 'Reference this file in the message',
  'attach.ref': 'Reference {name}',
  'attach.remove': 'Remove',
  'attach.imageWarning': 'Images may not be read by this model',
  'attach.chooseVision': 'Choose a vision model to read images',

  'notice.branch': 'Started a new branch. The original conversation is preserved.',
  'notice.recovered': 'The reply had already finished; it was recovered after the stream stalled.',
  'notice.connectionLost': 'Connection lost ({message}). Waiting for the session to finish…',
  'notice.compacting': 'Compacting session…',
  'notice.compacted': 'Session compacted.',
  'notice.compactedWith': 'Session compacted: {summary}',

  'slash.loading': 'Loading…',
  'slash.empty': 'No matching {noun}',
  'slash.noun.models': 'models',
  'slash.noun.skills': 'skills',
  'slash.noun.prompts': 'prompt templates',
  'slash.noun.commands': 'commands',
  'slash.current': 'current',
  'slash.vision': 'vision',
  'slash.builtin': 'built-in',
  'slash.nav': '↑↓ navigate',
  'slash.select': 'Enter select',
  'slash.close': 'Esc close',
  'slash.group.builtin': 'Commands',
  'slash.group.prompt': 'Prompt templates',
  'slash.group.extension': 'Extension commands',
  'slash.group.skill': 'Skills',

  'cmd.model': 'Select a model',
  'cmd.skills': 'Browse skills and insert a skill command',
  'cmd.prompts': 'Browse prompt templates',
  'cmd.new': 'Start a new chat session',
  'cmd.resume': 'Switch to another session',
  'cmd.compact': 'Compact the current session context',
  'cmd.session': 'Show session information',
  'cmd.abort': 'Stop the current response',
  'cmd.help': 'Show all available commands',

  'working': 'Working',
  'copy.action': 'Copy',
  'copy.done': '✓ Copy',
};

// ── 简体中文 ───────────────────────────────────────────────────────────────
const zhCN = {
  'login.hint': '粘贴启动时打印的访问令牌，或从 <code>~/.pi/agent/fidere-token</code> 读取。',
  'login.token': '访问令牌',
  'login.continue': '继续',
  'login.err.network': '无法连接服务器。',
  'login.err.rate': '尝试次数过多。请等一分钟后再试。',
  'login.err.rejected': '令牌被拒绝。',

  'sidebar.newChat': '新建对话',
  'sidebar.closeMenu': '关闭菜单',
  'sidebar.noModel': '未配置模型',
  'sidebar.selectModel': '选择模型',
  'sidebar.toggleTheme': '切换主题',
  'sidebar.language': '语言',
  'sidebar.noSessions': '暂无会话',

  'models.title': '选择模型',
  'models.loading': '正在加载模型…',
  'models.empty': '没有可用模型。请先配置 API 密钥。',
  'models.recommended': '（Fidere 推荐此项）',
  'models.defaultBadge': '默认',
  'models.defaultTitle': '新会话默认使用',
  'models.setDefault': '设为默认',
  'models.setDefaultTitle': '所有新会话都使用此模型',
  'models.saveFailed': '保存默认模型失败：{message}',
  'models.switchFailed': '切换模型失败：{message}',

  'sessions.title': '恢复会话',
  'sessions.search': '搜索会话…',
  'sessions.loading': '正在加载会话…',
  'sessions.empty': '暂无会话',
  'sessions.noMatch': '没有匹配的会话',
  'sessions.loadFailed': '加载会话失败：{message}',
  'sessions.delete': '删除',
  'sessions.confirmDelete': '要删除这个会话吗？',
  'sessions.stillGenerating': '该会话仍在生成中，完成后会自动刷新。',
  'sessions.count': '{count} 条消息',
  'sessions.modelLabel': '模型：{model}',
  'sessions.info': '会话 {id} · 模型：{model} · {count} 条消息',

  'chat.welcome': '基于 pi agent 构建的小型智能体工作台',
  'chat.timeline': '对话时间轴',
  'chat.timelineHint': '对话时间轴（↑ / ↓ 导航）',
  'chat.jumpLatest': '跳到最新',
  'chat.jumpLatestMessage': '跳到最新消息',
  'chat.editBanner': '正在编辑早前的消息。发送后将创建新分支。',
  'chat.editCancel': '取消',
  'chat.slash': '斜杠命令',
  'chat.attach': '附加图片或文件',
  'chat.placeholder': '给 Fidere 发消息…  输入 / 查看命令',
  'chat.inputTitle': '输入 / 查看命令。可用回形针、拖拽或粘贴附加文件。',
  'chat.send': '发送消息',
  'chat.stop': '停止生成',
  'chat.dropFiles': '松开以附加文件',
  'chat.disclaimer': '基于 pi agent 构建 · 可附加图片、文本和文件 · 请仔细核实结果',
  'chat.dismiss': '关闭',

  'msg.copy': '复制消息文本',
  'msg.details': '思考与工具',
  'msg.edit': '编辑',
  'msg.editTitle': '编辑并重新发送此消息',
  'msg.you': '你',
  'msg.agent': 'Fidere',
  'msg.empty': '（空消息）',

  'tools.running': '运行中…',
  'tools.error': '出错',
  'tools.done': '完成',
  'tools.tool': '工具',
  'tools.hidden': '…（已隐藏 {count} 个字符）…',

  'details.showTitle': '展开思考与工具调用',
  'details.hideTitle': '收起思考与工具调用',
  'details.show': '展开思考与工具 · {count} 步',
  'details.hide': '收起思考与工具 · {count} 步',

  'usage.sessionTotals': '会话总计 — {details}',
  'usage.title': '输入 {input} · 输出 {output} · 缓存读取 {cacheRead} · 缓存写入 {cacheWrite} · 费用 {cost} · {source}',
  'usage.priceFrom': '价格：{source}',
  'usage.priceLocal': '价格：本地 models.json / SDK',
  'usage.priceMixed': '价格：混合来源',
  'usage.usdApprox': '（≈¥{cny}，汇率 {rate}）',

  'err.prefix': '错误：{message}',
  'err.retry': '重试',
  'err.upload': '上传失败',
  'err.maxFiles': '每条消息最多附加 {count} 个文件。',
  'err.roomFiles': '只能再附加 {count} 个文件。',
  'err.tooLarge': '{name} 超过 25 MB。',
  'err.attachFailed': '无法附加 {name}：{message}',
  'err.branchFailed': '无法创建分支：{message}',
  'err.compactFailed': '压缩失败：{message}',
  'err.createSession': '创建会话失败。请检查 API 密钥配置。',
  'err.connect': '无法连接服务器。请确认服务器正在运行且已配置 API 密钥。',

  'attach.uploading': '上传中…',
  'attach.refTitle': '在消息中引用此文件',
  'attach.ref': '引用 {name}',
  'attach.remove': '移除',
  'attach.imageWarning': '当前模型可能无法读取图片',
  'attach.chooseVision': '请选择支持视觉的模型来读取图片',

  'notice.branch': '已创建新分支。原对话已保留。',
  'notice.recovered': '回复其实已完成，流中断后已恢复。',
  'notice.connectionLost': '连接中断（{message}）。正在等待会话完成…',
  'notice.compacting': '正在压缩会话…',
  'notice.compacted': '会话已压缩。',
  'notice.compactedWith': '会话已压缩：{summary}',

  'slash.loading': '加载中…',
  'slash.empty': '没有匹配的{noun}',
  'slash.noun.models': '模型',
  'slash.noun.skills': '技能',
  'slash.noun.prompts': '提示词模板',
  'slash.noun.commands': '命令',
  'slash.current': '当前',
  'slash.vision': '视觉',
  'slash.builtin': '内置',
  'slash.nav': '↑↓ 导航',
  'slash.select': 'Enter 选择',
  'slash.close': 'Esc 关闭',
  'slash.group.builtin': '命令',
  'slash.group.prompt': '提示词模板',
  'slash.group.extension': '扩展命令',
  'slash.group.skill': '技能',

  'cmd.model': '选择模型',
  'cmd.skills': '浏览技能并插入技能命令',
  'cmd.prompts': '浏览提示词模板',
  'cmd.new': '开始新的对话',
  'cmd.resume': '切换到其他会话',
  'cmd.compact': '压缩当前会话上下文',
  'cmd.session': '显示会话信息',
  'cmd.abort': '停止当前回复',
  'cmd.help': '显示所有可用命令',

  'working': '处理中',
  'copy.action': '复制',
  'copy.done': '✓ 已复制',
};

// ── 繁體中文（台灣用語） ───────────────────────────────────────────────────
const zhTW = {
  'login.hint': '貼上啟動時列印的存取權杖，或從 <code>~/.pi/agent/fidere-token</code> 讀取。',
  'login.token': '存取權杖',
  'login.continue': '繼續',
  'login.err.network': '無法連線到伺服器。',
  'login.err.rate': '嘗試次數過多。請等一分鐘後再試。',
  'login.err.rejected': '權杖遭拒。',

  'sidebar.newChat': '新增對話',
  'sidebar.closeMenu': '關閉選單',
  'sidebar.noModel': '尚未設定模型',
  'sidebar.selectModel': '選擇模型',
  'sidebar.toggleTheme': '切換主題',
  'sidebar.language': '語言',
  'sidebar.noSessions': '尚無工作階段',

  'models.title': '選擇模型',
  'models.loading': '正在載入模型…',
  'models.empty': '沒有可用的模型。請先設定 API 金鑰。',
  'models.recommended': '（Fidere 推薦此項）',
  'models.defaultBadge': '預設',
  'models.defaultTitle': '新工作階段的預設',
  'models.setDefault': '設為預設',
  'models.setDefaultTitle': '所有新工作階段都使用此模型',
  'models.saveFailed': '儲存預設模型失敗：{message}',
  'models.switchFailed': '切換模型失敗：{message}',

  'sessions.title': '繼續工作階段',
  'sessions.search': '搜尋工作階段…',
  'sessions.loading': '正在載入工作階段…',
  'sessions.empty': '尚無工作階段',
  'sessions.noMatch': '沒有符合的工作階段',
  'sessions.loadFailed': '載入工作階段失敗：{message}',
  'sessions.delete': '刪除',
  'sessions.confirmDelete': '要刪除這個工作階段嗎？',
  'sessions.stillGenerating': '此工作階段仍在產生回覆，完成後會自動重新整理。',
  'sessions.count': '{count} 則訊息',
  'sessions.modelLabel': '模型：{model}',
  'sessions.info': '工作階段 {id} · 模型：{model} · {count} 則訊息',

  'chat.welcome': '以 pi agent 打造的小型代理工作區',
  'chat.timeline': '對話時間軸',
  'chat.timelineHint': '對話時間軸（↑ / ↓ 導覽）',
  'chat.jumpLatest': '跳到最新',
  'chat.jumpLatestMessage': '跳到最新訊息',
  'chat.editBanner': '正在編輯先前的訊息。送出後會建立新的分支。',
  'chat.editCancel': '取消',
  'chat.slash': '斜線指令',
  'chat.attach': '附加圖片或檔案',
  'chat.placeholder': '傳訊息給 Fidere…  輸入 / 查看指令',
  'chat.inputTitle': '輸入 / 查看指令。可用迴紋針、拖曳或貼上附加檔案。',
  'chat.send': '傳送訊息',
  'chat.stop': '停止產生',
  'chat.dropFiles': '放開以附加檔案',
  'chat.disclaimer': '以 pi agent 打造 · 可附加圖片、文字與檔案 · 請仔細核實結果',
  'chat.dismiss': '關閉',

  'msg.copy': '複製訊息文字',
  'msg.details': '思考與工具',
  'msg.edit': '編輯',
  'msg.editTitle': '編輯並重新傳送此訊息',
  'msg.you': '你',
  'msg.agent': 'Fidere',
  'msg.empty': '（空白訊息）',

  'tools.running': '執行中…',
  'tools.error': '錯誤',
  'tools.done': '完成',
  'tools.tool': '工具',
  'tools.hidden': '…（已隱藏 {count} 個字元）…',

  'details.showTitle': '展開思考與工具呼叫',
  'details.hideTitle': '收合思考與工具呼叫',
  'details.show': '展開思考與工具 · {count} 個步驟',
  'details.hide': '收合思考與工具 · {count} 個步驟',

  'usage.sessionTotals': '工作階段總計 — {details}',
  'usage.title': '輸入 {input} · 輸出 {output} · 快取讀取 {cacheRead} · 快取寫入 {cacheWrite} · 費用 {cost} · {source}',
  'usage.priceFrom': '價格：{source}',
  'usage.priceLocal': '價格：本機 models.json / SDK',
  'usage.priceMixed': '價格：混合來源',
  'usage.usdApprox': '（≈¥{cny}，匯率 {rate}）',

  'err.prefix': '錯誤：{message}',
  'err.retry': '重試',
  'err.upload': '上傳失敗',
  'err.maxFiles': '每則訊息最多可附加 {count} 個檔案。',
  'err.roomFiles': '只能再附加 {count} 個檔案。',
  'err.tooLarge': '{name} 超過 25 MB。',
  'err.attachFailed': '無法附加 {name}：{message}',
  'err.branchFailed': '無法建立分支：{message}',
  'err.compactFailed': '壓縮失敗：{message}',
  'err.createSession': '建立工作階段失敗。請檢查 API 金鑰設定。',
  'err.connect': '無法連線到伺服器。請確認伺服器正在執行且已設定 API 金鑰。',

  'attach.uploading': '上傳中…',
  'attach.refTitle': '在訊息中參照此檔案',
  'attach.ref': '參照 {name}',
  'attach.remove': '移除',
  'attach.imageWarning': '目前模型可能無法讀取圖片',
  'attach.chooseVision': '請選擇支援視覺的模型來讀取圖片',

  'notice.branch': '已建立新分支。原始對話已保留。',
  'notice.recovered': '回覆其實已完成，串流中斷後已還原。',
  'notice.connectionLost': '連線中斷（{message}）。正在等待工作階段完成…',
  'notice.compacting': '正在壓縮工作階段…',
  'notice.compacted': '工作階段已壓縮。',
  'notice.compactedWith': '工作階段已壓縮：{summary}',

  'slash.loading': '載入中…',
  'slash.empty': '沒有符合的{noun}',
  'slash.noun.models': '模型',
  'slash.noun.skills': '技能',
  'slash.noun.prompts': '提示詞範本',
  'slash.noun.commands': '指令',
  'slash.current': '目前',
  'slash.vision': '視覺',
  'slash.builtin': '內建',
  'slash.nav': '↑↓ 導覽',
  'slash.select': 'Enter 選擇',
  'slash.close': 'Esc 關閉',
  'slash.group.builtin': '指令',
  'slash.group.prompt': '提示詞範本',
  'slash.group.extension': '擴充指令',
  'slash.group.skill': '技能',

  'cmd.model': '選擇模型',
  'cmd.skills': '瀏覽技能並插入技能指令',
  'cmd.prompts': '瀏覽提示詞範本',
  'cmd.new': '開始新的對話',
  'cmd.resume': '切換到其他工作階段',
  'cmd.compact': '壓縮目前工作階段的上下文',
  'cmd.session': '顯示工作階段資訊',
  'cmd.abort': '停止目前的回覆',
  'cmd.help': '顯示所有可用指令',

  'working': '處理中',
  'copy.action': '複製',
  'copy.done': '✓ 已複製',
};

// ── 繁體中文（香港用語） ───────────────────────────────────────────────────
const zhHK = {
  'login.hint': '貼上啟動時列印的存取權杖，或從 <code>~/.pi/agent/fidere-token</code> 讀取。',
  'login.token': '存取權杖',
  'login.continue': '繼續',
  'login.err.network': '無法連線到伺服器。',
  'login.err.rate': '嘗試次數過多。請等一分鐘後再試。',
  'login.err.rejected': '權杖遭拒。',

  'sidebar.newChat': '新增對話',
  'sidebar.closeMenu': '關閉選單',
  'sidebar.noModel': '尚未設定模型',
  'sidebar.selectModel': '選擇模型',
  'sidebar.toggleTheme': '切換主題',
  'sidebar.language': '語言',
  'sidebar.noSessions': '尚無工作階段',

  'models.title': '選擇模型',
  'models.loading': '正在載入模型…',
  'models.empty': '沒有可用的模型。請先設定 API 金鑰。',
  'models.recommended': '（Fidere 推薦此項）',
  'models.defaultBadge': '預設',
  'models.defaultTitle': '新工作階段的預設',
  'models.setDefault': '設為預設',
  'models.setDefaultTitle': '所有新工作階段都使用此模型',
  'models.saveFailed': '儲存預設模型失敗：{message}',
  'models.switchFailed': '切換模型失敗：{message}',

  'sessions.title': '繼續工作階段',
  'sessions.search': '搜尋工作階段…',
  'sessions.loading': '正在載入工作階段…',
  'sessions.empty': '尚無工作階段',
  'sessions.noMatch': '沒有符合的工作階段',
  'sessions.loadFailed': '載入工作階段失敗：{message}',
  'sessions.delete': '刪除',
  'sessions.confirmDelete': '要刪除這個工作階段嗎？',
  'sessions.stillGenerating': '此工作階段仍在產生回覆，完成後會自動重新整理。',
  'sessions.count': '{count} 個訊息',
  'sessions.modelLabel': '模型：{model}',
  'sessions.info': '工作階段 {id} · 模型：{model} · {count} 個訊息',

  'chat.welcome': '以 pi agent 打造的小型代理工作區',
  'chat.timeline': '對話時間軸',
  'chat.timelineHint': '對話時間軸（↑ / ↓ 導航）',
  'chat.jumpLatest': '跳到最新',
  'chat.jumpLatestMessage': '跳到最新訊息',
  'chat.editBanner': '正在編輯先前的訊息。送出後會建立新的分支。',
  'chat.editCancel': '取消',
  'chat.slash': '斜線指令',
  'chat.attach': '附加圖片或檔案',
  'chat.placeholder': '傳訊息給 Fidere…  輸入 / 查看指令',
  'chat.inputTitle': '輸入 / 查看指令。可用萬字夾、拖放或貼上附加檔案。',
  'chat.send': '傳送訊息',
  'chat.stop': '停止產生',
  'chat.dropFiles': '放開以附加檔案',
  'chat.disclaimer': '以 pi agent 打造 · 可附加圖片、文字與檔案 · 請仔細核實結果',
  'chat.dismiss': '關閉',

  'msg.copy': '複製訊息文字',
  'msg.details': '思考與工具',
  'msg.edit': '編輯',
  'msg.editTitle': '編輯並重新傳送此訊息',
  'msg.you': '你',
  'msg.agent': 'Fidere',
  'msg.empty': '（空白訊息）',

  'tools.running': '執行中…',
  'tools.error': '錯誤',
  'tools.done': '完成',
  'tools.tool': '工具',
  'tools.hidden': '…（已隱藏 {count} 個字符）…',

  'details.showTitle': '展開思考與工具呼叫',
  'details.hideTitle': '收合思考與工具呼叫',
  'details.show': '展開思考與工具 · {count} 個步驟',
  'details.hide': '收合思考與工具 · {count} 個步驟',

  'usage.sessionTotals': '工作階段總計 — {details}',
  'usage.title': '輸入 {input} · 輸出 {output} · 快取讀取 {cacheRead} · 快取寫入 {cacheWrite} · 費用 {cost} · {source}',
  'usage.priceFrom': '價格：{source}',
  'usage.priceLocal': '價格：本機 models.json / SDK',
  'usage.priceMixed': '價格：混合來源',
  'usage.usdApprox': '（≈¥{cny}，匯率 {rate}）',

  'err.prefix': '錯誤：{message}',
  'err.retry': '重試',
  'err.upload': '上載失敗',
  'err.maxFiles': '每個訊息最多可附加 {count} 個檔案。',
  'err.roomFiles': '只能再附加 {count} 個檔案。',
  'err.tooLarge': '{name} 超過 25 MB。',
  'err.attachFailed': '無法附加 {name}：{message}',
  'err.branchFailed': '無法建立分支：{message}',
  'err.compactFailed': '壓縮失敗：{message}',
  'err.createSession': '建立工作階段失敗。請檢查 API 金鑰設定。',
  'err.connect': '無法連線到伺服器。請確認伺服器正在執行且已設定 API 金鑰。',

  'attach.uploading': '上載中…',
  'attach.refTitle': '在訊息中引用此檔案',
  'attach.ref': '引用 {name}',
  'attach.remove': '移除',
  'attach.imageWarning': '目前模型可能無法讀取圖片',
  'attach.chooseVision': '請選擇支援視覺的模型來讀取圖片',

  'notice.branch': '已建立新分支。原始對話已保留。',
  'notice.recovered': '回覆其實已完成，串流中斷後已還原。',
  'notice.connectionLost': '連線中斷（{message}）。正在等待工作階段完成…',
  'notice.compacting': '正在壓縮工作階段…',
  'notice.compacted': '工作階段已壓縮。',
  'notice.compactedWith': '工作階段已壓縮：{summary}',

  'slash.loading': '載入中…',
  'slash.empty': '沒有符合的{noun}',
  'slash.noun.models': '模型',
  'slash.noun.skills': '技能',
  'slash.noun.prompts': '提示詞範本',
  'slash.noun.commands': '指令',
  'slash.current': '目前',
  'slash.vision': '視覺',
  'slash.builtin': '內置',
  'slash.nav': '↑↓ 導航',
  'slash.select': 'Enter 選擇',
  'slash.close': 'Esc 關閉',
  'slash.group.builtin': '指令',
  'slash.group.prompt': '提示詞範本',
  'slash.group.extension': '擴展指令',
  'slash.group.skill': '技能',

  'cmd.model': '選擇模型',
  'cmd.skills': '瀏覽技能並插入技能指令',
  'cmd.prompts': '瀏覽提示詞範本',
  'cmd.new': '開始新的對話',
  'cmd.resume': '切換到其他工作階段',
  'cmd.compact': '壓縮目前工作階段的上下文',
  'cmd.session': '顯示工作階段資訊',
  'cmd.abort': '停止目前的回覆',
  'cmd.help': '顯示所有可用指令',

  'working': '處理中',
  'copy.action': '複製',
  'copy.done': '✓ 已複製',
};

// ── 日本語 ─────────────────────────────────────────────────────────────────
const ja = {
  'login.hint': '起動時に表示されたアクセストークンを貼り付けるか、<code>~/.pi/agent/fidere-token</code> から読み取ってください。',
  'login.token': 'アクセストークン',
  'login.continue': '続ける',
  'login.err.network': 'サーバーに接続できませんでした。',
  'login.err.rate': '試行回数が多すぎます。1分待ってからやり直してください。',
  'login.err.rejected': 'トークンが拒否されました。',

  'sidebar.newChat': '新しいチャット',
  'sidebar.closeMenu': 'メニューを閉じる',
  'sidebar.noModel': 'モデル未設定',
  'sidebar.selectModel': 'モデルを選択',
  'sidebar.toggleTheme': 'テーマを切り替え',
  'sidebar.language': '言語',
  'sidebar.noSessions': 'セッションはまだありません',

  'models.title': 'モデルを選択',
  'models.loading': 'モデルを読み込み中…',
  'models.empty': '利用できるモデルがありません。先に API キーを設定してください。',
  'models.recommended': '（Fidere のおすすめ）',
  'models.defaultBadge': '既定',
  'models.defaultTitle': '新しいセッションの既定',
  'models.setDefault': '既定に設定',
  'models.setDefaultTitle': 'すべての新しいセッションでこのモデルを使う',
  'models.saveFailed': '既定モデルの保存に失敗しました: {message}',
  'models.switchFailed': 'モデルの切り替えに失敗しました: {message}',

  'sessions.title': 'セッションを再開',
  'sessions.search': 'セッションを検索…',
  'sessions.loading': 'セッションを読み込み中…',
  'sessions.empty': 'セッションはまだありません',
  'sessions.noMatch': '一致するセッションがありません',
  'sessions.loadFailed': 'セッションの読み込みに失敗しました: {message}',
  'sessions.delete': '削除',
  'sessions.confirmDelete': 'このセッションを削除しますか？',
  'sessions.stillGenerating': 'このセッションはまだ生成中です。完了すると更新されます。',
  'sessions.count': '{count}件のメッセージ',
  'sessions.modelLabel': 'モデル: {model}',
  'sessions.info': 'セッション {id} · モデル: {model} · {count}件のメッセージ',

  'chat.welcome': 'pi agent で構築された小さなエージェントワークスペース',
  'chat.timeline': '会話タイムライン',
  'chat.timelineHint': '会話タイムライン（↑ / ↓ で移動）',
  'chat.jumpLatest': '最新へ移動',
  'chat.jumpLatestMessage': '最新のメッセージへ移動',
  'chat.editBanner': '以前のメッセージを編集中です。送信すると新しいブランチが作られます。',
  'chat.editCancel': 'キャンセル',
  'chat.slash': 'スラッシュコマンド',
  'chat.attach': '画像やファイルを添付',
  'chat.placeholder': 'Fidere にメッセージ…  / でコマンド',
  'chat.inputTitle': '/ でコマンド一覧。クリップ・ドラッグ・貼り付けで添付できます。',
  'chat.send': 'メッセージを送信',
  'chat.stop': '生成を停止',
  'chat.dropFiles': 'ドロップしてファイルを添付',
  'chat.disclaimer': 'pi agent で構築 · 画像・テキスト・ファイルを添付できます · 結果は必ず確認してください',
  'chat.dismiss': '閉じる',

  'msg.copy': 'メッセージ本文をコピー',
  'msg.details': '思考とツール',
  'msg.edit': '編集',
  'msg.editTitle': 'このメッセージを編集して再送信',
  'msg.you': 'あなた',
  'msg.agent': 'Fidere',
  'msg.empty': '（空のメッセージ）',

  'tools.running': '実行中…',
  'tools.error': 'エラー',
  'tools.done': '完了',
  'tools.tool': 'ツール',
  'tools.hidden': '…（{count}文字を非表示）…',

  'details.showTitle': '思考とツール呼び出しを表示',
  'details.hideTitle': '思考とツール呼び出しを隠す',
  'details.show': '思考とツールを表示 · {count}ステップ',
  'details.hide': '思考とツールを隠す · {count}ステップ',

  'usage.sessionTotals': 'セッション合計 — {details}',
  'usage.title': '入力 {input} · 出力 {output} · キャッシュ読込 {cacheRead} · キャッシュ書込 {cacheWrite} · コスト {cost} · {source}',
  'usage.priceFrom': '価格: {source}',
  'usage.priceLocal': '価格: ローカル models.json / SDK',
  'usage.priceMixed': '価格: 混在ソース',
  'usage.usdApprox': '（≈¥{cny}、レート {rate}）',

  'err.prefix': 'エラー: {message}',
  'err.retry': '再試行',
  'err.upload': 'アップロードに失敗しました',
  'err.maxFiles': '1メッセージに添付できるファイルは最大 {count} 個です。',
  'err.roomFiles': '追加で添付できるのは {count} 個までです。',
  'err.tooLarge': '{name} は 25 MB を超えています。',
  'err.attachFailed': '{name} を添付できませんでした: {message}',
  'err.branchFailed': 'ブランチを作成できませんでした: {message}',
  'err.compactFailed': '圧縮に失敗しました: {message}',
  'err.createSession': 'セッションを作成できませんでした。API キーの設定を確認してください。',
  'err.connect': 'サーバーに接続できません。サーバーが起動しているか、API キーが設定されているか確認してください。',

  'attach.uploading': 'アップロード中…',
  'attach.refTitle': 'メッセージ内でこのファイルを参照',
  'attach.ref': '{name} を参照',
  'attach.remove': '削除',
  'attach.imageWarning': 'このモデルは画像を読み取れない可能性があります',
  'attach.chooseVision': '画像を読み取るには視覚対応モデルを選択してください',

  'notice.branch': '新しいブランチを開始しました。元の会話は保持されています。',
  'notice.recovered': '応答はすでに完了しており、ストリーム停止後に復元されました。',
  'notice.connectionLost': '接続が切断されました（{message}）。セッションの完了を待っています…',
  'notice.compacting': 'セッションを圧縮中…',
  'notice.compacted': 'セッションを圧縮しました。',
  'notice.compactedWith': 'セッションを圧縮しました: {summary}',

  'slash.loading': '読み込み中…',
  'slash.empty': '一致する{noun}はありません',
  'slash.noun.models': 'モデル',
  'slash.noun.skills': 'スキル',
  'slash.noun.prompts': 'プロンプトテンプレート',
  'slash.noun.commands': 'コマンド',
  'slash.current': '現在',
  'slash.vision': '視覚',
  'slash.builtin': '組み込み',
  'slash.nav': '↑↓ 移動',
  'slash.select': 'Enter 決定',
  'slash.close': 'Esc 閉じる',
  'slash.group.builtin': 'コマンド',
  'slash.group.prompt': 'プロンプトテンプレート',
  'slash.group.extension': '拡張コマンド',
  'slash.group.skill': 'スキル',

  'cmd.model': 'モデルを選択',
  'cmd.skills': 'スキルを閲覧してスキルコマンドを挿入',
  'cmd.prompts': 'プロンプトテンプレートを閲覧',
  'cmd.new': '新しいチャットを開始',
  'cmd.resume': '別のセッションに切り替え',
  'cmd.compact': '現在のセッションのコンテキストを圧縮',
  'cmd.session': 'セッション情報を表示',
  'cmd.abort': '現在の応答を停止',
  'cmd.help': '利用可能なすべてのコマンドを表示',

  'working': '処理中',
  'copy.action': 'コピー',
  'copy.done': '✓ コピー済み',
};

// ── 한국어 ─────────────────────────────────────────────────────────────────
const ko = {
  'login.hint': '시작할 때 출력된 액세스 토큰을 붙여넣거나 <code>~/.pi/agent/fidere-token</code>에서 읽으세요.',
  'login.token': '액세스 토큰',
  'login.continue': '계속',
  'login.err.network': '서버에 연결할 수 없습니다.',
  'login.err.rate': '시도 횟수가 너무 많습니다. 1분 후 다시 시도하세요.',
  'login.err.rejected': '토큰이 거부되었습니다.',

  'sidebar.newChat': '새 대화',
  'sidebar.closeMenu': '메뉴 닫기',
  'sidebar.noModel': '모델이 설정되지 않음',
  'sidebar.selectModel': '모델 선택',
  'sidebar.toggleTheme': '테마 전환',
  'sidebar.language': '언어',
  'sidebar.noSessions': '아직 세션이 없습니다',

  'models.title': '모델 선택',
  'models.loading': '모델을 불러오는 중…',
  'models.empty': '사용할 수 있는 모델이 없습니다. 먼저 API 키를 설정하세요.',
  'models.recommended': '(Fidere 권장)',
  'models.defaultBadge': '기본',
  'models.defaultTitle': '새 세션의 기본값',
  'models.setDefault': '기본으로 설정',
  'models.setDefaultTitle': '모든 새 세션에서 이 모델 사용',
  'models.saveFailed': '기본 모델 저장 실패: {message}',
  'models.switchFailed': '모델 전환 실패: {message}',

  'sessions.title': '세션 이어서 하기',
  'sessions.search': '세션 검색…',
  'sessions.loading': '세션을 불러오는 중…',
  'sessions.empty': '아직 세션이 없습니다',
  'sessions.noMatch': '일치하는 세션이 없습니다',
  'sessions.loadFailed': '세션을 불러오지 못했습니다: {message}',
  'sessions.delete': '삭제',
  'sessions.confirmDelete': '이 세션을 삭제할까요?',
  'sessions.stillGenerating': '이 세션은 아직 생성 중입니다. 완료되면 새로고침됩니다.',
  'sessions.count': '메시지 {count}개',
  'sessions.modelLabel': '모델: {model}',
  'sessions.info': '세션 {id} · 모델: {model} · 메시지 {count}개',

  'chat.welcome': 'pi agent로 만든 작은 에이전트 워크스페이스',
  'chat.timeline': '대화 타임라인',
  'chat.timelineHint': '대화 타임라인 (↑ / ↓ 로 이동)',
  'chat.jumpLatest': '최신으로 이동',
  'chat.jumpLatestMessage': '최신 메시지로 이동',
  'chat.editBanner': '이전 메시지를 편집 중입니다. 보내면 새 분기가 만들어집니다.',
  'chat.editCancel': '취소',
  'chat.slash': '슬래시 명령',
  'chat.attach': '이미지 또는 파일 첨부',
  'chat.placeholder': 'Fidere에게 메시지…  / 로 명령 보기',
  'chat.inputTitle': '/ 를 입력하면 명령을 볼 수 있습니다. 클립, 드래그, 붙여넣기로 첨부하세요.',
  'chat.send': '메시지 보내기',
  'chat.stop': '생성 중지',
  'chat.dropFiles': '파일을 놓아 첨부',
  'chat.disclaimer': 'pi agent 기반 · 이미지, 텍스트, 파일을 첨부할 수 있습니다 · 결과를 반드시 확인하세요',
  'chat.dismiss': '닫기',

  'msg.copy': '메시지 텍스트 복사',
  'msg.details': '사고와 도구',
  'msg.edit': '편집',
  'msg.editTitle': '이 메시지를 편집해 다시 보내기',
  'msg.you': '나',
  'msg.agent': 'Fidere',
  'msg.empty': '(빈 메시지)',

  'tools.running': '실행 중…',
  'tools.error': '오류',
  'tools.done': '완료',
  'tools.tool': '도구',
  'tools.hidden': '… ({count}자 숨김) …',

  'details.showTitle': '사고와 도구 호출 표시',
  'details.hideTitle': '사고와 도구 호출 숨기기',
  'details.show': '사고와 도구 표시 · {count}단계',
  'details.hide': '사고와 도구 숨기기 · {count}단계',

  'usage.sessionTotals': '세션 합계 — {details}',
  'usage.title': '입력 {input} · 출력 {output} · 캐시 읽기 {cacheRead} · 캐시 쓰기 {cacheWrite} · 비용 {cost} · {source}',
  'usage.priceFrom': '가격: {source}',
  'usage.priceLocal': '가격: 로컬 models.json / SDK',
  'usage.priceMixed': '가격: 혼합 소스',
  'usage.usdApprox': ' (≈¥{cny}, 환율 {rate})',

  'err.prefix': '오류: {message}',
  'err.retry': '재시도',
  'err.upload': '업로드 실패',
  'err.maxFiles': '메시지당 최대 {count}개 파일을 첨부할 수 있습니다.',
  'err.roomFiles': '{count}개 파일만 더 첨부할 수 있습니다.',
  'err.tooLarge': '{name} 파일이 25 MB를 초과합니다.',
  'err.attachFailed': '{name} 첨부 실패: {message}',
  'err.branchFailed': '분기를 만들지 못했습니다: {message}',
  'err.compactFailed': '압축 실패: {message}',
  'err.createSession': '세션을 만들지 못했습니다. API 키 설정을 확인하세요.',
  'err.connect': '서버에 연결할 수 없습니다. 서버가 실행 중인지, API 키가 설정되어 있는지 확인하세요.',

  'attach.uploading': '업로드 중…',
  'attach.refTitle': '메시지에서 이 파일 참조',
  'attach.ref': '{name} 참조',
  'attach.remove': '제거',
  'attach.imageWarning': '이 모델은 이미지를 읽지 못할 수 있습니다',
  'attach.chooseVision': '이미지를 읽으려면 비전 모델을 선택하세요',

  'notice.branch': '새 분기를 시작했습니다. 원래 대화는 그대로 보존됩니다.',
  'notice.recovered': '응답이 이미 완료되어 스트림 중단 후 복구되었습니다.',
  'notice.connectionLost': '연결이 끊겼습니다({message}). 세션이 끝날 때까지 기다리는 중…',
  'notice.compacting': '세션 압축 중…',
  'notice.compacted': '세션을 압축했습니다.',
  'notice.compactedWith': '세션을 압축했습니다: {summary}',

  'slash.loading': '불러오는 중…',
  'slash.empty': '일치하는 {noun} 없음',
  'slash.noun.models': '모델',
  'slash.noun.skills': '스킬',
  'slash.noun.prompts': '프롬프트 템플릿',
  'slash.noun.commands': '명령',
  'slash.current': '현재',
  'slash.vision': '비전',
  'slash.builtin': '내장',
  'slash.nav': '↑↓ 이동',
  'slash.select': 'Enter 선택',
  'slash.close': 'Esc 닫기',
  'slash.group.builtin': '명령',
  'slash.group.prompt': '프롬프트 템플릿',
  'slash.group.extension': '확장 명령',
  'slash.group.skill': '스킬',

  'cmd.model': '모델 선택',
  'cmd.skills': '스킬을 둘러보고 스킬 명령 삽입',
  'cmd.prompts': '프롬프트 템플릿 둘러보기',
  'cmd.new': '새 대화 시작',
  'cmd.resume': '다른 세션으로 전환',
  'cmd.compact': '현재 세션 컨텍스트 압축',
  'cmd.session': '세션 정보 표시',
  'cmd.abort': '현재 응답 중지',
  'cmd.help': '사용 가능한 모든 명령 표시',

  'working': '처리 중',
  'copy.action': '복사',
  'copy.done': '✓ 복사됨',
};

// ── Русский ────────────────────────────────────────────────────────────────
const ru = {
  'login.hint': 'Вставьте токен доступа, напечатанный при запуске, или прочитайте его из <code>~/.pi/agent/fidere-token</code>.',
  'login.token': 'Токен доступа',
  'login.continue': 'Продолжить',
  'login.err.network': 'Не удалось связаться с сервером.',
  'login.err.rate': 'Слишком много попыток. Подождите минуту и повторите.',
  'login.err.rejected': 'Токен отклонён.',

  'sidebar.newChat': 'Новый чат',
  'sidebar.closeMenu': 'Закрыть меню',
  'sidebar.noModel': 'Модель не настроена',
  'sidebar.selectModel': 'Выбрать модель',
  'sidebar.toggleTheme': 'Переключить тему',
  'sidebar.language': 'Язык',
  'sidebar.noSessions': 'Сессий пока нет',

  'models.title': 'Выбор модели',
  'models.loading': 'Загрузка моделей…',
  'models.empty': 'Нет доступных моделей. Сначала настройте API-ключи.',
  'models.recommended': ' (Fidere рекомендует)',
  'models.defaultBadge': 'по умолчанию',
  'models.defaultTitle': 'По умолчанию для новых сессий',
  'models.setDefault': 'сделать основной',
  'models.setDefaultTitle': 'Использовать эту модель во всех новых сессиях',
  'models.saveFailed': 'Не удалось сохранить модель по умолчанию: {message}',
  'models.switchFailed': 'Не удалось переключить модель: {message}',

  'sessions.title': 'Вернуться к сессии',
  'sessions.search': 'Поиск сессий…',
  'sessions.loading': 'Загрузка сессий…',
  'sessions.empty': 'Сессий пока нет',
  'sessions.noMatch': 'Нет подходящих сессий',
  'sessions.loadFailed': 'Не удалось загрузить сессии: {message}',
  'sessions.delete': 'Удалить',
  'sessions.confirmDelete': 'Удалить эту сессию?',
  'sessions.stillGenerating': 'Эта сессия всё ещё генерирует ответ. Она обновится по завершении.',
  'sessions.count': {
    one: '{count} сообщение',
    few: '{count} сообщения',
    many: '{count} сообщений',
    other: '{count} сообщения',
  },
  'sessions.modelLabel': 'Модель: {model}',
  'sessions.info': 'Сессия {id} · модель: {model} · сообщений: {count}',

  'chat.welcome': 'Небольшое рабочее пространство агента на базе pi agent',
  'chat.timeline': 'Хронология диалога',
  'chat.timelineHint': 'Хронология диалога (↑ / ↓ для навигации)',
  'chat.jumpLatest': 'К последнему',
  'chat.jumpLatestMessage': 'Перейти к последнему сообщению',
  'chat.editBanner': 'Редактируется предыдущее сообщение. Отправка создаст новую ветку.',
  'chat.editCancel': 'Отмена',
  'chat.slash': 'Слэш-команды',
  'chat.attach': 'Прикрепить изображения или файлы',
  'chat.placeholder': 'Сообщение для Fidere…  Введите / для команд',
  'chat.inputTitle': 'Введите / чтобы увидеть команды. Прикрепляйте скрепкой, перетаскиванием или вставкой.',
  'chat.send': 'Отправить сообщение',
  'chat.stop': 'Остановить генерацию',
  'chat.dropFiles': 'Отпустите, чтобы прикрепить файлы',
  'chat.disclaimer': 'Работает на pi agent · Можно прикреплять изображения, текст и файлы · Проверяйте результаты',
  'chat.dismiss': 'Скрыть',

  'msg.copy': 'Скопировать текст сообщения',
  'msg.details': 'Размышления и инструменты',
  'msg.edit': 'Изменить',
  'msg.editTitle': 'Изменить и отправить это сообщение заново',
  'msg.you': 'Вы',
  'msg.agent': 'Fidere',
  'msg.empty': '(пустое сообщение)',

  'tools.running': 'Выполняется…',
  'tools.error': 'Ошибка',
  'tools.done': 'Готово',
  'tools.tool': 'Инструмент',
  'tools.hidden': '… (скрыто символов: {count}) …',

  'details.showTitle': 'Показать размышления и вызовы инструментов',
  'details.hideTitle': 'Скрыть размышления и вызовы инструментов',
  'details.show': {
    one: 'Показать размышления и инструменты · {count} шаг',
    few: 'Показать размышления и инструменты · {count} шага',
    many: 'Показать размышления и инструменты · {count} шагов',
    other: 'Показать размышления и инструменты · {count} шага',
  },
  'details.hide': {
    one: 'Скрыть размышления и инструменты · {count} шаг',
    few: 'Скрыть размышления и инструменты · {count} шага',
    many: 'Скрыть размышления и инструменты · {count} шагов',
    other: 'Скрыть размышления и инструменты · {count} шага',
  },

  'usage.sessionTotals': 'Итого по сессии — {details}',
  'usage.title': 'вход {input} · выход {output} · чтение кэша {cacheRead} · запись кэша {cacheWrite} · стоимость {cost} · {source}',
  'usage.priceFrom': 'цена: {source}',
  'usage.priceLocal': 'цена: локальный models.json / SDK',
  'usage.priceMixed': 'цена: смешанные источники',
  'usage.usdApprox': ' (≈¥{cny} при курсе {rate})',

  'err.prefix': 'Ошибка: {message}',
  'err.retry': 'Повторить',
  'err.upload': 'Не удалось загрузить',
  'err.maxFiles': 'К одному сообщению можно прикрепить не более {count} файлов.',
  'err.roomFiles': 'Можно прикрепить ещё файлов: {count}.',
  'err.tooLarge': '{name} больше 25 МБ.',
  'err.attachFailed': 'Не удалось прикрепить {name}: {message}',
  'err.branchFailed': 'Не удалось создать ветку: {message}',
  'err.compactFailed': 'Не удалось сжать: {message}',
  'err.createSession': 'Не удалось создать сессию. Проверьте настройку API-ключа.',
  'err.connect': 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен и API-ключи настроены.',

  'attach.uploading': 'Загрузка…',
  'attach.refTitle': 'Сослаться на этот файл в сообщении',
  'attach.ref': 'Сослаться на {name}',
  'attach.remove': 'Удалить',
  'attach.imageWarning': 'Эта модель может не прочитать изображения',
  'attach.chooseVision': 'Выберите модель с поддержкой зрения',

  'notice.branch': 'Начата новая ветка. Исходный разговор сохранён.',
  'notice.recovered': 'Ответ уже завершился; он восстановлен после обрыва потока.',
  'notice.connectionLost': 'Соединение потеряно ({message}). Ожидание завершения сессии…',
  'notice.compacting': 'Сжатие сессии…',
  'notice.compacted': 'Сессия сжата.',
  'notice.compactedWith': 'Сессия сжата: {summary}',

  'slash.loading': 'Загрузка…',
  'slash.empty': 'Ничего не найдено — {noun}',
  'slash.noun.models': 'модели',
  'slash.noun.skills': 'навыки',
  'slash.noun.prompts': 'шаблоны промптов',
  'slash.noun.commands': 'команды',
  'slash.current': 'текущая',
  'slash.vision': 'зрение',
  'slash.builtin': 'встроенная',
  'slash.nav': '↑↓ навигация',
  'slash.select': 'Enter выбрать',
  'slash.close': 'Esc закрыть',
  'slash.group.builtin': 'Команды',
  'slash.group.prompt': 'Шаблоны промптов',
  'slash.group.extension': 'Команды расширений',
  'slash.group.skill': 'Навыки',

  'cmd.model': 'Выбрать модель',
  'cmd.skills': 'Просмотреть навыки и вставить команду навыка',
  'cmd.prompts': 'Просмотреть шаблоны промптов',
  'cmd.new': 'Начать новый чат',
  'cmd.resume': 'Переключиться на другую сессию',
  'cmd.compact': 'Сжать контекст текущей сессии',
  'cmd.session': 'Показать информацию о сессии',
  'cmd.abort': 'Остановить текущий ответ',
  'cmd.help': 'Показать все доступные команды',

  'working': 'Работаю',
  'copy.action': 'Копировать',
  'copy.done': '✓ Скопировано',
};

const DICTS = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'zh-HK': zhHK,
  ja,
  ko,
  ru,
};

// ── Current locale ─────────────────────────────────────────────────────────

function detectLocale() {
  let saved = '';
  try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch {}
  if (saved && DICTS[saved]) return saved;

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'en'];

  for (const raw of candidates) {
    const tag = String(raw || '').toLowerCase().replace('_', '-');
    if (tag.startsWith('zh')) {
      if (/-hk\b/.test(tag)) return 'zh-HK';
      if (/-tw\b/.test(tag) || /-mo\b/.test(tag) || tag.includes('hant')) return 'zh-TW';
      return 'zh-CN';
    }
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('ko')) return 'ko';
    if (tag.startsWith('ru')) return 'ru';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

let currentLocale = detectLocale();

export function getLocale() {
  return currentLocale;
}

export function getLocaleInfo(id = currentLocale) {
  return LOCALES.find((l) => l.id === id) || LOCALES[0];
}

let pluralRules = null;
let pluralRulesLocale = '';

function pluralCategory(count) {
  if (!pluralRules || pluralRulesLocale !== currentLocale) {
    try {
      pluralRules = new Intl.PluralRules(currentLocale);
    } catch {
      pluralRules = new Intl.PluralRules('en');
    }
    pluralRulesLocale = currentLocale;
  }
  try {
    return pluralRules.select(count);
  } catch {
    return 'other';
  }
}

// t('key') / t('key', { name: 'x', count: 3 })
export function t(key, params = {}) {
  const dict = DICTS[currentLocale] || DICTS.en;
  let value = dict[key];
  if (value === undefined) value = DICTS.en[key];
  if (value === undefined) return key;

  if (value && typeof value === 'object') {
    const count = params.count === undefined ? 1 : Number(params.count) || 0;
    value = value[pluralCategory(count)] ?? value.other ?? value.one ?? '';
  }

  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]));
}

// Persist the choice and reload. Re-rendering in place would have to rebuild the
// session list, the transcript and every cached template; a reload is both
// simpler and guaranteed complete.
export function setLocale(id) {
  if (!DICTS[id] || id === currentLocale) return;
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  currentLocale = id;
  location.reload();
}

// Translate everything declared in the HTML shell:
//   data-i18n → textContent        data-i18n-html → innerHTML
//   data-i18n-title / -placeholder / -aria-label → the matching attribute
export function applyStaticI18n(root = document) {
  document.documentElement.lang = currentLocale;

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  for (const [datasetKey, attribute] of [
    ['i18nTitle', 'title'],
    ['i18nPlaceholder', 'placeholder'],
    ['i18nAriaLabel', 'aria-label'],
  ]) {
    root.querySelectorAll(`[data-${datasetKey.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)
      .forEach((el) => el.setAttribute(attribute, t(el.dataset[datasetKey])));
  }
}
