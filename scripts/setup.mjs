#!/usr/bin/env node
/**
 * Interactive API-key setup for Fidere.
 *
 * This uses the SDK bundled with Fidere, so users do not need the pi CLI.
 * The key is written to ~/.pi/agent/auth.json by the SDK.
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ModelRuntime, SettingsManager } from '@earendil-works/pi-coding-agent';
import { chooseInitialModel } from '../default-models.js';

const RECOMMENDED = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'openrouter',
  'moonshotai',
  'moonshotai-cn',
  'minimax',
  'minimax-cn',
  'xai',
  'groq',
  'mistral',
  'together',
  'cerebras',
  'fireworks',
  'nvidia',
  'xiaomi',
];

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      reject(new Error('No TTY for hidden input. Set FIDERE_API_KEY or run interactively.'));
      return;
    }

    output.write(question);
    let value = '';
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const char of text) {
        if (char === '\r' || char === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    input.on('data', onData);
  });
}

async function main() {
  const runtime = await ModelRuntime.create();

  const providers = runtime.getProviders()
    .filter(provider => provider.auth?.apiKey && provider.auth.apiKey.login)
    .map(provider => ({
      id: provider.id,
      name: provider.name,
      configured: runtime.getProviderAuthStatus(provider.id).configured,
    }));

  const recommended = RECOMMENDED
    .map(id => providers.find(provider => provider.id === id))
    .filter(Boolean);

  console.log('\nFidere — model provider setup\n');

  let providerId = process.env.FIDERE_PROVIDER?.trim() || '';
  let apiKey = process.env.FIDERE_API_KEY?.trim() || '';

  if (!providerId) {
    recommended.forEach((provider, index) => {
      console.log(
        `  ${String(index + 1).padStart(2)}. ${provider.name.padEnd(28)} ${provider.id}${provider.configured ? '  (configured)' : ''}`,
      );
    });
    console.log('');

    const rl = readline.createInterface({ input, output });
    const answer = (await rl.question('Select a provider by number or id: ')).trim();
    rl.close();

    if (/^\d+$/.test(answer)) {
      providerId = recommended[Number(answer) - 1]?.id || '';
    } else {
      providerId = answer;
    }
  }

  if (!providerId) {
    throw new Error('No provider selected');
  }

  const provider = providers.find(item => item.id === providerId);
  if (!provider) {
    throw new Error(`Provider is not supported by this setup flow: ${providerId}`);
  }

  if (!apiKey) {
    apiKey = (await askHidden(`API key for ${provider.name}: `)).trim();
  }
  if (!apiKey) {
    throw new Error('Empty API key');
  }

  const interaction = {
    prompt: async () => apiKey,
    notify: (event) => {
      if (event?.type === 'progress' && event.message) {
        console.log(`  ${event.message}`);
      }
    },
  };

  console.log(`\nSaving ${provider.name} credentials...`);
  await runtime.login(provider.id, 'api_key', interaction);
  await runtime.refresh();

  const available = await runtime.getAvailable();

  // Without a saved default, the SDK's own per-provider table decides the model
  // of every new session (DeepSeek → the expensive, text-only v4-pro). Write our
  // choice once so a fresh install starts on the model people expect.
  let savedDefault = null;
  const pick = chooseInitialModel(available, null);
  if (pick) {
    try {
      SettingsManager.create(process.cwd()).setDefaultModelAndProvider(pick.model.provider, pick.model.id);
      savedDefault = pick;
    } catch (err) {
      console.warn(`\nCould not save the default model: ${err.message}`);
    }
  } else {
    // Keep an existing saved default, if any.
    try {
      const settings = SettingsManager.create(process.cwd());
      const provider = settings.getDefaultProvider();
      const id = settings.getDefaultModel();
      if (provider && id) savedDefault = { model: { provider, id } };
    } catch {}
  }

  console.log(`\n✓ Configured ${provider.name} (${provider.id})`);
  console.log(`  Available models: ${available.length}`);
  if (savedDefault) {
    console.log(`  Default model: ${savedDefault.model.provider}/${savedDefault.model.id}`);
  }
  console.log('  Credentials: ~/.pi/agent/auth.json');
  console.log('  Default model saved in: ~/.pi/agent/settings.json');
  console.log('\nNext:');
  console.log('  npm start');
  console.log('  open http://localhost:3000');
  console.log('  pick a model from the sidebar ("set default" makes it stick)\n');
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}\n`);
  process.exitCode = 1;
});
