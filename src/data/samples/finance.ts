import type { Subject } from '../types'
import { emptyMetrics } from '../types'

const now = () => new Date().toISOString()

/** Worked example: Finance for small businesses */
export function createFinanceSubject(goal = 'Finance for small businesses'): Subject {
  const createdAt = now()
  return {
    id: `sub-finance-${Date.now()}`,
    goal,
    title: 'Finance for small businesses',
    createdAt,
    blueprint: {
      nodes: [
        {
          id: 'revenue',
          label: 'revenue streams',
          x: 70,
          y: 48,
          labelDx: -42,
          labelDy: 28,
          status: 'mastered',
          is8020: true,
          retention: 92,
        },
        {
          id: 'cogs-opex',
          label: 'COGS vs OpEx',
          x: 170,
          y: 70,
          labelDx: -20,
          labelDy: 28,
          status: 'mastered',
          is8020: true,
          retention: 86,
          taskId: 'task-medspa-pnl',
        },
        {
          id: 'cash-vs-profit',
          label: 'cash ≠ profit',
          x: 60,
          y: 150,
          labelDx: -36,
          labelDy: 30,
          status: 'learning',
          is8020: true,
          retention: 54,
          taskId: 'task-cash-forecast',
        },
        {
          id: 'gross-margin',
          label: 'gross margin',
          x: 180,
          y: 160,
          labelDx: -24,
          labelDy: 30,
          status: 'available',
          is8020: true,
          retention: 48,
          taskId: 'task-medspa-pnl',
        },
        {
          id: 'net-margin',
          label: 'net margin',
          x: 120,
          y: 230,
          labelDx: -18,
          labelDy: 30,
          status: 'available',
          retention: 32,
        },
        {
          id: 'runway',
          label: 'runway 🔒',
          x: 200,
          y: 250,
          labelDx: -10,
          labelDy: 28,
          status: 'locked',
          retention: 0,
        },
      ],
      edges: [
        { from: 'revenue', to: 'cogs-opex' },
        { from: 'cogs-opex', to: 'cash-vs-profit' },
        { from: 'cogs-opex', to: 'gross-margin' },
        { from: 'gross-margin', to: 'net-margin' },
        { from: 'cash-vs-profit', to: 'runway', locked: true },
        { from: 'net-margin', to: 'runway', locked: true },
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
          'Revenue = card charges + memberships. COGS = injectables, retail product cost, syringes. OpEx = wages, rent, ads, waste. Owner draws aren’t true OpEx but sit outside gross profit — tagging them OpEx keeps them out of COGS. Gross ≈ (24600−8690)/24600 ≈ 64.7%; net after OpEx ≈ 23.5% (draw excluded from “true” net in evalNote — prototype compares tagged math).',
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
          'Explain to a tired shop owner: why can the P&L show a profit while payroll still bounces? Use accrual vs cash-flow in words a non-accountant will keep.',
        rubricKeywords: [
          'cash',
          'profit',
          'accrual',
          'invoice',
          'receivable',
          'payroll',
          'collect',
          'bank',
        ],
        passFeedback:
          'Solid. You separated the story (profit) from the bank (cash). Cards from this explanation are now in your review queue.',
        failFeedback:
          'Not quite enough signal. Hit both sides: profit can book a sale before cash arrives (invoices/receivables), and cash can leave for inventory, loan principal, or draws without “looking like” an expense on the P&L.',
        cardsOnPass: [
          {
            id: 'card-accrual-1',
            conceptId: 'cash-vs-profit',
            front: 'Why can profit be up while the bank balance falls?',
            back: 'Sales on credit raise accrual profit before cash is collected; cash also leaves for inventory, loan principal, and owner draws that don’t equal “expense” on the P&L.',
          },
          {
            id: 'card-accrual-2',
            conceptId: 'cash-vs-profit',
            front: 'One sentence: accrual vs cash view',
            back: 'Accrual asks “did the model work this period?” Cash asks “can we pay people on Friday?”',
          },
        ],
      },
      {
        id: 'synth-gross-net',
        conceptId: 'gross-margin',
        prompt:
          'Feynman test: teach a new hire the difference between gross margin and net margin using a single product sale example.',
        rubricKeywords: ['gross', 'net', 'cogs', 'opex', 'overhead', 'margin', 'sale'],
        passFeedback: 'Clear split between unit economics (gross) and whole-business leftovers (net). Cards queued.',
        failFeedback:
          'Name both: gross = after direct cost of the sale (COGS); net = after operating overhead too. Give a numeric micro-example.',
        cardsOnPass: [
          {
            id: 'card-margin-1',
            conceptId: 'gross-margin',
            front: 'Gross margin formula',
            back: '(Revenue − COGS) / Revenue. What’s left of each sales dollar after direct product/service cost.',
          },
          {
            id: 'card-margin-2',
            conceptId: 'net-margin',
            front: 'Net vs gross — one line',
            back: 'Gross ignores overhead; net is after OpEx (and interest/tax in full statements). A fat gross with a thin net means overhead is eating the business.',
          },
        ],
      },
    ],
    srs: [
      {
        id: 'card-seed-gross-net',
        conceptId: 'gross-margin',
        front: 'Gross margin vs net margin (quick)',
        back: 'Gross = after COGS only. Net = after COGS + operating expenses. High gross + low net ⇒ overhead problem.',
        ease: 2.5,
        intervalDays: 1,
        dueAt: new Date(Date.now() - 3600_000).toISOString(),
        reps: 0,
      },
    ],
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
          question: 'An LLC owner transfers $5k from business checking to personal. On a clean P&L this is usually…',
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
  }
}
