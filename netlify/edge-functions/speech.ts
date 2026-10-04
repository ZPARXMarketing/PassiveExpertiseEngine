/**
 * Text to speech for lectures, through OpenRouter's speech endpoint.
 *   POST /api/speech  one chunk of script → MP3 bytes
 *   GET  /api/speech  the speech models + voices OpenRouter offers (for Settings)
 *
 * Env:
 *   OPENROUTER_API_KEY     required
 *   OPENROUTER_TTS_MODEL   optional preferred model (used only if OpenRouter lists it)
 */

/** OpenRouter's speech model list, kept for the life of this edge isolate */
let cached: { at: number; models: SpeechModel[] } | null = null
async function models(apiKey: string): Promise<SpeechModel[]> {
  if (!cached || Date.now() - cached.at > 10 * 60 * 1000 || !cached.models.length)
    cached = { at: Date.now(), models: await listSpeechModels(apiKey).catch(() => []) }
  return cached.models
}

import type { Config } from '@netlify/edge-functions'
import { SPEECH_MODEL, isSpeechRequest, listSpeechModels, pickSpeechModel, synthesize, type SpeechModel } from '../../src/app/prompts.ts'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request) => {
  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'No server-side OpenRouter key. Add one in Settings or set OPENROUTER_API_KEY.' }, 501)
  const list = await models(apiKey)
  const defaultModel = pickSpeechModel(list, Netlify.env.get('OPENROUTER_TTS_MODEL') || SPEECH_MODEL)

  if (req.method === 'GET') return json({ models: list, defaultModel }, 200)
  if (req.method !== 'POST') return json({ error: 'POST a speech request.' }, 405)

  const body = await req.json().catch(() => null)
  if (!isSpeechRequest(body)) return json({ error: 'Invalid speech request.' }, 400)

  try {
    const out = await synthesize(apiKey, body, pickSpeechModel(list, body.model || defaultModel), {
      'HTTP-Referer': Netlify.env.get('URL') || 'https://passiveexpertise.netlify.app',
    })
    if (!out.ok) return json({ error: `Voice service returned ${out.status}: ${out.detail || 'no detail'}` }, 502)
    return new Response(out.res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }
}

export const config: Config = { path: '/api/speech', method: ['GET', 'POST'] }
