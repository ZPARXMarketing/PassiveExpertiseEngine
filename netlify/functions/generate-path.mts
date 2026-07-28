/**
 * Learning-path generator (server-side key path).
 *
 * The browser POSTs the goal the user typed; this function asks a model through
 * OpenRouter to design the whole skill path — concept graph, first practice
 * tasks, Feynman prompts and drills — and returns it as JSON. Used only when the
 * site has a server-side key; if the user entered their own OpenRouter key in
 * Settings, the browser calls OpenRouter directly and never touches this.
 *
 * Env:
 *   OPENROUTER_API_KEY  required for this path
 *   OPENROUTER_MODEL    optional, default "deepseek/deepseek-chat"
 *   OPENROUTER_BASE_URL optional, default "https://openrouter.ai/api/v1"
 */

import { DEFAULT_MODEL, OPENROUTER_BASE_URL, parseCompletionJson } from '../../src/data/studyPrompt.ts'
import { pathCompletionBody, type PathRequest } from '../../src/data/pathPrompt.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'POST a goal to this endpoint.' }, 405)
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

  let body: PathRequest
  try {
    body = (await req.json()) as PathRequest
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const goal = body.goal?.trim()
  if (!goal) {
    return json({ error: 'Missing "goal".' }, 400)
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
        'HTTP-Referer': process.env.URL || 'https://expertise-engine.netlify.app',
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(pathCompletionBody({ goal }, model)),
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
