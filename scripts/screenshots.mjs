/**
 * Regenerates docs/screenshots/*.png from hand-written demo data (no API key, no network).
 *   npm run dev            # in one terminal
 *   node scripts/screenshots.mjs [http://localhost:5173]
 * Needs `playwright` resolvable (npm i -D playwright, or a global install) and a Chromium.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

let n = 0
const t0 = Date.parse('2026-09-20T10:00:00Z')
const iso = () => new Date(t0 + ++n * 60000).toISOString()
const node = (id, parent_id, level, title, summary, position, meta = {}) => ({ id, parent_id, level, title, summary, meta, position, created_at: iso() })

const nodes = [
  node('s-econ', null, 'subject', 'Economics', 'How people, firms and governments allocate scarce resources.', 0),
  node('s-music', null, 'subject', 'Music Theory', 'The grammar of harmony, rhythm and form.', 0),
  node('b-micro', 's-econ', 'branch', 'Microeconomics', 'Choices of households and firms, and how markets coordinate them.', 0),
  node('b-macro', 's-econ', 'branch', 'Macroeconomics', 'Growth, inflation, unemployment and policy at the scale of a whole economy.', 1),
  node('b-metrics', 's-econ', 'branch', 'Econometrics', 'Statistical tools for testing economic theories against data.', 2),
  node('b-behav', 's-econ', 'branch', 'Behavioral Economics', 'What psychology adds to models of choice.', 3),
  node('b-game', 's-econ', 'branch', 'Game Theory', 'Strategic interaction between rational decision makers.', 4),
  node('c-101', 'b-micro', 'course', 'Principles of Microeconomics', 'Scarcity, opportunity cost, supply and demand, and market efficiency.', 0, { code: 'ECON 101', tier: 'Intro' }),
  node('c-301', 'b-micro', 'course', 'Intermediate Microeconomics', 'Consumer theory, producer theory and competitive equilibrium with calculus.', 1, { code: 'ECON 301', tier: 'Intermediate' }),
  node('c-401', 'b-micro', 'course', 'Industrial Organization', 'Market power, pricing strategy and antitrust.', 2, { code: 'ECON 401', tier: 'Advanced' }),
  node('c-601', 'b-micro', 'course', 'Microeconomic Theory I', 'Rigorous choice theory, general equilibrium and welfare economics.', 3, { code: 'ECON 601', tier: 'Graduate' }),
]
const chapters = [
  ['Preferences and Utility', 'Ranking bundles and representing the ranking with a utility function.'],
  ['The Budget Constraint', 'What a consumer can afford, and how prices and income shift it.'],
  ['Consumer Choice and Demand', 'Maximising utility subject to a budget; deriving demand curves.'],
  ['Income and Substitution Effects', 'Splitting a price change into two forces.'],
  ['Production and Costs', 'From inputs to output to cost curves.'],
  ['Perfect Competition', 'Price takers, zero profit in the long run, and efficiency.'],
]
chapters.forEach(([t, s], i) => nodes.push(node(`ch-${i}`, 'c-301', 'chapter', t, s, i)))

const lesson = {
  intro:
    'Every theory of demand starts from a simple idea: people can rank the options in front of them. This chapter formalises that ranking, shows when it can be summarised by a single number called utility, and explains why only the order of those numbers matters.',
  sections: [
    {
      heading: 'Preference relations',
      body:
        'A consumer compares bundles of goods using a weak preference relation, written ≽. "A ≽ B" means the consumer likes A at least as much as B. Two assumptions do most of the work. Completeness: any two bundles can be compared. Transitivity: if A ≽ B and B ≽ C, then A ≽ C.\n\nTogether they rule out cycles, such as preferring apples to pears, pears to plums, and plums to apples, which would leave no best choice.',
    },
    {
      heading: 'Indifference curves',
      body:
        'An indifference curve joins every bundle the consumer values equally. With more is better (monotonicity), curves slope downward: to keep satisfaction constant, giving up some of one good requires more of the other. Curves further from the origin represent higher satisfaction, and two curves can never cross, because crossing would violate transitivity.',
    },
    {
      heading: 'Utility functions',
      body:
        'A utility function u(x₁, x₂) assigns a number to each bundle so that u(A) ≥ u(B) exactly when A ≽ B. A common example is Cobb-Douglas, u = x₁^a · x₂^(1-a). Because only the ranking carries meaning, any increasing transformation of u describes the same preferences. This is called ordinal utility.',
    },
    {
      heading: 'Marginal rate of substitution',
      body:
        'The marginal rate of substitution (MRS) is the slope of an indifference curve in absolute value: how much of good 2 the consumer will give up for one more unit of good 1 while staying equally well off. For smooth utility, MRS = MU₁ / MU₂. Diminishing MRS gives the familiar bowed-in shape.',
    },
  ],
  example: {
    title: 'Worked example: Cobb-Douglas with a = 1/2',
    body:
      'Let u(x, y) = √x · √y. Then MU_x = ½·√(y/x) and MU_y = ½·√(x/y), so MRS = MU_x / MU_y = y / x.\n\nAt the bundle (4, 9) the MRS is 9/4 = 2.25: the consumer would give up 2.25 units of y to gain one more unit of x. At (9, 4) the MRS falls to 4/9 ≈ 0.44, which is diminishing MRS in action.',
  },
  keyTerms: [
    { term: 'Bundle', definition: 'A specific quantity of each good the consumer might hold.' },
    { term: 'Indifference curve', definition: 'The set of bundles the consumer values equally.' },
    { term: 'Ordinal utility', definition: 'Utility numbers that matter only for their ranking, not their size.' },
    { term: 'MRS', definition: 'The rate at which a consumer trades one good for another at constant satisfaction.' },
  ],
  recap: [
    'Rational preferences are complete and transitive.',
    'Indifference curves slope down, never cross, and rank bundles by distance from the origin.',
    'Utility is an ordinal representation; any increasing transform works.',
    'MRS = MU₁ / MU₂ is the slope of the indifference curve.',
  ],
  quiz: [
    { q: 'Why can two indifference curves never cross?', a: 'A crossing point would put one bundle on two different satisfaction levels, which contradicts transitivity.' },
    { q: 'If u = x·y, is v = (x·y)³ the same preference ordering?', a: 'Yes. Cubing is an increasing transformation, so the ranking of bundles is unchanged.' },
  ],
}
const syllabus = {
  description: 'A calculus-based treatment of how individual consumers and firms choose, and how competitive markets coordinate those choices. Builds on ECON 101.',
  objectives: [
    'Represent preferences with utility functions and indifference curves.',
    'Solve constrained optimisation problems for consumers and firms.',
    'Decompose price changes into income and substitution effects.',
    'Derive cost curves and the competitive supply curve.',
  ],
}
const chart = {
  type: 'line', title: 'Indifference curves for u = √(x·y)', caption: 'Higher curves are better; none of them cross.', illustrative: true, source: '',
  xLabel: 'Good x', yLabel: 'Good y', categories: [], bars: [], slices: [], nodes: [], edges: [],
  series: [2, 3, 4].map((u) => ({ name: `u = ${u}`, points: [0.8, 1, 1.5, 2, 3, 4, 6, 8, 10, 12].map((x) => [x, +((u * u) / x).toFixed(2)]).filter(([, y]) => y <= 12) })),
}
const ex = (id, kind, key, body) => ({ id, node_id: 'ch-0', kind, key, body, created_at: iso() })
const extras = [
  ex('x1', 'visual', 'Indifference curves', chart),
  ex('x2', 'check', '', { verdict: 'ok', issues: [], sources: ['https://www.britannica.com/topic/utility-economics', 'https://www.investopedia.com/terms/i/indifferencecurve.asp'], checkedAt: iso() }),
]
const day = (off) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)
const step = (i, minutes, note) => ({ node_id: `ch-${i}`, note, minutes })
const paths = [
  { id: 'p1', title: 'Pass the ECON 301 midterm', goal: 'Midterm on consumer theory', focus: 'Utility, budget lines and demand derivation carry most of the exam.', due: day(12), color: '#2affa3', archived: false,
    steps: [step(0, 40, 'Know MRS cold'), step(1, 30, 'Draw budget lines fast'), step(2, 50, 'Practise the Lagrangian'), step(3, 45, 'Slutsky decomposition')], created_at: iso(), updated_at: iso() },
  { id: 'p2', title: 'Cost curves refresher', goal: 'Interview prep: production and costs', focus: 'Short-run versus long-run cost curves.', due: null, color: '#4cc9ff', archived: false,
    steps: [step(4, 35, 'Marginal vs average cost'), step(5, 40, 'Zero long-run profit')], created_at: iso(), updated_at: iso() },
]
const weekly = [1, 2, 3, 4, 5].map((d) => ({ day: d, start: '09:00', end: '11:00' })).concat([{ day: 6, start: '09:00', end: '12:00' }])
const visits = { 's-econ': iso(), 'b-micro': iso(), 'c-301': iso(), 'ch-0': iso() }
const lessons = { 'c-301': syllabus, 'ch-0': lesson }
const store = {
  nodes, lessons, done: ['ch-0'], visits, extras,
  saved: [
    { id: 'sv1', node_id: 'c-301', kind: 'node', text: 'Intermediate Microeconomics', created_at: iso() },
    { id: 'sv2', node_id: 'ch-0', kind: 'snippet', text: 'Because only the ranking carries meaning, any increasing transformation of u describes the same preferences.', created_at: iso() },
  ],
  prefs: { studyTools: true, availability: { weekly, overrides: [], text: 'Weekday mornings 9-11am, Saturday mornings' } },
  paths,
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch())
async function page(w, h, init) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.route(/supabase\.co/, (r) => r.abort())
  await p.addInitScript((s) => { if (!localStorage.getItem('xe-store-v1')) localStorage.setItem('xe-store-v1', JSON.stringify(s)) }, init ?? store)
  return p
}
const shot = (p, name) => p.screenshot({ path: `${OUT}${name}.png` })

// 2. Explore: the drill-down with a chapter open (resumes at the last click)
{
  const p = await page(1440, 900)
  await p.goto(BASE); await p.waitForTimeout(2000); await shot(p, '02-explore')
  await p.evaluate(() => document.querySelector('.chart')?.scrollIntoView({ block: 'center' }))
  await p.waitForTimeout(500); await shot(p, '03-chart')
  for (const [mode, name] of [['Library', '04-library'], ['Paths', '05-paths'], ['Cal', '06-cal']]) {
    await p.getByRole('button', { name: new RegExp(`^${mode}`) }).first().click()
    await p.waitForTimeout(1200)
    if (mode === 'Library') await p.getByText('Economics', { exact: true }).first().click()
    if (mode === 'Paths') await p.getByText('Pass the ECON 301 midterm').first().click()
    await p.waitForTimeout(1200); await shot(p, name)
  }
  await p.context().close()
}
// 3. phone
{
  const p = await page(390, 844)
  await p.goto(BASE); await p.waitForTimeout(2000); await shot(p, '07-mobile'); await p.context().close()
}
await browser.close()
console.log('wrote', OUT)
