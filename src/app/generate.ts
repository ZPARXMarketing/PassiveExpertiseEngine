/**
 * Generation client. Streams text as it is written and calls `onText` with the
 * full text so far. Uses the browser key from Settings when one is set; otherwise
 * the edge function and its server-side key.
 */

import { DEFAULT_MODEL, OPENROUTER_BASE_URL, completionBody, modelFor, sseToText, type GenRequest } from './prompts.ts'

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

export interface GenResult {
  text: string
  model: string
}

async function readAll(stream: ReadableStream<string>, onText?: (soFar: string) => void): Promise<string> {
  let text = ''
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += value
    onText?.(text)
  }
  return text
}

export async function generate(req: GenRequest, settings: Settings, onText?: (soFar: string) => void): Promise<GenResult> {
  const key = settings.openRouterKey.trim()
  let text: string
  let model: string

  if (key) {
    model = modelFor(req.kind, settings.model)
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'X-Title': 'Expertise Engine' },
      body: JSON.stringify(completionBody(req, model)),
    })
    if (!res.ok || !res.body) throw new Error(`OpenRouter returned ${res.status}. Check the key in Settings.`)
    text = await readAll(res.body.pipeThrough(sseToText()), onText)
  } else {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error ?? 'Generation is unavailable here. Add an OpenRouter key in Settings.')
    }
    model = res.headers.get('x-model') ?? ''
    text = await readAll(res.body.pipeThrough(new TextDecoderStream()), onText)
  }

  if (!text.trim()) throw new Error('The model returned nothing. Try again.')
  return { text, model }
}
