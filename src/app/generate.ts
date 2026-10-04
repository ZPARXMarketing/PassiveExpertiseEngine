/**
 * Generation client. Streams text as it is written and calls `onText` with the
 * full text so far. Uses the browser key from Settings when one is set; otherwise
 * the edge function and its server-side key.
 */

import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  SPEECH_MODEL,
  chunkScript,
  completionBody,
  listSpeechModels,
  pickSpeechModel,
  modelFor,
  sseToText,
  synthesize,
  type GenRequest,
  type SpeechModel,
  type SpeechRequest,
} from './prompts.ts'

export interface Settings {
  openRouterKey: string
  model: string
}

const SETTINGS_KEY = 'xe-settings-v1'

/** OpenRouter keys look like sk-or-v1-…; anything else (e.g. an autofilled site password) is ignored. */
export const looksLikeKey = (k: string) => /^sk-or-[\w-]{20,}$/.test(k.trim())

/** The browser's own key, only if it is plausibly a real one. */
const userKey = (s: Settings) => (looksLikeKey(s.openRouterKey) ? s.openRouterKey.trim() : '')

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>
    return { openRouterKey: looksLikeKey(s.openRouterKey ?? '') ? s.openRouterKey!.trim() : '', model: s.model || DEFAULT_MODEL }
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
  const key = userKey(settings)
  let text = ''
  let model = ''
  let viaSite = !key

  if (key) {
    model = modelFor(req.kind, settings.model)
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'X-Title': 'Expertise Engine' },
      body: JSON.stringify(completionBody(req, model)),
    })
    // a rejected browser key falls back to the site's key instead of failing
    if (res.status === 401 || res.status === 403) viaSite = true
    else if (!res.ok || !res.body) throw new Error(`OpenRouter returned ${res.status}.`)
    else text = await readAll(res.body.pipeThrough(sseToText()), onText)
  }
  if (viaSite) {
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

/** One chunk of lecture script → MP3 bytes. */
export async function speak(req: SpeechRequest, settings: Settings): Promise<Blob> {
  const key = userKey(settings)
  if (key) {
    const out = await synthesize(key, req, req.model || SPEECH_MODEL)
    if (out.ok) return out.res.blob()
    // a rejected browser key falls back to the site's key
    if (out.status !== 401 && out.status !== 403) throw new Error(`Voice service returned ${out.status}: ${out.detail || 'no detail'}`)
  }
  const res = await fetch('/api/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? `Voice service returned ${res.status}.`)
  }
  return res.blob()
}

/** Speech models + voices currently offered (via the site, or the browser key). */
export async function speechModels(settings: Settings): Promise<{ models: SpeechModel[]; defaultModel: string }> {
  const key = userKey(settings)
  if (key) {
    const models = await listSpeechModels(key).catch(() => [])
    return { models, defaultModel: pickSpeechModel(models, SPEECH_MODEL) }
  }
  const res = await fetch('/api/speech')
  if (!res.ok) return { models: [], defaultModel: SPEECH_MODEL }
  return (await res.json()) as { models: SpeechModel[]; defaultModel: string }
}

/** A whole script → one MP3 (chunks recorded 3 at a time, joined in order). */
export async function record(
  script: string,
  req: Omit<SpeechRequest, 'text'>, settings: Settings, onProgress: (done: number, total: number) => void): Promise<Blob> {
  const chunks = chunkScript(script)
  const parts: Blob[] = new Array(chunks.length)
  let done = 0
  onProgress(0, chunks.length)
  let next = 0
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++
      parts[i] = await speak({ ...req, text: chunks[i] }, settings)
      onProgress(++done, chunks.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  // MP3 frames are self-contained, so concatenated chunks play as one file
  return new Blob(parts, { type: 'audio/mpeg' })
}

let modelsCache: Promise<{ models: SpeechModel[]; defaultModel: string }> | null = null

/** The teacher's voice if the model supports it, otherwise that model's first voice. */
export async function resolveVoice(voice: string, model: string | undefined, settings: Settings): Promise<{ voice: string; model: string }> {
  modelsCache ??= speechModels(settings).catch(() => ({ models: [], defaultModel: SPEECH_MODEL }))
  const { models, defaultModel } = await modelsCache
  const m = pickSpeechModel(models, model || defaultModel)
  const voices = models.find((x) => x.id === m)?.voices ?? []
  return { voice: !voices.length || voices.includes(voice) ? voice : voices[0], model: m }
}
