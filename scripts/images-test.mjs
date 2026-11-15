import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { IMAGE_BUDGET, shrinkToolImages } from '../images.js';

// ── a PNG encoder, so the test does not need a fixture file ────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf){
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Noise-heavy PNG stored uncompressed, so its size scales with the pixels. */
function makePng(w, h){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // truecolour
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const o = y * stride + 1 + x * 3;
      raw[o] = (x * 37 + y * 17) & 0xff;
      raw[o + 1] = (x * 11 + y * 53) & 0xff;
      raw[o + 2] = ((x ^ y) * 29) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function toolResultHook(){
  const handlers = [];
  shrinkToolImages({ on: (name, fn) => name === 'tool_result' && handlers.push(fn) });
  assert.equal(handlers.length, 1, 'the extension registers exactly one tool_result handler');
  return handlers[0];
}

const imageBlock = (png) => ({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });

// ── the behaviour that keeps the request body small ────────────────────────
test('a large screenshot is re-encoded inside the byte budget', async () => {
  const png = makePng(1200, 800);
  const before = imageBlock(png);
  assert.ok(before.data.length > 1_000_000, 'fixture is big enough to matter');

  const patch = await toolResultHook()({
    toolName: 'read',
    content: [{ type: 'text', text: 'Read image file [image/png]' }, before],
  }, {});

  assert.ok(patch, 'the result is patched');
  const images = patch.content.filter((b) => b.type === 'image');
  assert.equal(images.length, 1);
  const after = images[0];

  const afterBytes = Math.floor(after.data.length * 3 / 4);
  assert.ok(
    afterBytes <= IMAGE_BUDGET.MAX_BYTES * 1.1,
    `encoded image is ${afterBytes} bytes, budget is ${IMAGE_BUDGET.MAX_BYTES}`,
  );
  assert.ok(after.data.length < before.data.length * 0.5, 'it is much smaller than the original');
  assert.ok(['image/jpeg', 'image/png'].includes(after.mimeType));
});

test('the model is told the pixels no longer match the file on disk', async () => {
  const patch = await toolResultHook()({ content: [imageBlock(makePng(1200, 800))] }, {});
  const note = patch.content.find((b) => b.type === 'text');
  assert.ok(note, 'a dimension note is inserted');
  assert.match(note.text, /\d/);
});

test('an image that is already cheap is left byte-for-byte alone', async () => {
  const small = imageBlock(makePng(40, 30));
  const patch = await toolResultHook()({ content: [small] }, {});
  assert.equal(patch, undefined, 'nothing is rewritten');
});

test('text-only results are not touched', async () => {
  const content = [{ type: 'text', text: 'ok' }, { type: 'text', text: 'x'.repeat(500_000) }];
  const patch = await toolResultHook()({ content }, {});
  assert.equal(patch, undefined);
});

test('every image in a result is handled, not just the first', async () => {
  const patch = await toolResultHook()({
    content: [imageBlock(makePng(1200, 800)), imageBlock(makePng(1200, 800))],
  }, {});
  const images = patch.content.filter((b) => b.type === 'image');
  assert.equal(images.length, 2);
  for (const img of images){
    assert.ok(Math.floor(img.data.length * 3 / 4) <= IMAGE_BUDGET.MAX_BYTES * 1.1);
  }
});

// ── the wiring the server depends on ───────────────────────────────────────
test('the SDK loader accepts the factory alongside normal discovery', async () => {
  const { DefaultResourceLoader } = await import('@earendil-works/pi-coding-agent');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const root = mkdtempSync(join(tmpdir(), 'fidere-images-'));
  try {
    const loader = new DefaultResourceLoader({
      cwd: root,
      agentDir: root,
      extensionFactories: [{ name: 'fidere-images', factory: shrinkToolImages }],
    });
    await loader.reload();
    const loaded = loader.getExtensions();
    assert.deepEqual(loaded.errors, [], 'no extension failed to load');
    const names = loaded.extensions.map((e) => e.name || e.path || '');
    assert.ok(
      names.some((n) => String(n).includes('fidere-images')),
      `inline extension is registered: ${JSON.stringify(names)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
