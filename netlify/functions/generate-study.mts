/**
 * Study-page generator.
 *
 * The browser POSTs a concept from a subject's blueprint; this function asks a
 * cheap chat model (DeepSeek by default) for a structured study page and returns
 * it as JSON. Runs server-side so the API key never reaches the client.
 *
 * Env:
 *   DEEPSEEK_API_KEY   required
 *   DEEPSEEK_MODEL     optional, default "deepseek-chat"
 *   DEEPSEEK_BASE_URL  optional, default "https://api.deepseek.com"
 */

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

interface StudyRequest {
  goal?: string
  subjectTitle?: string
  pathOverview?: string | null
  concept?: string
  summary?: string | null
  overview?: string | null
  learnAbout?: string[]
  siblings?: string[]
}

const SYSTEM_PROMPT = `You write single-concept study pages for a skill-acquisition app.

The reader is a working adult studying one concept in depth. Write like a sharp
practitioner explaining the idea to a smart peer: concrete, specific, numeric
where numbers help. No filler, no motivational padding, no "in today's fast-paced
world". Never mention that you are an AI or describe your own output.

Respond with a single JSON object and nothing else, matching exactly:

{
  "tagline": "one sentence, under 120 chars, what this concept really is",
  "whyItMatters": "2-3 sentences on the decisions this concept changes",
  "sections": [
    { "heading": "short heading",
      "body": "2-5 sentences of substance",
      "bullets": ["optional supporting points"] }
  ],
  "formulas": [ { "name": "...", "expression": "...", "note": "when to use it" } ],
  "keyTerms": [ { "term": "...", "definition": "one tight sentence" } ],
  "mistakes": ["common mistake and what it costs"],
  "checkYourself": [ { "q": "retrieval question", "a": "the answer" } ]
}

Rules:
- 5 to 7 sections. At least one is a concrete worked example with real numbers.
- 4 to 8 keyTerms, 3 to 5 mistakes, 4 to 6 checkYourself pairs.
- "formulas" only when the concept genuinely has them; otherwise use [].
- Plain text only inside strings: no markdown, no headings, no bullet characters.`

function userPrompt(body: StudyRequest): string {
  const lines = [
    `Concept: ${body.concept}`,
    `Part of the skill path: ${body.subjectTitle ?? body.goal ?? 'general skill'}`,
  ]
  if (body.goal) lines.push(`Learner's stated goal: ${body.goal}`)
  if (body.pathOverview) lines.push(`Path overview: ${body.pathOverview}`)
  if (body.summary) lines.push(`One-line summary already shown in the app: ${body.summary}`)
  if (body.overview) lines.push(`Existing short overview: ${body.overview}`)
  if (body.learnAbout?.length) {
    lines.push(`Sub-topics the app promises to cover: ${body.learnAbout.join('; ')}`)
  }
  if (body.siblings?.length) {
    lines.push(
      `Other concepts on the same path (stay in your lane, reference them at most in passing): ${body.siblings.join('; ')}`,
    )
  }
  lines.push(
    `Write the study page for "${body.concept}" so the learner can study it once and use it at work tomorrow.`,
  )
  return lines.join('\n')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'POST a concept to this endpoint.' }, 405)
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return json(
      {
        error:
          'Study generation is not configured. Set DEEPSEEK_API_KEY in the site environment to enable it.',
      },
      501,
    )
  }

  let body: StudyRequest
  try {
    body = (await req.json()) as StudyRequest
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const concept = body.concept?.trim()
  if (!concept) {
    return json({ error: 'Missing "concept".' }, 400)
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 2600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt({ ...body, concept }) },
        ],
      }),
    })
  } catch {
    return json({ error: 'Could not reach the generation API.' }, 502)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json(
      {
        error: `Generation API returned ${upstream.status}.`,
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
    return json({ error: 'Generation API returned an empty completion.' }, 502)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    // Some models wrap JSON in prose or a code fence — salvage the object.
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return json({ error: 'Model did not return JSON.' }, 502)
    }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return json({ error: 'Model returned malformed JSON.' }, 502)
    }
  }

  return json({ ...(parsed as Record<string, unknown>), model })
}
