/**
 * Feynman explanation grader (server-side key path).
 *
 * Browser POSTs concept + explanation; returns axis scores + pass/fail.
 * Used only when the site has OPENROUTER_API_KEY and the user has no key in Settings.
 */

import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  parseCompletionJson,
} from '../../src/data/studyPrompt.ts'

const GRADE_SYSTEM = `You grade a learner's Feynman-style explanation for a skill-acquisition app.

Score three axes from 0 to 5 (integers only):
- mechanism: does the answer explain how the concept actually works (causal structure), not just name it?
- decisionImpact: does it say what real decision or action changes because of this idea?
- concreteExample: is there a specific, concrete example a practitioner could reuse?

Pass only if ALL of:
1. average of the three scores >= 3.5
2. every axis score >= 2
3. the explanation is at least ~80 words of substance (not keyword soup)

Respond with a single JSON object and nothing else:
{
  "mechanism": 0-5,
  "decisionImpact": 0-5,
  "concreteExample": 0-5,
  "pass": true|false,
  "feedback": "one or two sentences of specific coaching — what landed, what was missing",
  "cards": [ { "front": "retrieval prompt", "back": "tight answer" } ]
}

Rules:
- "cards" is optional; 0–3 cards only when pass is true. Prefer the learner's own wording.
- feedback must be useful even on fail: name the weakest axis.
- Never mention that you are an AI. Plain text only inside strings.`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'POST an explanation to this endpoint.' }, 405)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return json(
      {
        error:
          'No server-side key configured. Add your own OpenRouter key in Settings, or set OPENROUTER_API_KEY.',
      },
      501,
    )
  }

  let body: {
    conceptLabel?: string
    prompt?: string
    explanation?: string
    rubricKeywords?: string[]
    goal?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const explanation = body.explanation?.trim()
  const conceptLabel = body.conceptLabel?.trim()
  const prompt = body.prompt?.trim()
  if (!explanation || !conceptLabel || !prompt) {
    return json({ error: 'Missing conceptLabel, prompt, or explanation.' }, 400)
  }

  const userLines = [
    `Concept: ${conceptLabel}`,
    `Explain-back prompt given to the learner: ${prompt}`,
  ]
  if (body.goal) userLines.push(`Learner's project goal: ${body.goal}`)
  if (body.rubricKeywords?.length) {
    userLines.push(
      `Useful terms (soft signal only, not a keyword checklist): ${body.rubricKeywords.join(', ')}`,
    )
  }
  userLines.push('--- Learner explanation ---')
  userLines.push(explanation)
  userLines.push('--- End ---')
  userLines.push('Grade the explanation on mechanism, decision impact, and concrete example.')

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
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GRADE_SYSTEM },
          { role: 'user', content: userLines.join('\n') },
        ],
      }),
    })
  } catch {
    return json({ error: 'Could not reach OpenRouter.' }, 502)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json(
      { error: `OpenRouter returned ${upstream.status}.`, detail: detail.slice(0, 400) || undefined },
      502,
    )
  }

  const completion = (await upstream.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) return json({ error: 'OpenRouter returned an empty completion.' }, 502)

  const parsed = parseCompletionJson(content)
  if (!parsed) return json({ error: 'The model did not return JSON.' }, 502)

  return json(parsed)
}
