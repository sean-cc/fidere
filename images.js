// An image an agent reads lands in the transcript exactly as it is on disk, and
// every later turn resends it. A 1180x664 screenshot is ~750 KB of PNG — about
// 1 MB once base64'd — so a day of UI debugging is enough to push the request
// body past what a provider will accept. That is not hypothetical: it is how a
// session reached 486k tokens and 65 MB of images, then failed with
// `413 length limit exceeded` and repeated `NGHTTP2_INTERNAL_ERROR` stream
// resets until it stopped dead.
//
// Shrinking is deterministic, so it belongs to a script rather than a model
// call: 0 tokens, and the agent does not have to remember to do it. Everything
// is kept below a byte budget instead of a pixel size, because bytes are what
// the request is actually limited by.

import { formatDimensionNote, resizeImage } from '@earendil-works/pi-coding-agent';

/** Longest edge after shrinking. Enough to read a 3D scene or a dialog. */
const MAX_EDGE = 1100;
/** Budget for one encoded image. 76 of these still fit comfortably in a body. */
const MAX_BYTES = 110 * 1024;
const JPEG_QUALITY = 80;
/** Images already smaller than this are left byte-for-byte alone. */
const KEEP_BELOW_BYTES = 140 * 1024;

/**
 * Re-encode the images in any tool result that came back too large.
 *
 * Hooked to `tool_result` rather than `tool_call`: `read` has already decoded
 * the file by then, and this is the last point before the image becomes part of
 * the conversation. Non-image blocks, small images, and results the resizer
 * cannot handle are passed through untouched.
 *
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 */
export function shrinkToolImages(pi) {
  pi.on('tool_result', async (event) => {
    if (!Array.isArray(event.content)) return;

    const content = [];
    let changed = false;

    for (const block of event.content){
      if (block?.type !== 'image' || typeof block.data !== 'string'){
        content.push(block);
        continue;
      }

      const bytes = Math.floor(block.data.length * 3 / 4);
      if (bytes <= KEEP_BELOW_BYTES){
        content.push(block);
        continue;
      }

      let resized = null;
      try {
        resized = await resizeImage(Buffer.from(block.data, 'base64'), block.mimeType || 'image/png', {
          maxWidth: MAX_EDGE,
          maxHeight: MAX_EDGE,
          maxBytes: MAX_BYTES,
          jpegQuality: JPEG_QUALITY,
        });
      } catch (err){
        // A resize failure must never lose the image: keep the original and
        // let the turn proceed.
        resized = null;
      }

      if (!resized?.data){
        content.push(block);
        continue;
      }

      changed = true;
      // The model is told the pixels it is looking at no longer match the file
      // on disk, so `read` coordinates and screenshots stay interpretable.
      const note = formatDimensionNote(resized);
      if (note) content.push({ type: 'text', text: note });
      content.push({ ...block, data: resized.data, mimeType: resized.mimeType });
    }

    if (!changed) return;
    return { content };
  });
}

export const IMAGE_BUDGET = { MAX_EDGE, MAX_BYTES, JPEG_QUALITY, KEEP_BELOW_BYTES };
