/**
 * Default-model policy for newly created sessions.
 *
 * pi-coding-agent resolves the model of a fresh session from a hard-coded
 * `defaultModelPerProvider` table (`dist/core/model-resolver.js`) whenever
 * `~/.pi/agent/settings.json` has no `defaultProvider`/`defaultModel`. For
 * DeepSeek that table points at `deepseek-v4-pro`, which costs 4.4x the input
 * price of `deepseek-flash` ($1.32 vs $0.30 per M tokens; $3.96 vs $1.20 for
 * output) and is text-only, while `deepseek-flash` also accepts images. A
 * fresh install therefore opened on the expensive model without saying so.
 *
 * Fidere keeps its own table here, stores it as the saved default at setup
 * time, falls back to it when a session starts without a saved default, and
 * shows it in the model picker so the choice is visible instead of implicit.
 *
 * Only providers whose upstream default is clearly the wrong first pick belong
 * in this table. Everything else stays with the SDK, so upgrading the SDK keeps
 * working as its authors intended.
 */
export const RECOMMENDED_DEFAULT_MODELS = Object.freeze({
  deepseek: 'deepseek-flash',
});

/** The recommended model for `provider`, if it is in the available list. */
export function recommendedDefaultModel(models, provider) {
  const id = RECOMMENDED_DEFAULT_MODELS[provider];
  if (!id || !Array.isArray(models)) return undefined;
  return models.find(m => m.provider === provider && m.id === id);
}

/**
 * Choose the model a new session should start on.
 *
 * - `settings` wins when the saved default is available: that is an explicit
 *   user choice, even if it is the expensive model.
 * - Otherwise the recommendation table applies. It is checked across all
 *   providers because the SDK table lists deepseek before most other providers,
 *   so a machine with several configured keys would still land on Pro.
 * - `undefined` means "let the SDK decide", which keeps the existing behaviour
 *   for every provider we have no opinion on.
 *
 * @param {Array<{provider: string, id: string}>} models available models (auth configured)
 * @param {{provider: string, id: string}|null|undefined} preferred saved default from settings.json
 * @returns {{model: object, source: 'settings'|'recommended'}|undefined}
 */
export function chooseInitialModel(models, preferred) {
  if (!Array.isArray(models) || models.length === 0) return undefined;

  if (preferred?.provider && preferred?.id) {
    const found = models.find(m => m.provider === preferred.provider && m.id === preferred.id);
    if (found) return { model: found, source: 'settings' };
  }

  for (const provider of Object.keys(RECOMMENDED_DEFAULT_MODELS)) {
    const model = recommendedDefaultModel(models, provider);
    if (model) return { model, source: 'recommended' };
  }

  return undefined;
}
