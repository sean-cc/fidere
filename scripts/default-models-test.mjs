import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOMMENDED_DEFAULT_MODELS,
  chooseInitialModel,
  recommendedDefaultModel,
} from '../default-models.js';

const model = (provider, id) => ({ provider, id, name: id });

const DEEPSEEK = [model('deepseek', 'deepseek-flash'), model('deepseek', 'deepseek-v4-pro')];

test('deepseek is recommended on flash, not the upstream default pro', () => {
  assert.equal(RECOMMENDED_DEFAULT_MODELS.deepseek, 'deepseek-flash');

  const pick = chooseInitialModel(DEEPSEEK, null);
  assert.equal(pick.source, 'recommended');
  assert.equal(pick.model.id, 'deepseek-flash');
});

test('a saved default always wins, even when it is the expensive model', () => {
  const pick = chooseInitialModel(DEEPSEEK, { provider: 'deepseek', id: 'deepseek-v4-pro' });
  assert.equal(pick.source, 'settings');
  assert.equal(pick.model.id, 'deepseek-v4-pro');
});

test('a saved default that is no longer available falls back to the recommendation', () => {
  const pick = chooseInitialModel(DEEPSEEK, { provider: 'deepseek', id: 'deepseek-v3' });
  assert.equal(pick.source, 'recommended');
  assert.equal(pick.model.id, 'deepseek-flash');
});

test('the recommendation wins when several providers are configured', () => {
  // The SDK table lists deepseek before moonshotai, so leaving this to the SDK
  // would land on Pro on a machine that also has other keys.
  const available = [...DEEPSEEK, model('moonshotai-cn', 'kimi-k2.7-code')];
  const pick = chooseInitialModel(available, null);
  assert.equal(pick.model.provider, 'deepseek');
  assert.equal(pick.model.id, 'deepseek-flash');
});

test('deployments without a recommendation keep the SDK behaviour', () => {
  const available = [model('anthropic', 'claude-opus-5-5'), model('moonshotai-cn', 'kimi-k2.7-code')];
  assert.equal(chooseInitialModel(available, null), undefined);
  assert.equal(chooseInitialModel([], null), undefined);
  assert.equal(chooseInitialModel(undefined, null), undefined);
});

test('the recommendation is ignored when that model is not available', () => {
  const available = [model('deepseek', 'deepseek-v4-pro')];
  assert.equal(recommendedDefaultModel(available, 'deepseek'), undefined);
  assert.equal(chooseInitialModel(available, null), undefined);
});
