/**
 * One streaming generator for every step (catalog, chapters, study tools, fact-checks).
 * The browser POSTs a GenRequest; this streams OpenRouter's answer back as plain text
 * while it is written. An edge function so long chapters aren't cut off by the
 * serverless time limit, and so the first words show up within a second or two.
 *
 * Env:
 *   OPENROUTER_API_KEY         required
 *   OPENROUTER_MODEL           optional, default "deepseek/deepseek-chat"
 *   OPENROUTER_FACTCHECK_MODEL optional, default "perplexity/sonar"
 */

import type { Config } from '@netlify/edge-functions'
import {
  DEFAULT_MODEL,
  FACTCHECK_MODEL,
  OPENROUTER_BASE_URL,
  completionBody,
  isGenRequest,
  modelFor,
  sseToText,
} from '../../src/app/prompts.ts'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST a generation request.' }, 405)

  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'No server-side OpenRouter key. Add one in Settings or set OPENROUTER_API_KEY.' }, 501)

  const body = await req.json().catch(() => null)
  if (!isGenRequest(body)) return json({ error: 'Invalid generation request.' }, 400)

  const model = modelFor(
    body.kind,
    Netlify.env.get('OPENROUTER_MODEL') || DEFAULT_MODEL,
    Netlify.env.get('OPENROUTER_FACTCHECK_MODEL') || FACTCHECK_MODEL,
  )

  let upstream: Response
  try {
    upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': Netlify.env.get('URL') || 'https://github.com/ZPARXMarketing/PassiveExpertiseEngine',
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(completionBody(body, model)),
    })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return json({ error: `OpenRouter returned ${upstream.status}.`, detail: detail.slice(0, 400) }, 502)
  }

  return new Response(upstream.body.pipeThrough(sseToText()).pipeThrough(new TextEncoderStream()), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-model': model, 'cache-control': 'no-store' },
  })
}

export const config: Config = { path: '/api/generate', method: 'POST' }
