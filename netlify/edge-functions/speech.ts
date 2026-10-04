/**
 * Text to speech for lectures, through OpenRouter's speech endpoint (OpenAI voices).
 * The browser sends one chunk of script at a time and gets MP3 bytes back.
 *
 * Env:
 *   OPENROUTER_API_KEY     required
 *   OPENROUTER_TTS_MODEL   optional, default "openai/gpt-4o-mini-tts-2025-12-15"
 */

import type { Config } from '@netlify/edge-functions'
import { OPENROUTER_BASE_URL, SPEECH_MODEL, isSpeechRequest, speechBody } from '../../src/app/prompts.ts'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST a speech request.' }, 405)

  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'No server-side OpenRouter key. Add one in Settings or set OPENROUTER_API_KEY.' }, 501)

  const body = await req.json().catch(() => null)
  if (!isSpeechRequest(body)) return json({ error: 'Invalid speech request.' }, 400)

  let upstream: Response
  try {
    upstream = await fetch(`${OPENROUTER_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': Netlify.env.get('URL') || 'https://passiveexpertise.netlify.app',
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(speechBody(body, Netlify.env.get('OPENROUTER_TTS_MODEL') || SPEECH_MODEL)),
    })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return json({ error: `Voice service returned ${upstream.status}.`, detail: detail.slice(0, 400) }, 502)
  }

  return new Response(upstream.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } })
}

export const config: Config = { path: '/api/speech', method: 'POST' }
