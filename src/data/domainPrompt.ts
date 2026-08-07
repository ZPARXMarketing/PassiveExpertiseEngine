/**
 * Prompts for the two-step domain build.
 *
 * The old single call asked for a whole curriculum from one goal, which is what
 * broke on a real topic: "Quantum Mechanics" has no single 6-concept path, and
 * asking for one produced either mush or an unusable wall.
 *
 * So the model is asked twice, for much smaller things:
 *   1. **Paths** — 4 to 6 broad routes through the domain, pitch + payoff only.
 *      No concepts at all. Cheap, fast, and impossible to overwhelm with.
 *   2. **Layer** — the 5 to 8 concepts of one layer of one chosen path, plus the
 *      practice attached to them. Called on select, and again on each unlock.
 *
 * Shared by the browser (user's own OpenRouter key) and the Netlify functions
 * (site-wide server-side key), so both ask for exactly the same thing.
 */

export interface DomainRequest {
  /** Free-text topic exactly as the user typed it */
  topic: string
}

export interface LayerRequest {
  topic: string
  domainTitle: string
  pathTitle: string
  pathPitch: string
  pathPayoff: string
  /** 0-based depth of the layer being built */
  layerIndex: number
  /** Concept labels already covered in shallower layers, so the model does not repeat them */
  covered: string[]
}

export const DOMAIN_SYSTEM_PROMPT = `You map a field of knowledge into a few broad routes through it.

The user names a domain — it may be enormous ("quantum mechanics") or narrow
("negotiating commercial leases"). You do NOT design a curriculum. You return the
handful of genuinely different directions someone could take through this domain,
so they can pick one or two and ignore the rest.

Respond with a single JSON object and nothing else, matching exactly:

{
  "title": "short name for the domain, under 40 chars",
  "overview": "2-3 sentences: what this domain contains and how the routes differ",
  "goals": ["outcome someone working this domain can reach"],
  "paths": [
    { "id": "kebab-case-slug",
      "title": "3-6 word route name",
      "icon": "one emoji",
      "pitch": "one sentence, under 110 chars, on what this route is",
      "payoff": "one sentence on what you can DO after walking it",
      "depth": "shallow" | "moderate" | "deep",
      "weeks": 6 }
  ]
}

Rules:
- Exactly 4 to 6 paths. They must be genuinely different directions, not slices
  of one syllabus and not difficulty tiers of each other.
- Cover the real spread of the domain: at least one applied/practical route and
  at least one conceptual/foundational route where the domain supports both.
- "depth" is honest effort: shallow ≈ 2-4 weeks, moderate ≈ 5-10, deep ≈ 12+.
  "weeks" is a number consistent with that.
- "pitch" says what the route IS. "payoff" says what it makes possible. Never the
  same sentence twice.
- No concepts, no lesson lists, no curriculum. Routes only.
- Plain text only inside strings: no markdown, no bullet characters.
- Never mention that you are an AI.`

export const LAYER_SYSTEM_PROMPT = `You design one layer of one route through a domain, for a skill-acquisition app.

A layer is the only thing the learner can see at a time: 5 to 8 concepts, in
dependency order, at a single level of zoom. Do not go deeper than the layer you
were asked for, and do not summarise the whole route.

Respond with a single JSON object and nothing else, matching exactly:

{
  "layerTitle": "3-5 word name for this layer",
  "concepts": [
    { "id": "kebab-case-slug",
      "label": "2-4 word lowercase concept name",
      "icon": "one emoji",
      "core": true,
      "tier": 0,
      "prereqs": ["ids of concepts in THIS layer that must come first"],
      "summary": "one line, under 70 chars, what this concept is",
      "why": "one sentence on the decision or judgement this concept changes",
      "overview": "2-3 sentences on what the learner does at this stop",
      "learnAbout": ["specific sub-topic covered here"] }
  ],
  "tasks": [
    { "conceptId": "id of the concept this practices",
      "title": "short task name",
      "prompt": "a concrete 30-60 minute deep-work task with a named artifact",
      "starterText": "skeleton the learner types into, with newlines",
      "evalNote": "how the learner knows the artifact is good" }
  ],
  "items": [
    { "conceptId": "id",
      "kind": "mcq" | "discrimination" | "application" | "short-answer",
      "prompt": "the question",
      "options": ["only for mcq and discrimination"],
      "correctIndex": 0,
      "keyPoints": ["only for application and short-answer: phrases a real answer contains"],
      "answer": "model answer, one or two sentences",
      "explanation": "why the right answer is right and the traps are wrong" }
  ],
  "teachBack": [
    { "conceptId": "id",
      "prompt": "explain-it-back question, teaching a smart beginner",
      "scaffold": ["short sub-question the learner answers in one line"],
      "rubricKeywords": ["term a real answer must contain"],
      "passFeedback": "one line said when the explanation lands",
      "failFeedback": "one line naming what a good answer must include" }
  ],
  "drills": [
    { "conceptId": "id",
      "title": "short drill name",
      "question": "one multiple-choice question testing judgement, not trivia",
      "options": ["...", "...", "..."],
      "correctIndex": 0,
      "explanation": "why that option is right and the others are traps" }
  ]
}

Rules:
- 5 to 8 concepts. Order them so prerequisites come before dependents.
- "tier" is dependency depth inside this layer: 0 for concepts with no prereqs.
  At most 2 concepts share tier 0. "prereqs" only reference ids earlier in the list.
- Mark 2 or 3 concepts "core": true — the ones carrying most of the result.
- 2 to 4 learnAbout entries per concept. "summary" and "why" must say different things.
- 6 to 10 "items", spread across at least 3 concepts. Favour "mcq" and
  "discrimination" that force telling near-neighbours apart, and "application"
  scenarios over definition recall. At most 2 "short-answer".
- mcq/discrimination need 3 or 4 options and a valid 0-based correctIndex.
  application/short-answer need 2 to 4 keyPoints and no options.
- Exactly 2 tasks, 2 teachBack entries (2 or 3 scaffold questions each), and 2
  drills, each on a different concept, favouring core concepts.
- rubricKeywords: 5 to 7 lowercase words matched loosely against the answer.
- Plain text only inside strings: no markdown, no bullet characters, no headings.
- Never mention that you are an AI.`

export function domainUserPrompt(body: DomainRequest): string {
  return [
    `Domain, as the learner typed it: "${body.topic}"`,
    'Map the routes someone could actually take through this. If the domain is',
    'enormous, the routes are the ways people specialise inside it. If it is already',
    'narrow, the routes are the different angles of attack on it — do not pad it out',
    'into a syllabus.',
    'Each route must be one a motivated adult could start this week.',
  ].join('\n')
}

export function layerUserPrompt(body: LayerRequest): string {
  const lines = [
    `Domain: ${body.domainTitle} (learner typed: "${body.topic}")`,
    `Route: ${body.pathTitle}`,
    `What this route is: ${body.pathPitch}`,
    `What it makes possible: ${body.pathPayoff}`,
    `Layer to design: ${body.layerIndex} (0 is the first thing the learner sees)`,
  ]
  if (body.covered.length > 0) {
    lines.push(
      `Already covered in shallower layers — do not repeat these, build on them: ${body.covered.join('; ')}`,
    )
  }
  lines.push(
    body.layerIndex === 0
      ? 'This is the entry layer: it must be startable today with no prerequisites outside it.'
      : 'This layer goes one level deeper than what is already covered. Assume the earlier layers are solid.',
  )
  return lines.join('\n')
}

export function domainCompletionBody(body: DomainRequest, model: string) {
  return {
    model,
    temperature: 0.6,
    max_tokens: 1400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DOMAIN_SYSTEM_PROMPT },
      { role: 'user', content: domainUserPrompt(body) },
    ],
  }
}

export function layerCompletionBody(body: LayerRequest, model: string) {
  return {
    model,
    temperature: 0.5,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: LAYER_SYSTEM_PROMPT },
      { role: 'user', content: layerUserPrompt(body) },
    ],
  }
}
