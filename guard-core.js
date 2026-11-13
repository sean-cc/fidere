// The rules behind guard.ts, kept as plain JavaScript so they can be unit
// tested without launching pi. guard.ts is only the extension adapter.
import path from 'node:path';
//
// A scheduled task repeats its mistakes unattended, so the boundary has to live
// in code. Keep these rules few and unambiguous: a guard that blocks ordinary
// work teaches users to turn the guard off.

const RULES = [
  { re: /\bsudo\b/, why: 'privilege escalation' },
  { re: /\bgit\s+push\b[^\n]*(\s-f\b|\s--force\b)/, why: 'force push' },
  { re: /\bgit\s+reset\s+--hard\b/, why: 'discard uncommitted work' },
  { re: /\brm\s+(-\w+\s+)*\/(\s|$)/, why: 'delete from the filesystem root' },
  { re: /\b(mkfs|shutdown|reboot|halt)\b/, why: 'system-level destructive command' },
  { re: /\bdd\b[^\n]*\bof=\/dev\//, why: 'raw disk write' },
  { re: /(^|[\s"'])~?\/?\.pi\/agent\//, why: 'credentials and Fidere settings' },
  { re: /\bcurl\b[^\n]*(\s-d\s|\s--data\b|\s-F\s|\s--upload-file\b)/, why: 'outbound upload' },
  { re: /\bwget\b[^\n]*(--post-data|--post-file)/, why: 'outbound upload' },
  { re: /\bkill\s+-9\s+-1\b/, why: 'kill every process' },
];

// Scratch space a task may legitimately use. Everything else outside the task
// directory is read-only as far as shell redirection goes.
const ALLOWED_OUTSIDE = [
  /^\/dev\/(null|stdout|stderr)$/,
  /^\/tmp(\/|$)/,
  /^\/private\/tmp(\/|$)/,
  /^\/var\/folders\//,
];

/** Absolute or home-anchored write targets in a shell command that leave `work`. */
export function outsideWrites(command, work) {
  const found = [];
  const re = /(?:>>?|\btee\s+(?:-a\s+)?)\s*([^\s;|&<>()]+)/g;
  let match;
  while ((match = re.exec(command))) {
    const raw = match[1];
    if (!raw.startsWith('/') && !raw.startsWith('~')) continue;
    const abs = raw.startsWith('~')
      ? `${process.env.HOME || '/'}${raw.slice(1)}`
      : raw;
    if (abs === work || abs.startsWith(`${work}/`)) continue;
    if (ALLOWED_OUTSIDE.some((allowed) => allowed.test(abs))) continue;
    found.push(raw);
  }
  return found;
}

/**
 * Decide whether one tool call is allowed.
 *
 * Returns null when allowed, or `{ why, detail, reason }` when blocked.
 * `work` is the task's own directory; nothing else is writable.
 */
export function evaluateToolCall(toolName, input, work) {
  if (toolName === 'bash' || toolName === 'powershell') {
    const command = String(input?.command ?? '');
    for (const rule of RULES) {
      if (rule.re.test(command)) {
        return {
          why: rule.why,
          detail: command,
          reason: `This command is not allowed in unattended runs (${rule.why}).`,
        };
      }
    }
    const escaped = outsideWrites(command, work);
    if (escaped.length) {
      return {
        why: 'write outside the task directory',
        detail: command,
        reason: `Only ${work} (and /tmp) is writable; ${escaped.join(', ')} is outside it.`,
      };
    }
    return null;
  }

  if (toolName === 'write' || toolName === 'edit') {
    const target = String(input?.path ?? '');
    if (!target) return null;
    const abs = path.resolve(work, target);
    const root = path.resolve(work);
    if (abs === root || abs.startsWith(`${root}${path.sep}`)) return null;
    return {
      why: 'write outside the task directory',
      detail: abs,
      reason: `Only ${work} is writable. Write the file inside the task directory.`,
    };
  }

  return null;
}
