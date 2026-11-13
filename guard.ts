/**
 * Fidere task guard.
 *
 * A scheduled task runs unattended, so a mistake repeats all night instead of
 * being seen once. This is the hard boundary that a prompt cannot provide:
 * destructive shell commands are refused and file writes stay inside the task's
 * own directory. The rules live in guard-core.js so they can be unit tested.
 *
 * Loaded by runner.js via `--extension`. Disable with FIDERE_GUARD=off.
 *
 * It is not a sandbox: `bash` can still reach anything the user account can
 * reach, and a path built at runtime defeats the redirection check. Real
 * isolation needs a container or a dedicated user account.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import fs from "node:fs";
import { evaluateToolCall } from "./guard-core.js";

export default function (pi: ExtensionAPI) {
  const work = path.resolve(process.env.FIDERE_WORK_DIR || process.cwd());
  const logPath = path.join(work, "blocked.log");

  pi.on("tool_call", async (event) => {
    if (process.env.FIDERE_GUARD === "off") return;

    const verdict = evaluateToolCall(event.toolName, event.input, work);
    if (!verdict) return;

    try {
      fs.appendFileSync(
        logPath,
        `${new Date().toISOString()}\t${verdict.why}\t${String(verdict.detail).slice(0, 300)}\n`,
      );
    } catch {
      // The guard must never fail a task just because it could not log.
    }

    return {
      block: true,
      reason: `Blocked by the Fidere task guard. ${verdict.reason} Do not retry this; produce the result another way.`,
    };
  });
}
