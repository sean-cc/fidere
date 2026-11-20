import { escapeHtml, renderMarkdown } from './markdown.js';
import { formatBytes, attachmentIsImage, escapeAttr } from './util.js';
import { t } from './i18n.js';

export function parseAttachmentMessage(content) {
  let text = String(content || '');
  let attachments = [];
  const marker = text.match(/<fidere-attachments>([\s\S]*?)<\/fidere-attachments>/);
  if (marker) {
    try {
      const parsed = JSON.parse(marker[1]);
      const list = Array.isArray(parsed) ? parsed : parsed && parsed.files;
      if (Array.isArray(list)) attachments = list;
    } catch {}
    text = text.replace(marker[0], '');
  }
  text = text.replace(/<fidere-content\b[\s\S]*?<\/fidere-content>/g, '');
  text = text.replace(/\[Attached files\][\s\S]*?\[End attachments\]/g, '');
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), attachments };
}

export function renderMessageAttachments(attachments, images) {
  let list = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!list.length && Array.isArray(images) && images.length) {
    list = images.map((img, index) => ({
      id: `image-${index}`,
      name: `image-${index + 1}`,
      mimeType: img.mimeType,
      kind: 'image',
      url: img.dataUrl || (img.data ? `data:${img.mimeType};base64,${img.data}` : ''),
    }));
  }
  if (!list.length) return '';

  const cards = list.map((a) => {
    const name = escapeHtml(a.name || 'attachment');
    const meta = `${escapeHtml(a.mimeType || '')}${a.size ? ' · ' + formatBytes(a.size) : ''}`;
    const href = escapeAttr(a.url || '#');
    const title = escapeAttr(a.path || a.name || '');
    if (attachmentIsImage(a) && a.url) {
      return `<a class="msg-attachment image" href="${href}" target="_blank" rel="noopener noreferrer" title="${title}">
        <img src="${href}" alt="${name}" loading="lazy">
        <span class="msg-attachment-info"><span class="msg-attachment-name">${name}</span><span class="msg-attachment-meta">${meta}</span></span>
      </a>`;
    }
    return `<a class="msg-attachment" href="${href}" target="_blank" rel="noopener noreferrer" title="${title}">
      <span class="file-icon">${a.kind === 'text' ? '📄' : '📎'}</span>
      <span class="msg-attachment-info"><span class="msg-attachment-name">${name}</span><span class="msg-attachment-meta">${meta}</span></span>
    </a>`;
  }).join('');

  return `<div class="msg-attachments">${cards}</div>`;
}

export function renderToolCall(tc, index) {
  let statusClass = 'running';
  let statusText = t('tools.running');
  if (tc.result !== null) {
    statusClass = tc.isError ? 'error' : 'success';
    statusText = tc.isError ? t('tools.error') : t('tools.done');
  }
  const title = tc.name || t('tools.tool');
  let output = tc.result !== null ? String(tc.result) : String(tc.pendingOutput || '');
  if (tc.result !== null) {
    output = output.slice(0, 8000);
  } else if (output.length > 13000) {
    output = t('tools.hidden', { count: output.length - 12000 }) + '\n' + output.slice(-12000);
  }
  const outputType = tc.result !== null ? 'result' : 'output';
  const imagesHtml = renderToolImages(tc.images);
  // A tool that returned a picture opens on it. Collapsing is right for a page
  // of stdout; it is wrong when the result *is* the one thing worth looking at.
  const hasImages = Boolean(imagesHtml);
  const open = tc.result === null || hasImages;
  return `
    <div class="tool-block" data-tool-index="${index}" data-tool-id="${escapeAttr(tc.id ?? '')}">
      <div class="tool-header${open ? ' open' : ''}" onclick="toggleToolBlock(this)">
        <span class="tool-icon">🔧</span>
        <span class="tool-name">${escapeHtml(title)}</span>
        <span class="tool-status ${statusClass}">${statusText}</span>
        <span class="tool-chevron">▶</span>
      </div>
      <div class="tool-body${open ? ' open' : ''}">
        <pre><code>${escapeHtml(JSON.stringify(tc.input || {}, null, 2))}</code></pre>
        ${imagesHtml}
        ${output ? `<pre data-type="${outputType}"><code>${escapeHtml(output)}</code></pre>` : ''}
      </div>
    </div>`;
}

/* A screenshot a tool returned. Shown as a thumbnail with its real size in the
 * caption, link opens the full frame in a new tab: the agent reads images to
 * answer a question, and the answer is unreadable if the picture stays a
 * `[image]` placeholder. */
export function renderToolImages(images) {
  if (!Array.isArray(images) || !images.length) return '';
  const cards = images.map((img, i) => {
    const url = img.dataUrl || (img.data ? `data:${img.mimeType || 'image/png'};base64,${img.data}` : '');
    if (!url) return '';
    const mime = escapeHtml(img.mimeType || 'image');
    return `<a class="tool-image" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" title="${mime}">
      <img src="${escapeAttr(url)}" alt="${escapeAttr('image ' + (i + 1))}" loading="lazy" decoding="async">
    </a>`;
  }).filter(Boolean).join('');
  return cards ? `<div class="tool-images">${cards}</div>` : '';
}

export function renderThinking(thinking) {
  if (!thinking) return '';
  return `
    <div class="thinking-block">
      <div class="thinking-header" onclick="toggleToolBlock(this.parentElement.querySelector('.thinking-body'))">
        <span>💭 ${escapeHtml(t('msg.details'))}</span>
        <span class="tool-chevron">▶</span>
      </div>
      <div class="thinking-body">${escapeHtml(thinking)}</div>
    </div>`;
}

function renderMessageBody(msg) {
  const isUser = msg.role === 'user';
  const parsed = isUser ? parseAttachmentMessage(msg.content) : { text: msg.content, attachments: [] };
  const attachmentsHtml = isUser ? renderMessageAttachments(parsed.attachments, msg.images) : '';

  return `
    ${msg.thinking ? renderThinking(msg.thinking) : ''}
    ${msg.toolCalls && msg.toolCalls.length > 0
      ? msg.toolCalls.map((tc, i) => renderToolCall(tc, i)).join('')
      : ''}
    ${attachmentsHtml}
    ${parsed.text ? `<div class="msg-answer">${renderMarkdown(parsed.text)}</div>` : ''}
  `;
}

export function createMessageStep(msg) {
  const step = document.createElement('div');
  step.className = 'msg-step';
  step.innerHTML = renderMessageBody(msg);
  return step;
}

// A compaction (or branch) snapshot: one collapsed card instead of a bubble.
// The summary can be long, so it stays folded until the reader asks for it.
function createSummaryElement(msg) {
  const div = document.createElement('div');
  div.className = 'msg msg-summary';
  if (msg.id) div.dataset.id = msg.id;

  const tokens = Number(msg.tokensBefore) || 0;
  const tag = msg.kind === 'branch' ? 'branch' : 'compaction';
  const line = tokens
    ? t('msg.compacted', { count: tokens.toLocaleString() })
    : t('msg.summarised');

  div.innerHTML = `
    <div class="msg-content summary-card">
      <button class="summary-head" type="button" aria-expanded="false">
        <span class="summary-tag">${escapeHtml(tag)}</span>
        <span class="summary-line">${escapeHtml(line)}</span>
        <span class="summary-chevron" aria-hidden="true">▸</span>
      </button>
      <div class="summary-body hidden">${msg.summary ? renderMarkdown(msg.summary) : ''}</div>
    </div>`;

  const head = div.querySelector('.summary-head');
  const body = div.querySelector('.summary-body');
  head.addEventListener('click', () => {
    const opening = body.classList.contains('hidden');
    body.classList.toggle('hidden', !opening);
    head.setAttribute('aria-expanded', String(opening));
    div.classList.toggle('open', opening);
  });
  return div;
}

export function createMessageElement(msg) {
  if (msg.role === 'summary') return createSummaryElement(msg);

  const div = document.createElement('div');
  div.className = `msg msg-${msg.role}`;
  div.dataset.id = msg.id;

  // Only a real assistant turn gets the F badge and the collapsible details.
  // Anything else (a stray role) must not masquerade as one.
  const isAssistant = msg.role === 'assistant';
  const avatar = isAssistant ? 'F' : 'U';

  // Reasoning and tool calls are collapsed by default once a reply is done.
  // A live reply is expanded again right after it is appended.
  if (isAssistant) div.classList.add('details-collapsed');

  div.innerHTML = `
    <div class="msg-aside">
      <div class="msg-avatar">${avatar}</div>
      <button class="msg-copy-btn" type="button" title="${escapeAttr(t('msg.copy'))}" aria-label="${escapeAttr(t('msg.copy'))}">⧉</button>
    </div>
    <div class="msg-content">
      ${isAssistant ? `<button class="btn-msg-details hidden" type="button" aria-expanded="true"><span class="btn-msg-details-icon" aria-hidden="true">▸</span><span class="btn-msg-details-label">${t('msg.details')}</span></button>` : ''}
      <div class="msg-steps"></div>
      <div class="msg-meta">
        <time class="msg-time"></time>
        <span class="msg-meta-right">
          ${msg.role === 'user' ? `<button class="msg-edit-btn" type="button" title="${escapeAttr(t('msg.editTitle'))}">${escapeHtml(t('msg.edit'))}</button>` : ''}
          <span class="msg-usage"></span>
        </span>
      </div>
    </div>`;
  div.querySelector('.msg-steps').appendChild(createMessageStep(msg));
  return div;
}
