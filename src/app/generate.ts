/**
 * Generation client. Uses the browser key from Settings when one is set; otherwise
 * the Netlify function and its server-side key.
 */

import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  completionBody,
  parseCompletionJson,
  type GenRequest,
} from './prompts.ts'

export interface Settings {
  openRouterKey: string
  model: string
}

const SETTINGS_KEY = 'xe-settings-v1'

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>
    return { openRouterKey: s.openRouterKey ?? '', model: s.model || DEFAULT_MODEL }
  } catch {
    return { openRouterKey: '', model: DEFAULT_MODEL }
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* blocked storage: settings last for this visit only */
  }
}

export async function generate(req: GenRequest, settings: Settings): Promise<Record<string, unknown> & { model: string }> {
  if (settings.openRouterKey.trim()) {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.openRouterKey.trim()}`,
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(completionBody(req, settings.model)),
    })
    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}. Check the key in Settings.`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const parsed = parseCompletionJson(data.choices?.[0]?.message?.content ?? '')
    if (!parsed) throw new Error('The model did not return JSON. Try again.')
    return { ...parsed, model: settings.model }
  }

  const res = await fetch('/.netlify/functions/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  })
  const data = (await res.json().catch(() => null)) as (Record<string, unknown> & { model: string; error?: string }) | null
  if (!res.ok || !data) {
    throw new Error(data?.error ?? 'Generation is unavailable here. Add an OpenRouter key in Settings.')
  }
  return data
}
