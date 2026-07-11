// The 80/20 Audit — data behind the "Map a course" onboarding.
// Each blueprint deconstructs a field so the user can run the three moves:
//   1. Map the terrain (Young's 10% rule)
//   2. Select the vital ~20% (Ferriss)
//   3. Compress the picks onto one page (the One-Page Metric)

export type Leverage = 'core' | 'supporting'
export type ResourceKind = 'course' | 'text' | 'video' | 'reference'

export interface Component {
  id: string
  label: string
  leverage: Leverage // 'core' = recommended part of the vital 20%
  why: string // the 80/20 rationale, shown while selecting
  cheat: string // the compressed mechanic that lands on the one-page sheet
}

export interface Benchmark {
  label: string
  detail: string
}

export interface Resource {
  name: string
  kind: ResourceKind
  note: string
}

export interface CourseBlueprint {
  id: string
  subject: string
  aliases: string[]
  field: string
  oneLiner: string
  isTemplate?: boolean // generic scaffold for an unrecognised subject
  benchmarks: Benchmark[]
  resources: Resource[]
  components: Component[]
}

/** Above this many picks, the cheat sheet no longer fits "one glanceable page". */
export const ONE_PAGE_LIMIT = 7

const quantum: CourseBlueprint = {
  id: 'bp-quantum',
  subject: 'Quantum Physics',
  aliases: ['quantum', 'quantum mechanics', 'quantum physics', 'qm'],
  field: 'Physics · quantum mechanics',
  oneLiner:
    "How matter behaves when it's small enough that probability, not certainty, runs the show.",
  benchmarks: [
    { label: 'Fluency test', detail: 'Explain the double-slit result to a smart 12-year-old — no math.' },
    { label: 'Scope of a real course', detail: 'MIT 8.04 + Oxford Prelims ≈ 5 units over ~110 lecture+problem hours.' },
    { label: 'Undergrad mastery', detail: 'Solve particle-in-a-box and the hydrogen atom unaided.' },
  ],
  resources: [
    { name: 'MIT 8.04 (Allan Adams)', kind: 'course', note: 'the canonical lecture spine' },
    { name: 'Griffiths — Intro to QM', kind: 'text', note: 'standard undergrad problem sets' },
    { name: 'Feynman Lectures, Vol. III', kind: 'reference', note: 'conceptual depth' },
    { name: '3Blue1Brown · PBS Space Time', kind: 'video', note: 'intuition primers' },
  ],
  components: [
    { id: 'wave-function', label: 'The wave function ψ', leverage: 'core', why: 'The one object the whole theory tracks — everything else acts on it.', cheat: 'ψ encodes every possible outcome; |ψ|² is the probability of each.' },
    { id: 'superposition', label: 'Superposition', leverage: 'core', why: 'Nearly every "quantum weirdness" is a special case of states adding.', cheat: 'States add as amplitudes; you always observe just one, weighted by |amp|².' },
    { id: 'uncertainty', label: 'Uncertainty principle', leverage: 'core', why: 'The headline law — it sets the hard limit on what is knowable.', cheat: 'Δx·Δp ≥ ħ/2 — a property of waves themselves, not of instruments.' },
    { id: 'measurement', label: 'Measurement & collapse', leverage: 'core', why: 'Where the theory meets reality; the source of every paradox.', cheat: 'Measuring collapses ψ onto one eigenstate; an immediate repeat agrees.' },
    { id: 'entanglement', label: 'Entanglement', leverage: 'core', why: 'The resource behind quantum computing and the "spooky" correlations.', cheat: "Joint states can't be factored; measuring one fixes its partner at once." },
    { id: 'quantization', label: 'Quantization', leverage: 'supporting', why: 'Explains discrete spectra, but follows from the core ideas.', cheat: 'Boundary conditions → only discrete energies are allowed.' },
    { id: 'tunneling', label: 'Tunneling', leverage: 'supporting', why: 'Striking, but a consequence rather than a foundation.', cheat: 'Amplitude leaks through barriers → nonzero chance of passing.' },
    { id: 'interference', label: 'Interference', leverage: 'supporting', why: 'Beautiful, but downstream of superposition.', cheat: 'Path amplitudes add with phase and can cancel — even one particle at a time.' },
    { id: 'spin', label: 'Spin & operators', leverage: 'supporting', why: 'Essential later, overkill for the first pass.', cheat: 'Observables are operators; spin is a two-state intrinsic angular momentum.' },
  ],
}

const ml: CourseBlueprint = {
  id: 'bp-ml',
  subject: 'Machine Learning',
  aliases: ['machine learning', 'ml', 'ai', 'deep learning'],
  field: 'Computer science · statistical learning',
  oneLiner: 'Getting programs to improve at a task from data instead of explicit rules.',
  benchmarks: [
    { label: 'Fluency test', detail: 'Explain overfitting and the train/val/test split without notes.' },
    { label: 'Scope of a real course', detail: "Andrew Ng's ML + a fast.ai run ≈ ~120 hours to working competence." },
    { label: 'Practitioner mastery', detail: 'Take a raw dataset to a validated model and read its errors.' },
  ],
  resources: [
    { name: 'Andrew Ng — Machine Learning', kind: 'course', note: 'the concept spine' },
    { name: 'fast.ai — Practical DL', kind: 'course', note: 'top-down, hands-on' },
    { name: 'ISLR (James et al.)', kind: 'text', note: 'the statistics done right' },
    { name: 'StatQuest', kind: 'video', note: 'one idea at a time' },
  ],
  components: [
    { id: 'ml-bias-var', label: 'Bias / variance & overfitting', leverage: 'core', why: 'The single lens that explains why most models fail.', cheat: 'Too simple → underfits; too flexible → memorises. Validation finds the middle.' },
    { id: 'ml-split', label: 'Train / validation / test', leverage: 'core', why: 'Get this wrong and every number you report is a lie.', cheat: 'Fit on train, tune on val, judge once on test. Never leak.' },
    { id: 'ml-gradient', label: 'Loss & gradient descent', leverage: 'core', why: 'The engine under almost every model.', cheat: 'Define error, step downhill along its gradient, repeat.' },
    { id: 'ml-features', label: 'Features & data quality', leverage: 'core', why: '"Garbage in" beats any algorithm choice.', cheat: 'Better features usually beat fancier models. Clean, scale, encode.' },
    { id: 'ml-eval', label: 'Metrics & evaluation', leverage: 'core', why: 'Accuracy lies; the right metric is the whole game.', cheat: 'Pick the metric that matches the cost of each error (precision/recall/AUC).' },
    { id: 'ml-linear', label: 'Linear & logistic models', leverage: 'supporting', why: 'Great baselines, but a means to the core ideas.', cheat: 'A weighted sum, optionally squashed to a probability.' },
    { id: 'ml-trees', label: 'Trees & ensembles', leverage: 'supporting', why: 'Workhorses, but learn the principles first.', cheat: 'Split to reduce impurity; average many trees to cut variance.' },
    { id: 'ml-nn', label: 'Neural networks', leverage: 'supporting', why: 'Powerful, but overkill before the fundamentals land.', cheat: 'Stacked linear layers + nonlinearities, trained by backprop.' },
  ],
}

const copy: CourseBlueprint = {
  id: 'bp-copy',
  subject: 'Copywriting',
  aliases: ['copywriting', 'copy', 'marketing copy', 'sales writing'],
  field: 'Marketing · persuasive writing',
  oneLiner: 'Writing words that move a specific reader to take one specific action.',
  benchmarks: [
    { label: 'Fluency test', detail: 'Rewrite a weak headline three ways and say why each works.' },
    { label: 'Scope of a real course', detail: 'The classic canon (Ogilvy, Halbert, Sugarman) ≈ ~40 focused hours.' },
    { label: 'Working mastery', detail: 'Draft a full landing page that a stranger reads to the end.' },
  ],
  resources: [
    { name: 'Ogilvy on Advertising', kind: 'text', note: 'the fundamentals, timeless' },
    { name: 'The Gary Halbert Letter', kind: 'reference', note: 'direct-response craft' },
    { name: 'Sugarman — Adweek Copywriting', kind: 'text', note: 'the mechanics of flow' },
    { name: 'Swipe files (real ads)', kind: 'reference', note: 'study what shipped' },
  ],
  components: [
    { id: 'cw-audience', label: 'Audience & desire', leverage: 'core', why: 'You are not writing to "everyone" — the reader is one person.', cheat: 'Name one reader; write to their existing desire, don\'t create it.' },
    { id: 'cw-headline', label: 'The headline', leverage: 'core', why: '80% who bounce, bounce here — it does most of the work.', cheat: 'The headline sells the next line. Promise, curiosity, or specificity.' },
    { id: 'cw-benefits', label: 'Benefits over features', leverage: 'core', why: 'People buy outcomes, not specs.', cheat: 'Translate every feature into "so that you…". Sell the hole, not the drill.' },
    { id: 'cw-cta', label: 'One clear call to action', leverage: 'core', why: 'A page with two asks gets neither.', cheat: 'One action, stated plainly, repeated. Reduce the risk of clicking.' },
    { id: 'cw-proof', label: 'Proof & objections', leverage: 'core', why: 'Belief, not desire, is the usual blocker.', cheat: 'Answer the top 3 objections; back claims with concrete proof.' },
    { id: 'cw-voice', label: 'Voice & rhythm', leverage: 'supporting', why: 'Matters, but after the structure works.', cheat: 'Short sentences. Vary length. Read it aloud.' },
    { id: 'cw-format', label: 'Formatting for skim', leverage: 'supporting', why: 'A multiplier on good copy, not a substitute.', cheat: 'Subheads + bullets carry the skim-reader to the CTA.' },
    { id: 'cw-testing', label: 'Testing & iteration', leverage: 'supporting', why: 'Powerful, but needs volume you won\'t have day one.', cheat: 'Change one thing, measure, keep the winner.' },
  ],
}

const finance: CourseBlueprint = {
  id: 'bp-finance',
  subject: 'Personal Finance',
  aliases: ['personal finance', 'finance', 'money', 'investing', 'budgeting'],
  field: 'Personal finance · money management',
  oneLiner: 'Turning income into long-term security with a few durable habits.',
  benchmarks: [
    { label: 'Fluency test', detail: 'Explain compound interest and why an index fund usually wins.' },
    { label: 'Scope of a real course', detail: 'The core canon (Bogle, Collins, Ramsey) ≈ ~25 hours.' },
    { label: 'Working mastery', detail: 'Write a one-page plan: save rate, funds, and automation.' },
  ],
  resources: [
    { name: 'The Simple Path to Wealth (Collins)', kind: 'text', note: 'the whole game, plainly' },
    { name: 'Bogleheads wiki', kind: 'reference', note: 'evidence-based consensus' },
    { name: 'Ramit Sethi — I Will Teach You…', kind: 'text', note: 'systems & automation' },
    { name: 'r/personalfinance flowchart', kind: 'reference', note: 'order of operations' },
  ],
  components: [
    { id: 'pf-spendless', label: 'Spend less than you earn', leverage: 'core', why: 'Every other tactic is downstream of this one gap.', cheat: 'Your savings rate — not your return — drives the early years.' },
    { id: 'pf-emergency', label: 'Emergency fund', leverage: 'core', why: 'Without a buffer, one shock undoes years of progress.', cheat: '3–6 months of expenses in cash before you invest a dollar.' },
    { id: 'pf-compound', label: 'Compound interest', leverage: 'core', why: 'The reason starting early beats investing more.', cheat: 'Growth compounds on growth; time in the market is the lever.' },
    { id: 'pf-index', label: 'Low-cost index funds', leverage: 'core', why: 'Beats most active picking, for near-zero effort.', cheat: 'Buy the whole market cheaply; fees and churn are the real enemy.' },
    { id: 'pf-automate', label: 'Automate the system', leverage: 'core', why: 'Discipline fails; automation doesn\'t.', cheat: 'Auto-transfer on payday so saving happens before you can spend.' },
    { id: 'pf-debt', label: 'High-interest debt', leverage: 'supporting', why: 'Critical if present, but a special case.', cheat: 'Kill anything above ~7% before investing — it\'s a guaranteed return.' },
    { id: 'pf-tax', label: 'Tax-advantaged accounts', leverage: 'supporting', why: 'Valuable optimisation, not the foundation.', cheat: 'Use 401k/IRA (or local equivalents) before taxable accounts.' },
    { id: 'pf-insurance', label: 'Insurance & risk', leverage: 'supporting', why: 'Protects the plan; rarely the first move.', cheat: 'Insure only what would be catastrophic to pay out of pocket.' },
  ],
}

export const blueprints: CourseBlueprint[] = [quantum, ml, copy, finance]

export const presetSubjects = blueprints.map((b) => b.subject)

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Build a generic scaffold for a subject we don't have a rich blueprint for. */
function templateFor(query: string): CourseBlueprint {
  const subject = query.trim().replace(/\s+/g, ' ')
  const s = subject.toLowerCase()
  return {
    id: `bp-template-${slug(subject) || 'subject'}`,
    subject,
    aliases: [s],
    field: subject,
    isTemplate: true,
    oneLiner: `A starting template — the engine refines this into a real map as it scans syllabi and authoritative sources for ${subject}.`,
    benchmarks: [
      { label: 'Fluency test', detail: `Explain the one core idea of ${subject} to a beginner in plain language.` },
      { label: 'Scope', detail: 'Most fields compress to ~5 core moves that carry the first 80%.' },
      { label: 'Working mastery', detail: `Complete one real end-to-end piece of work in ${subject} unaided.` },
    ],
    resources: [
      { name: 'Top university syllabus', kind: 'course', note: `the canonical spine for ${subject}` },
      { name: 'The standard reference text', kind: 'text', note: 'where practitioners agree' },
      { name: 'A great intro lecture series', kind: 'video', note: 'intuition first' },
      { name: 'A curated example set', kind: 'reference', note: 'study what "good" looks like' },
    ],
    components: [
      { id: 'tpl-vocab', label: 'Core vocabulary', leverage: 'core', why: "You can't think in a field whose words you don't own.", cheat: `The ~20 terms that appear in every ${subject} conversation.` },
      { id: 'tpl-models', label: 'The core mental models', leverage: 'core', why: 'A few frameworks explain most of the cases.', cheat: 'The 3–4 models practitioners actually reason with.' },
      { id: 'tpl-workflow', label: 'The one key workflow', leverage: 'core', why: 'Doing beats knowing; one repeatable loop builds skill.', cheat: 'The single end-to-end process you repeat until it\'s automatic.' },
      { id: 'tpl-benchmarks', label: 'What "good" looks like', leverage: 'core', why: 'You need a yardstick to steer toward.', cheat: 'Expert-level output vs. beginner output, side by side.' },
      { id: 'tpl-failure', label: 'Top failure modes', leverage: 'core', why: 'Avoiding the common mistakes is half of skill.', cheat: 'The 5 ways beginners predictably get it wrong.' },
      { id: 'tpl-tools', label: 'The essential tools', leverage: 'supporting', why: 'Useful, but they serve the workflow.', cheat: 'The 2–3 tools that do the heavy lifting.' },
      { id: 'tpl-history', label: 'History & context', leverage: 'supporting', why: 'Explains the shape of the field; not urgent.', cheat: 'Why the field is built the way it is.' },
      { id: 'tpl-frontier', label: 'The frontier', leverage: 'supporting', why: 'Motivating, but comes after the basics.', cheat: 'Where the field is still moving and arguing.' },
    ],
  }
}

/** Resolve a typed subject to a rich blueprint, or a generic template. */
export function blueprintFor(query: string): CourseBlueprint {
  const q = query.toLowerCase().trim()
  const hit = blueprints.find(
    (b) => b.aliases.some((a) => a === q || q.includes(a) || a.includes(q)),
  )
  return hit ?? templateFor(query)
}
