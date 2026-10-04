/**
 * Text to speech for lectures, through OpenRouter's speech endpoint.
 *   POST /api/speech  one chunk of script → MP3 bytes
 *   GET  /api/speech  the speech models + voices OpenRouter offers (for Settings)
 *
 * Env:
 *   OPENROUTER_API_KEY     required
 *   OPENROUTER_TTS_MODEL   optional default model, "openai/gpt-4o-mini-tts-2025-12-15"
 */

import type { Config } from '@netlify/edge-functions'
import { SPEECH_MODEL, isSpeechRequest, listSpeechModels, synthesize } from '../../src/app/prompts.ts'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request) => {
  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'No server-side OpenRouter key. Add one in Settings or set OPENROUTER_API_KEY.' }, 501)
  const defaultModel = Netlify.env.get('OPENROUTER_TTS_MODEL') || SPEECH_MODEL

  if (req.method === 'GET') {
    const models = await listSpeechModels(apiKey).catch(() => [])
    return json({ models, defaultModel }, 200)
  }
  if (req.method !== 'POST') return json({ error: 'POST a speech request.' }, 405)

  const body = await req.json().catch(() => null)
  if (!isSpeechRequest(body)) return json({ error: 'Invalid speech request.' }, 400)

  try {
    const out = await synthesize(apiKey, body, body.model || defaultModel, {
      'HTTP-Referer': Netlify.env.get('URL') || 'https://passiveexpertise.netlify.app',
    })
    if (!out.ok) return json({ error: `Voice service returned ${out.status}: ${out.detail || 'no detail'}` }, 502)
    return new Response(out.res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }
}

export const config: Config = { path: '/api/speech', method: ['GET', 'POST'] }
