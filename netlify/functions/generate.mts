/**
 * One generator for every step of the drill (branches, courses, syllabus, chapter).
 * The browser POSTs a GenRequest; this asks OpenRouter (DeepSeek by default) and
 * returns the parsed JSON. Used when the site has a server-side key.
 *
 * Env:
 *   OPENROUTER_API_KEY  required
 *   OPENROUTER_MODEL    optional, default "deepseek/deepseek-chat"
 */

import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  completionBody,
  isGenRequest,
  parseCompletionJson,
} from '../../src/app/prompts.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST a generation request.' }, 405)

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return json({ error: 'No server-side OpenRouter key. Add one in Settings or set OPENROUTER_API_KEY.' }, 501)
  }

  const body = await req.json().catch(() => null)
  if (!isGenRequest(body)) return json({ error: 'Invalid generation request.' }, 400)

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  let upstream: Response
  try {
    upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.URL || 'https://passive-expertise-engine.netlify.app',
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(completionBody(body, model)),
    })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json({ error: `OpenRouter returned ${upstream.status}.`, detail: detail.slice(0, 400) }, 502)
  }

  const completion = (await upstream.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const parsed = parseCompletionJson(completion?.choices?.[0]?.message?.content ?? '')
  if (!parsed) return json({ error: 'The model did not return JSON.' }, 502)

  return json({ ...parsed, model })
}
