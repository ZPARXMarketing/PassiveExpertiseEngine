import type { Domain } from '../types'
import { attachStudy, emptyMetrics, emptyProgress } from '../types'
import { hydrateSeeds } from '../retrieval'
import { financeStudy } from './finance-study'

const now = () => new Date().toISOString()

const READ = 'read-the-numbers'
const CASH = 'cash-and-runway'

/**
 * Worked example: Finance for small businesses.
 *
 * Authored as a domain with three routes. Two are pre-selected and walkable;
 * the third has no concepts yet and demonstrates a side quest — selecting it
 * generates its first layer like any other path.
 */
export function createFinanceDomain(topic = 'Finance for small businesses'): Domain {
  const domain: Domain = {
    id: `dom-finance-${Date.now()}`,
    topic,
    title: 'Finance for small businesses',
    createdAt: now(),
    source: 'sample',
    pathsChosen: true,
    paths: [
      {
        id: READ,
        title: 'Read the numbers',
        icon: '📊',
        pitch: 'Turn messy books into margins you can act on.',
        payoff: 'You can open any P&L and say what it is telling you in a minute.',
        depth: 'moderate',
        weeks: 6,
        selected: true,
        selectedAt: now(),
        layers: [
          {
            id: `${READ}-layer-0`,
            title: 'From sales to margin',
            conceptIds: ['revenue', 'cogs-opex', 'gross-margin', 'net-margin'],
            unlocked: true,
            unlockedAt: now(),
            generated: true,
          },
          {
            id: `${READ}-layer-1`,
            title: 'Pricing and mix',
            conceptIds: [],
            unlocked: false,
            generated: false,
          },
        ],
      },
      {
        id: CASH,
        title: 'Survive the cash cycle',
        icon: '🏦',
        pitch: 'Why a profitable month can still miss payroll, and what to watch instead.',
        payoff: 'You know your cash trough eight weeks out, before it arrives.',
        depth: 'shallow',
        weeks: 3,
        selected: true,
        selectedAt: now(),
        layers: [
          {
            id: `${CASH}-layer-0`,
            title: 'Cash vs profit',
            conceptIds: ['cash-vs-profit'],
            unlocked: true,
            unlockedAt: now(),
            generated: true,
          },
          {
            id: `${CASH}-layer-1`,
            title: 'Burn and runway',
            conceptIds: ['runway'],
            unlocked: false,
            generated: true,
          },
        ],
      },
      {
        id: 'raising-and-lending',
        title: 'Money from outside',
        icon: '🤝',
        pitch: 'Debt, lines of credit and investors — what each one actually costs you.',
        payoff: 'You can tell which kind of money fits the hole you are filling.',
        depth: 'moderate',
        weeks: 5,
        selected: false,
        layers: [
          {
            id: 'raising-and-lending-layer-0',
            title: 'Foundations',
            conceptIds: [],
            unlocked: false,
            generated: false,
          },
        ],
      },
    ],
    blueprint: {
      overview:
        'The operator path from money in the door to “can we survive next quarter?” — unit economics first, then cash discipline, then runway.',
      goals: [
        'Separate revenue, COGS, and OpEx without a bookkeeper at your elbow',
        'Read gross and net margin as operating truth, not vanity',
        'Explain why a profitable month can still kill cash',
      ],
      nodes: [
        {
          id: 'revenue',
          icon: '💵',
          label: 'revenue streams',
          x: 70,
          y: 48,
          pathId: READ,
          layer: 0,
          status: 'mastered',
          is8020: true,
          retention: 92,
          summary: 'Where the money actually comes from',
          why: 'Decides which product mix you push before you touch pricing.',
          overview:
            'You will map every dollar of sales to a stream (packages, memberships, retail) so later margin math has clean inputs — not one noisy bank total.',
          learnAbout: [
            'Recurring vs one-off revenue',
            'Why product mix changes margin',
            'What counts as sales vs owner transfers',
          ],
        },
        {
          id: 'cogs-opex',
          icon: '⚖️',
          label: 'COGS vs OpEx',
          x: 170,
          y: 130,
          pathId: READ,
          layer: 0,
          status: 'mastered',
          is8020: true,
          retention: 86,
          taskId: 'task-medspa-pnl',
          summary: 'Cost of delivery vs cost of running the shop',
          why: 'Mis-tag one line and every margin below it is wrong.',
          overview:
            'Tag costs that scale with each sale (COGS) vs costs of keeping the doors open (OpEx). This split is the hinge for gross margin.',
          learnAbout: [
            'COGS: materials, consumables, direct product cost',
            'OpEx: rent, wages, ads, utilities',
            'Gray lines (e.g. medical waste) and how operators classify them',
          ],
        },
        {
          id: 'gross-margin',
          icon: '📈',
          label: 'gross margin',
          x: 70,
          y: 212,
          pathId: READ,
          layer: 0,
          status: 'available',
          is8020: true,
          retention: 48,
          taskId: 'task-medspa-pnl',
          summary: 'Profit after the cost of delivering the sale',
          why: 'Tells you whether the product itself works, before overhead muddies it.',
          overview:
            'Gross margin = (Revenue − COGS) / Revenue. You will compute it from messy books and use it to judge product mix and pricing power.',
          learnAbout: [
            'The gross margin formula',
            'What a “good” margin signals for a service business',
            'How COGS mis-tags destroy the ratio',
          ],
        },
        {
          id: 'net-margin',
          icon: '🎯',
          label: 'net margin',
          x: 170,
          y: 212,
          pathId: READ,
          layer: 0,
          status: 'available',
          retention: 32,
          summary: 'What is left after everything',
          why: 'Decides whether growth plans are affordable or wishful.',
          overview:
            'Net margin folds OpEx into the story. You will connect gross → operating costs → bottom line so growth plans stay honest.',
          learnAbout: [
            'Net margin vs gross margin',
            'Which levers move net without killing growth',
            'Reading a simple P&L top to bottom',
          ],
        },
        {
          id: 'cash-vs-profit',
          icon: '🏦',
          label: 'cash ≠ profit',
          x: 340,
          y: 48,
          pathId: CASH,
          layer: 0,
          status: 'learning',
          is8020: true,
          retention: 54,
          taskId: 'task-cash-forecast',
          summary: 'Why P&L love can still mean a cash crunch',
          why: 'Stops you spending against profit that has not landed in the bank.',
          overview:
            'Accrual profit and bank balance diverge. You will forecast near-term cash so “we made money” never blinds you to payroll risk.',
          learnAbout: [
            'Timing: when you bill vs when cash lands',
            'Owner draws, inventory buys, and other non-P&L drains',
            'A simple weekly cash forecast shape',
          ],
        },
        {
          id: 'runway',
          icon: '⏳',
          label: 'runway',
          x: 340,
          y: 130,
          pathId: CASH,
          layer: 1,
          status: 'locked',
          retention: 0,
          summary: 'Months until cash hits zero at current burn',
          why: 'Turns “are we fine?” into a date you can plan against.',
          overview:
            'Runway turns burn rate into a survival clock. It stays collapsed until cash vs profit is solid — you need that first to trust the number.',
          learnAbout: ['Cash runway formula', 'Fixed vs variable burn', 'When to cut, raise, or change pace'],
        },
      ],
      edges: [
        { from: 'revenue', to: 'cogs-opex' },
        { from: 'cogs-opex', to: 'gross-margin' },
        { from: 'cogs-opex', to: 'net-margin' },
        { from: 'gross-margin', to: 'net-margin' },
        { from: 'cash-vs-profit', to: 'runway', locked: true },
      ],
    },
    tasks: [
      {
        id: 'task-medspa-pnl',
        conceptId: 'gross-margin',
        title: 'Med-spa P&L from messy books',
        prompt:
          'A neighborhood med-spa dumped last month’s transactions into one sheet. Tag each line as Revenue, COGS, or OpEx. Then read the gross and net margins the terminal computes — match the operator’s truth, not the bank export’s chaos.',
        kind: 'csv-pnl',
        dataset: [
          { id: 'r1', description: 'Botox packages — client card charges', amount: 18400 },
          { id: 'r2', description: 'Facial memberships (monthly)', amount: 6200 },
          { id: 'r3', description: 'Allergan product cost (injectables used)', amount: 7100 },
          { id: 'r4', description: 'Skincare retail COGS (products sold)', amount: 980 },
          { id: 'r5', description: 'Front-desk wages', amount: 4200 },
          { id: 'r6', description: 'Rent + utilities', amount: 3800 },
          { id: 'r7', description: 'Instagram + Google ads', amount: 1600 },
          { id: 'r8', description: 'Medical waste disposal (clinic)', amount: 240 },
          { id: 'r9', description: 'Injectable syringes & consumables', amount: 610 },
          { id: 'r10', description: 'Owner draw (transfer to personal)', amount: 5000 },
        ],
        correct: {
          tags: {
            r1: 'revenue',
            r2: 'revenue',
            r3: 'cogs',
            r4: 'cogs',
            r5: 'opex',
            r6: 'opex',
            r7: 'opex',
            r8: 'opex',
            r9: 'cogs',
            // Owner draw is not P&L — treat as ignored opex-adjacent; we accept opex as "not COGS/revenue"
            r10: 'opex',
          },
          grossMarginPct: 64.7,
          // Includes owner draw tagged as OpEx (cash out, not true operating cost)
          netMarginPct: 4.3,
        },
        evalNote:
          'Revenue = card charges + memberships. COGS = injectables, retail product cost, syringes. OpEx = wages, rent, ads, waste. Owner draws aren’t true OpEx but sit outside gross profit — tagging them OpEx keeps them out of COGS. Gross ≈ (24600−8690)/24600 ≈ 64.7%.',
      },
      {
        id: 'task-cash-forecast',
        conceptId: 'cash-vs-profit',
        title: '8-week cash sketch',
        prompt:
          'In plain language, write an 8-week cash forecast for the med-spa: starting cash $28k, weekly collections ~$5.5k, weekly cash costs ~$4.2k, plus a $9k injector restock in week 3 and a $6k tax payment in week 6. Call out the lowest cash week and whether they can afford a $3k laser lease deposit in week 4.',
        kind: 'text',
        starterText: 'Starting cash: $28,000\n\nWeek 1:\n',
        evalNote:
          'Prototype accepts any serious write-up (≥ 120 chars). Live grading would check arithmetic on the trough week.',
      },
    ],
    synthPrompts: [
      {
        id: 'synth-accrual-cash',
        conceptId: 'cash-vs-profit',
        prompt:
          'Explain to a tired shop owner: why can the P&L show a profit while payroll still bounces?',
        scaffold: [
          'What does profit count that cash does not?',
          'Name one way cash leaves without being an expense.',
          'What would you tell the owner to watch weekly?',
        ],
        rubricKeywords: ['cash', 'profit', 'accrual', 'invoice', 'receivable', 'payroll', 'collect'],
        passFeedback:
          'Solid. You separated the story (profit) from the bank (cash). New retrieval items are queued.',
        failFeedback:
          'Hit both sides: profit can book a sale before cash arrives (invoices/receivables), and cash can leave for inventory, loan principal, or draws without “looking like” an expense on the P&L.',
        itemsOnPass: [
          {
            id: 'item-accrual-1',
            conceptId: 'cash-vs-profit',
            kind: 'short-answer',
            prompt: 'Why can profit be up while the bank balance falls?',
            answer:
              'Sales on credit raise accrual profit before cash is collected; cash also leaves for inventory, loan principal, and owner draws that don’t equal “expense” on the P&L.',
            keyPoints: ['sales on credit before cash', 'inventory or loan principal', 'owner draws'],
          },
          {
            id: 'item-accrual-2',
            conceptId: 'cash-vs-profit',
            kind: 'recall',
            prompt: 'One sentence: accrual vs cash view',
            answer:
              'Accrual asks “did the model work this period?” Cash asks “can we pay people on Friday?”',
            keyPoints: ['did the model work', 'can we pay'],
          },
        ],
      },
      {
        id: 'synth-gross-net',
        conceptId: 'gross-margin',
        prompt: 'Teach a new hire the difference between gross margin and net margin.',
        scaffold: [
          'What does gross margin subtract?',
          'What does net margin add on top of that?',
          'Give one number example where they disagree.',
        ],
        rubricKeywords: ['gross', 'net', 'cogs', 'opex', 'overhead', 'margin', 'sale'],
        passFeedback: 'Clear split between unit economics and whole-business leftovers. Items queued.',
        failFeedback:
          'Name both: gross = after direct cost of the sale (COGS); net = after operating overhead too. Give a numeric micro-example.',
        itemsOnPass: [
          {
            id: 'item-margin-1',
            conceptId: 'gross-margin',
            kind: 'recall',
            prompt: 'Gross margin formula',
            answer: '(Revenue − COGS) / Revenue',
            keyPoints: ['revenue', 'cogs', 'revenue'],
          },
        ],
      },
    ],
    items: hydrateSeeds([
      {
        id: 'item-seed-gross-net',
        conceptId: 'gross-margin',
        kind: 'discrimination',
        prompt: 'A shop has 70% gross margin and 3% net margin. What does that combination tell you?',
        options: [
          'Overhead is eating the business',
          'The product is priced too low',
          'Cost of goods is out of control',
        ],
        correctIndex: 0,
        explanation:
          'A fat gross means each sale works. A thin net after that means the fixed cost of running the shop — rent, wages, ads — is where the money goes.',
      },
      {
        id: 'item-seed-cogs',
        conceptId: 'cogs-opex',
        kind: 'application',
        prompt:
          'The med-spa buys $600 of syringes used during treatments and pays $1,600 for Instagram ads. Which is COGS, which is OpEx, and why does the split matter?',
        keyPoints: [
          'syringes are cogs because they scale with each treatment',
          'ads are opex because they run regardless of volume',
          'the split sets gross margin',
        ],
        answer:
          'Syringes scale with each treatment delivered, so they are COGS. Ads run whether or not anyone books, so they are OpEx. The split is what makes gross margin mean anything.',
      },
      {
        id: 'item-seed-revenue',
        conceptId: 'revenue',
        kind: 'mcq',
        prompt: 'Which of these belongs in revenue on a clean P&L?',
        options: [
          'Monthly facial membership charges',
          'A transfer from the owner’s personal account',
          'A refunded deposit returned to a client',
        ],
        correctIndex: 0,
        explanation:
          'Memberships are sales. Owner transfers are equity, and refunds reverse a sale rather than creating one.',
      },
    ]),
    drills: [
      {
        id: 'drill-npm',
        conceptId: 'net-margin',
        title: 'Net profit margin — rapid fire',
        kind: 'rapid-calc',
        spec: { formula: 'net-profit-margin', rounds: 5, timeLimitSec: 45 },
      },
      {
        id: 'drill-gm',
        conceptId: 'gross-margin',
        title: 'Gross margin — rapid fire',
        kind: 'rapid-calc',
        spec: { formula: 'gross-margin', rounds: 5, timeLimitSec: 45 },
      },
      {
        id: 'drill-draw-mcq',
        conceptId: 'cash-vs-profit',
        title: 'Owner draw on the P&L?',
        kind: 'mcq',
        spec: {
          question:
            'An LLC owner transfers $5k from business checking to personal. On a clean P&L this is usually…',
          options: [
            'an operating expense that lowers net margin',
            'an equity/draw — cash out without being “OpEx”',
            'cost of goods sold',
          ],
          correctIndex: 1,
          explanation:
            'Owner draws reduce cash and equity; they are not the same as rent or wages on the P&L. That’s why cash can fall while “expenses” look controlled.',
        },
      },
    ],
    metrics: emptyMetrics(),
    progress: emptyProgress(),
  }
  return attachStudy(domain, financeStudy)
}
