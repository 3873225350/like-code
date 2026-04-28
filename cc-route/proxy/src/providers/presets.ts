/**
 * Pre-configured provider presets for common API services.
 * Users can reference these by name in their config instead of writing full URLs.
 *
 * Example:
 *   {
 *     "modelRoutes": {
 *       "gpt-4o": {
 *         "alias": "gpt4",
 *         "preset": "openrouter",
 *         "authToken": "sk-or-..."
 *       }
 *     }
 *   }
 *
 * This expands to:
 *   {
 *     "modelRoutes": {
 *       "gpt-4o": {
 *         "alias": "gpt4",
 *         "baseURL": "https://openrouter.ai/api/v1",
 *         "authToken": "sk-or-..."
 *       }
 *     }
 *   }
 */

export interface ProviderPreset {
  name: string
  baseURL: string
  description: string
  docsURL?: string
  /** Default headers injected for all requests to this provider */
  defaultHeaders?: Record<string, string>
  /** Whether this provider supports the Anthropic messages format natively */
  supportsAnthropicFormat?: boolean
  /** Path prefix to append if the provider doesn't use root-level routing */
  pathPrefix?: string
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    description: 'Unified API for 200+ models. Routes to the best available provider automatically.',
    docsURL: 'https://openrouter.ai/docs',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/3873225350/cc-route',
      'X-Title': 'cc-route',
    },
    supportsAnthropicFormat: false,
  },

  siliconflow: {
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    description: 'Chinese AI infrastructure platform. High-performance inference for major models.',
    docsURL: 'https://docs.siliconflow.cn/',
    supportsAnthropicFormat: false,
  },

  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    description: 'Official OpenAI API (GPT-4, GPT-4o, o1, etc.)',
    docsURL: 'https://platform.openai.com/docs',
    supportsAnthropicFormat: false,
  },

  azure_openai: {
    name: 'Azure OpenAI',
    baseURL: '', // Must be provided by user: https://{resource}.openai.azure.com/openai/deployments/{deployment}
    description: 'Microsoft Azure OpenAI Service. Requires custom baseURL with resource name.',
    docsURL: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
    supportsAnthropicFormat: false,
    defaultHeaders: {
      'api-key': '${apiKey}', // Special marker — replaced at runtime
    },
  },

  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    description: 'Ultra-fast inference API. Llama, Mixtral, Gemma.',
    docsURL: 'https://console.groq.com/docs',
    supportsAnthropicFormat: false,
  },

  together: {
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    description: 'Fast inference for open-source models.',
    docsURL: 'https://docs.together.ai/',
    supportsAnthropicFormat: false,
  },

  fireworks: {
    name: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    description: 'Fast inference for open-source models. Mixtral, Llama, DBRX.',
    docsURL: 'https://docs.fireworks.ai/',
    supportsAnthropicFormat: false,
  },

  perplexity: {
    name: 'Perplexity',
    baseURL: 'https://api.perplexity.ai',
    description: 'PPLX API with web search grounding.',
    docsURL: 'https://docs.perplexity.ai/',
    supportsAnthropicFormat: false,
  },

  // Anthropic-compatible providers
  anthropic: {
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com',
    description: 'Official Anthropic API (Claude 3/4 family). Native messages format.',
    docsURL: 'https://docs.anthropic.com/',
    supportsAnthropicFormat: true,
  },

  minimax: {
    name: 'MiniMax',
    baseURL: 'https://api.minimaxi.com/anthropic',
    description: 'MiniMax API with Anthropic-compatible endpoint.',
    supportsAnthropicFormat: true,
  },

  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/anthropic',
    description: 'DeepSeek API with Anthropic-compatible endpoint.',
    supportsAnthropicFormat: true,
  },

  kimi: {
    name: 'Moonshot AI (Kimi)',
    baseURL: 'https://api.moonshot.cn/v1',
    description: 'Moonshot Kimi API. Long-context specialist.',
    docsURL: 'https://platform.moonshot.cn/docs',
    supportsAnthropicFormat: false,
  },

  glm: {
    name: 'GLM (Zhipu AI)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    description: 'Zhipu AI GLM series. Chinese-optimized.',
    docsURL: 'https://open.bigmodel.cn/dev/howuse/model',
    supportsAnthropicFormat: false,
  },
}

/**
 * Expand a preset reference into full route configuration.
 */
export function expandPreset(
  presetName: string,
  authToken?: string,
  customBaseURL?: string,
): Omit<ProviderPreset, 'name'> & { baseURL: string } | null {
  const preset = PROVIDER_PRESETS[presetName.toLowerCase()]
  if (!preset) return null

  const baseURL = customBaseURL || preset.baseURL
  if (!baseURL) {
    throw new Error(`Provider preset "${presetName}" requires a custom baseURL`)
  }

  const headers: Record<string, string> = { ...preset.defaultHeaders }

  // Replace Azure api-key marker
  if (headers['api-key'] === '${apiKey}' && authToken) {
    headers['api-key'] = authToken
    delete headers['Authorization']
  }

  return {
    baseURL,
    description: preset.description,
    docsURL: preset.docsURL,
    defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    supportsAnthropicFormat: preset.supportsAnthropicFormat,
    pathPrefix: preset.pathPrefix,
  }
}

/** List all available preset names for help/validation */
export function listPresets(): Array<{ name: string; description: string }> {
  return Object.entries(PROVIDER_PRESETS).map(([key, preset]) => ({
    name: key,
    description: preset.description,
  }))
}
