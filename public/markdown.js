// ── Simple Markdown Renderer ──────────────────────────────────────────────
import { t } from './i18n.js';

export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

export function renderMarkdown(text) {
  if (!text) return '';

  // Extract code blocks from the raw text first: the copy button needs the
  // original code, and the placeholder protects it from escaping/formatting.
  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
    return `\x00CODEBLOCK${idx}\x00`;
  });

  // Images are extracted before the escape pass: the source may be a
  // filesystem path, which becomes a request to /api/local. Rendering them
  // inline is the difference between an agent saying "look at this" and the
  // reader actually seeing it.
  const images = [];
  // Spaces are allowed inside the parentheses: a screenshot path on this
  // machine can contain one ("My Pics/…"), and encodeURIComponent handles it.
  processed = processed.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, (_, alt, src) => {
    const idx = images.length;
    images.push({ alt, src: src.trim() });
    return `\x00IMAGE${idx}\x00`;
  });

  // Tables are extracted from raw text too; cells are escaped later by
  // renderInline so cell-level markdown still works.
  const tables = [];
  processed = processed.replace(
    /^\|(.+)\|\n\|([-:| ]+)\|\n(?:\|.+\|\n?)+/gm,
    (match) => {
      const idx = tables.length;
      tables.push(match.split('\n').filter(l => l.trim()));
      return `\x00TABLE${idx}\x00`;
    }
  );

  // Inline code is protected before the global escape pass.
  const inlineCodes = [];
  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `\x00INLINECODE${idx}\x00`;
  });

  // Escape all remaining text. This is the key XSS guard: everything that is
  // not one of the generated tags below is now inert.
  processed = escapeHtml(processed);

  // Explicit http(s) links. The label and URL are already HTML-escaped, and
  // the scheme allow-list prevents javascript:/data: URLs.
  processed = processed.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Bold / italic (contents are already escaped).
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers
  processed = processed.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  processed = processed.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  processed = processed.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  processed = processed.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquotes (the leading > was escaped to &gt; above)
  processed = processed.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  processed = processed.replace(/^---$/gm, '<hr>');

  // Lists: extract each block before paragraph wrapping so ordered and
  // unordered items cannot be nested inside each other by later passes.
  const lists = [];
  processed = processed.replace(/^(?:\d+\. .+(?:\n|$))+/gm, (block) => {
    const idx = lists.length;
    const items = block.trimEnd().split('\n')
      .map(line => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    lists.push(`<ol>${items}</ol>`);
    return `\x00LIST${idx}\x00\n`;
  });
  processed = processed.replace(/^(?:[*-] .+(?:\n|$))+/gm, (block) => {
    const idx = lists.length;
    const items = block.trimEnd().split('\n')
      .map(line => `<li>${line.replace(/^[*-]\s+/, '')}</li>`)
      .join('');
    lists.push(`<ul>${items}</ul>`);
    return `\x00LIST${idx}\x00\n`;
  });

  // Paragraphs: wrap remaining text blocks in <p>
  processed = processed.replace(/\n\n+/g, '</p><p>');
  processed = '<p>' + processed + '</p>';
  processed = processed.replace(/<p>\s*<\/p>/g, '');
  // Keep block elements out of paragraph wrappers.
  processed = processed.replace(/<p>\s*(<h[1-6][^>]*>)/g, '$1');
  processed = processed.replace(/(<\/h[1-6]>)\s*<\/p>/g, '$1');
  processed = processed.replace(/<p>\s*(<blockquote>)/g, '$1');
  processed = processed.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
  processed = processed.replace(/<p>\s*(<hr>)\s*<\/p>/g, '$1');
  processed = processed.replace(/<p>\x00(?:TABLE|LIST|CODEBLOCK)(\d+)\x00<\/p>/g, (match, idx) => match.replace(/<p>|<\/p>/g, ''));

  // Restore lists and tables
  processed = processed.replace(/\x00LIST(\d+)\x00/g, (_, idx) => lists[parseInt(idx)]);
  processed = processed.replace(/\x00TABLE(\d+)\x00/g, (_, idx) => renderTable(tables[parseInt(idx)]));

  // Restore images. A token that ended up alone in a paragraph has its <p>
  // dropped for the same reason a table does: the wrapper adds a line of
  // leading between it and the sentence above.
  processed = processed.replace(/<p>\s*\x00IMAGE(\d+)\x00\s*<\/p>/g, '\x00IMAGE$1\x00');
  processed = processed.replace(/\x00IMAGE(\d+)\x00/g, (_, idx) => renderImage(images[parseInt(idx, 10)]));

  // Restore code blocks, using the raw code for both display and copy.
  processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
    const block = codeBlocks[parseInt(idx)];
    const label = block.lang ? escapeHtml(block.lang) : 'text';
    const header = `<div class="code-header"><span>${label}</span><button class="copy-btn" data-code="${encodeURIComponent(block.code)}">${escapeHtml(t('copy.action'))}</button></div>`;
    return `${header}<pre><code>${escapeHtml(block.code)}</code></pre>`;
  });

  // Restore inline code after all tag-generating passes.
  processed = processed.replace(/\x00INLINECODE(\d+)\x00/g, (_, idx) =>
    `<code>${escapeHtml(inlineCodes[parseInt(idx)])}</code>`
  );

  // Final safety pass: block-level output must not sit inside <p>.
  processed = processed.replace(/<p>\s*(<ul>|<ol>|<blockquote>|<h[1-6][^>]*>|<hr>|<div class="(?:table-wrapper|code-header)">|<pre>)/g, '$1');
  processed = processed.replace(/(<\/ul>|<\/ol>|<\/blockquote>|<\/h[1-6]>|<\/div>|<\/pre>)\s*<\/p>/g, '$1');
  processed = processed.replace(/<p>\s*<\/p>/g, '');

  return processed;
}

/* Where an <img src> should point. Absolute URLs and data URIs are passed
 * through unchanged; anything else is taken to be a path on this machine and
 * handed to the /api/local route. */
function imageHref(src) {
  const raw = String(src || '');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^data:image\//i.test(raw)) return raw;
  if (!raw) return '';
  return `api/local?path=${encodeURIComponent(raw)}`;
}

// alt and src are attacker-controlled as far as this renderer knows; both are
// escaped, and a javascript: URL never reaches here because imageHref() only
// returns https, data:image/, or a route this server builds itself.
function renderImage(image) {
  if (!image) return '';
  // escapeHtml already covers quotes, so it is a valid attribute escaper here.
  const escapeAttr = escapeHtml;
  const href = imageHref(image.src);
  if (!href) return escapeHtml(image.alt || '');
  return `<a class="md-image" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
    + `<img src="${escapeAttr(href)}" alt="${escapeAttr(image.alt || '')}" loading="lazy" decoding="async">`
    + `</a>`;
}

function renderInline(text) {
  // Table cells are raw here; escape once, then apply inline markdown.
  let result = escapeHtml(text);
  const inlineCodes = [];
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `\x00INLINECODE${idx}\x00`;
  });
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/\x00INLINECODE(\d+)\x00/g, (_, idx) => `<code>${inlineCodes[parseInt(idx)]}</code>`);
  return result;
}

// Split one table row into cells. Mirrors GFM: the leading and trailing pipe
// are optional delimiters, `\|` is a literal pipe, and — critically — EMPTY
// cells are preserved. Filtering them out (as this used to do) shifts every
// column after the empty one and de-aligns the header against the body.
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);

  // Drop a trailing pipe unless it is escaped (`\|`) — count the backslashes.
  if (s.endsWith('|')) {
    let backslashes = 0;
    for (let i = s.length - 2; i >= 0 && s[i] === '\\'; i--) backslashes++;
    if (backslashes % 2 === 0) s = s.slice(0, -1);
  }

  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

function renderTable(lines) {
  if (!lines || lines.length < 2) return '';

  // Drop a delimiter row that carries more than one cell (kept for parity with
  // the GFM spec check below) and read the header + delimiter cells.
  const headerCells = splitRow(lines[0]);
  const delimiterCells = splitRow(lines[1]);
  const bodyRows = lines.slice(2).map(splitRow);

  // Column count is the widest row, so a malformed table never loses content
  // and never renders a ragged grid.
  const columnCount = Math.max(
    headerCells.length,
    delimiterCells.length,
    ...bodyRows.map(cells => cells.length),
    1,
  );

  const alignments = [];
  for (let i = 0; i < columnCount; i++) {
    const trimmed = (delimiterCells[i] || '').trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) alignments.push('center');
    else if (trimmed.endsWith(':')) alignments.push('right');
    else alignments.push('left');
  }

  const renderRow = (cells, tag) => {
    let row = '<tr>';
    for (let i = 0; i < columnCount; i++) {
      const cell = cells[i] === undefined ? '' : cells[i];
      row += `<${tag} style="text-align:${alignments[i]}">${renderInline(cell.trim())}</${tag}>`;
    }
    return row + '</tr>';
  };

  let html = '<div class="table-wrapper"><table>';
  html += '<thead>' + renderRow(headerCells, 'th') + '</thead>';

  if (bodyRows.length > 0) {
    html += '<tbody>' + bodyRows.map(cells => renderRow(cells, 'td')).join('') + '</tbody>';
  }

  html += '</table></div>';
  return html;
}
