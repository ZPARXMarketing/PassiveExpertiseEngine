/**
 * Prompt + request shape for learning-path generation.
 *
 * When the user types a goal that no sample curriculum covers, we ask a model to
 * design the whole path: the 80/20 concept graph plus a first practice task,
 * Feynman prompt and drill, so all four stages of the engine work immediately.
 *
 * Shared by the browser (user's own OpenRouter key from Settings) and by the
 * Netlify function (site-wide server-side key), so both ask for the same thing.
 */

export interface PathRequest {
  /** Free-text goal exactly as the user typed it */
  goal: string
}

export const PATH_SYSTEM_PROMPT = `You design skill-acquisition paths for a super-learning app.

The user names a goal. You return the shortest path from zero to competent: the
few concepts that actually carry the result (80/20), ordered by dependency, plus
the first pieces of practice. The reader is a working adult who wants to use this
at work, not pass an exam. Be concrete and specific to the goal — never generic
"learn the fundamentals" filler. Never mention that you are an AI.

Respond with a single JSON object and nothing else, matching exactly:

{
  "title": "short name for the path, under 48 chars",
  "overview": "2-3 sentences: the arc of the path and what it makes possible",
  "goals": ["outcome the learner can do when finished"],
  "concepts": [
    { "id": "kebab-case-slug",
      "label": "2-4 word lowercase concept name",
      "icon": "one emoji",
      "core": true,
      "tier": 0,
      "prereqs": ["ids of concepts that must come first"],
      "summary": "one line, under 70 chars, what this concept is",
      "why": "one sentence on the decision this concept changes at work",
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
  "feynman": [
    { "conceptId": "id",
      "prompt": "explain-it-back question, teaching a smart beginner",
      "rubricKeywords": ["term a real answer must contain"],
      "passFeedback": "one line said when the explanation lands",
      "failFeedback": "one line naming what a good answer must include",
      "cards": [ { "front": "retrieval question", "back": "the answer" } ] }
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
- 5 to 7 concepts. Order them so prerequisites come before dependents.
- "tier" is dependency depth: 0 for concepts with no prereqs, otherwise one more
  than the deepest prereq. At most 2 concepts share tier 0.
- "prereqs" must only reference ids that appear earlier in "concepts".
- Mark exactly 2 or 3 concepts "core": true — the ones that carry most of the result.
- 2 to 4 learnAbout entries per concept.
- "summary" and "why" must say different things: what it is, then what it changes.
- Exactly 2 tasks, 2 feynman entries (2-3 cards each), and 2 drills, each pointing
  at a different concept id from the list, favouring core concepts.
- rubricKeywords: 5 to 7 lowercase words or phrases that must show up in a real
  explanation — they are matched literally against the learner's text.
- Plain text only inside strings: no markdown, no bullet characters, no headings.`

export function pathUserPrompt(body: PathRequest): string {
  return [
    `Goal, as the learner typed it: "${body.goal}"`,
    'Design the path they should actually walk. If the goal is broad, narrow it to',
    'the version a motivated adult could get useful at within a few weeks, and say',
    'so in the overview. If the goal is already narrow, go deep rather than wide.',
    'The first tier must be something they can start on today with no prerequisites.',
  ].join('\n')
}

/** Chat-completions payload sent to OpenRouter from either side. */
export function pathCompletionBody(body: PathRequest, model: string) {
  return {
    model,
    temperature: 0.5,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PATH_SYSTEM_PROMPT },
      { role: 'user', content: pathUserPrompt(body) },
    ],
  }
}
