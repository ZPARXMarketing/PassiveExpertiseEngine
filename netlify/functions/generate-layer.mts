/**
 * Path-layer generator (server-side key path).
 *
 * The browser POSTs one path of one domain plus the layer depth it wants; this
 * function asks a model through OpenRouter for that layer's 5–8 concepts and the
 * practice hanging off them — tasks, retrieval items, teach-backs and drills —
 * and returns it as JSON. One layer per call is the whole point: it is what
 * keeps a domain the size of "quantum mechanics" from arriving all at once.
 * Used only when the site has a server-side key.
 *
 * Env:
 *   OPENROUTER_API_KEY  required for this path
 *   OPENROUTER_MODEL    optional, default "deepseek/deepseek-chat"
 *   OPENROUTER_BASE_URL optional, default "https://openrouter.ai/api/v1"
 */

import { DEFAULT_MODEL, OPENROUTER_BASE_URL, parseCompletionJson } from '../../src/data/studyPrompt.ts'
import { layerCompletionBody, type LayerRequest } from '../../src/data/domainPrompt.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'POST a layer request to this endpoint.' }, 405)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return json(
      {
        error:
          'No server-side key configured. Add your own OpenRouter key in Settings, or set OPENROUTER_API_KEY in the site environment.',
      },
      501,
    )
  }

  let body: LayerRequest
  try {
    body = (await req.json()) as LayerRequest
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!body.topic?.trim() || !body.pathTitle?.trim()) {
    return json({ error: 'Missing "topic" or "pathTitle".' }, 400)
  }

  const request: LayerRequest = {
    topic: body.topic.trim(),
    domainTitle: body.domainTitle?.trim() || body.topic.trim(),
    pathTitle: body.pathTitle.trim(),
    pathPitch: body.pathPitch?.trim() || '',
    pathPayoff: body.pathPayoff?.trim() || '',
    layerIndex: Number.isFinite(body.layerIndex) ? Math.max(0, Math.round(body.layerIndex)) : 0,
    covered: Array.isArray(body.covered) ? body.covered.slice(0, 24) : [],
  }

  const baseUrl = (process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL).replace(/\/$/, '')
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.URL || 'https://domain-engine.netlify.app',
        'X-Title': 'Domain Engine',
      },
      body: JSON.stringify(layerCompletionBody(request, model)),
    })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json(
      {
        error: `OpenRouter returned ${upstream.status}.`,
        detail: detail.slice(0, 400) || undefined,
      },
      502,
    )
  }

  const completion = (await upstream.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null

  const content = completion?.choices?.[0]?.message?.content
  if (!content) {
    return json({ error: 'OpenRouter returned an empty completion.' }, 502)
  }

  const parsed = parseCompletionJson(content)
  if (!parsed) {
    return json({ error: 'The model did not return JSON.' }, 502)
  }

  return json({ ...parsed, model })
}
