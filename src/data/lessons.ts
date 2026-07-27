import type { Lesson } from './types'

export const lessons: Lesson[] = [
  {
    id: 'lesson-cash-cycle',
    conceptId: 'cash-cycle',
    tag: 'Cash cycle',
    title: 'The cash cycle: when money actually moves',
    durationSec: 75,
    whyNow: 'builds on "revenue vs receipts" (yesterday)',
    beats: [
      {
        headline: 'A sale is not a deposit.',
        body: 'You can book revenue the day you invoice and still have zero cash. Profit lives on the books. Survival lives in the bank.',
        visual: 'wave',
      },
      {
        headline: 'Three clocks are always running.',
        body: 'How long inventory sits. How long customers take to pay. How long you take to pay suppliers. Those three clocks define your cash cycle.',
        visual: 'rings',
      },
      {
        headline: 'Days to cash = days stuck + days waiting − days you delay.',
        body: 'Inventory days + receivable days − payable days. Stretch payables carefully; compress the other two ruthlessly.',
        visual: 'orbit',
      },
      {
        headline: 'Growth can starve you.',
        body: 'More sales often means more inventory and more unpaid invoices before more cash. That lag is why “profitable” shops go under.',
        visual: 'camera',
      },
      {
        headline: 'Watch the cycle, not just the P&L.',
        body: 'If your cash cycle lengthens while sales rise, you’re financing customers with your own oxygen. Fix terms before you scale ads.',
        visual: 'dice',
      },
    ],
    check: {
      question: 'A longer cash cycle usually means…',
      options: ['cash is tied up longer before it returns', 'your profit margin just went up'],
      correctIndex: 0,
      explanation:
        'Profit is an accounting result. A longer cycle means money stays in inventory or unpaid invoices — so the bank account lags the P&L.',
    },
  },
  {
    id: 'lesson-cash-vs-profit',
    conceptId: 'cash-vs-profit',
    tag: 'Cash ≠ profit',
    title: 'Cash vs profit: the trap that sinks shops',
    durationSec: 80,
    whyNow: 'you just finished "burn rate"',
    beats: [
      {
        headline: 'Profit is a story. Cash is a fact.',
        body: 'Profit says whether the business model worked on paper this period. Cash says whether you can make payroll on Friday.',
        visual: 'dice',
      },
      {
        headline: 'You can be profitable and broke.',
        body: 'Big unpaid invoices, prepaid inventory, loan principal (not interest) leaving the account — profit looks fine while the checking balance dies.',
        visual: 'wave',
      },
      {
        headline: 'You can be unprofitable and flush.',
        body: 'A big loan or a customer prepay can fill the bank while the P&L still shows a loss. That cash is not free — it’s timed.',
        visual: 'orbit',
      },
      {
        headline: 'Owner draws are not an “expense.”',
        body: 'Taking money out of an LLC doesn’t always hit the P&L the way rent does. If you only watch profit, you’ll over-draw and wonder why rent bounced.',
        visual: 'camera',
      },
      {
        headline: 'Run both dashboards weekly.',
        body: 'P&L for “are we a good business?” Cash forecast for “do we survive the next 8 weeks?” Operators who only watch one of those eventually meet the other the hard way.',
        visual: 'rings',
      },
    ],
    check: {
      question: 'Right after a big profitable sale on net-60 terms, your bank balance…',
      options: ['may not move for two months', 'always rises the same day'],
      correctIndex: 0,
      explanation:
        'Accrual profit can recognize the sale now; cash only arrives when the customer pays. Net-60 means the bank waits.',
    },
  },
  {
    id: 'lesson-gross-margin',
    conceptId: 'gross-margin',
    tag: 'Gross margin',
    title: 'Gross margin: what a sale is actually worth',
    durationSec: 75,
    whyNow: 'queued by you from the map',
    beats: [
      {
        headline: 'Revenue is vanity. Margin is sanity.',
        body: 'A $10k month means nothing until you know what those sales cost to deliver — product, materials, shipping, contractor time on that job.',
        visual: 'camera',
      },
      {
        headline: 'Gross profit = sales − cost of goods sold.',
        body: 'COGS is what it took to make or buy the thing you sold. Not rent. Not ads. Not your salary. Just the direct cost of that revenue.',
        visual: 'slit',
      },
      {
        headline: 'Gross margin = gross profit ÷ sales.',
        body: 'A 40% margin means 40¢ of every dollar is left to cover overhead and owners. A 10% margin means overhead has almost no room to breathe.',
        visual: 'rings',
      },
      {
        headline: 'Discounting is a margin attack.',
        body: 'Knock 20% off price on a 40% margin product and you didn’t “lose a little” — you may have wiped most of the contribution from that sale.',
        visual: 'dice',
      },
      {
        headline: 'Price from margin, not from vibes.',
        body: 'Know the floor (COGS + target margin), then charge for value. If the market won’t pay it, fix cost or product — don’t silently subsidize with your runway.',
        visual: 'orbit',
      },
    ],
    check: {
      question: 'Which cost belongs in COGS for a bakery’s loaf sale?',
      options: ['flour and packaging for that loaf', 'the monthly Instagram ads bill'],
      correctIndex: 0,
      explanation:
        'COGS is the direct cost of what you sold. Ads are operating expense — they sit below gross profit on the P&L.',
    },
  },
]

export const lessonById = (id: string): Lesson => {
  const lesson = lessons.find((l) => l.id === id)
  if (!lesson) throw new Error(`Unknown lesson: ${id}`)
  return lesson
}
