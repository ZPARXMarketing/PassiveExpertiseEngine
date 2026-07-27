import type { TutorScript } from './types'

const scripts: TutorScript[] = [
  {
    conceptId: 'cash-cycle',
    opening: [
      {
        from: 'tutor',
        text: 'Imagine a bakery: flour bought Monday, bread sold Wednesday, customer pays Friday. The business did work for almost a week before cash came home.',
      },
      {
        from: 'tutor',
        text: 'That lag — buy → sell → collect — is the cash cycle. Stretch it and you need more capital just to stand still.',
      },
    ],
    branches: [
      {
        id: 'formula',
        label: 'give me the formula',
        turns: [
          { from: 'you', text: 'give me the formula' },
          {
            from: 'tutor',
            text: 'Cash cycle days ≈ inventory days + receivable days − payable days. Inventory and AR are cash trapped; AP is cash you still hold.',
          },
          {
            from: 'tutor',
            text: 'Shorter cycle = less cash needed to support the same sales. Longer cycle = you’re the bank for your customers and your stockroom.',
          },
        ],
      },
      {
        id: 'growth',
        label: 'why does growth hurt cash?',
        turns: [
          { from: 'you', text: 'why does growth hurt cash?' },
          {
            from: 'tutor',
            text: 'Because every new sale often means more inventory upfront and another invoice waiting. Revenue climbs first; cash climbs later — if terms stay soft.',
          },
        ],
      },
      {
        id: 'example',
        label: 'another example?',
        turns: [
          { from: 'you', text: 'another example?' },
          {
            from: 'tutor',
            text: 'A contractor: materials on a card this week, job finished next week, client pays in 45 days. The P&L may look fine while the card balance and payroll still need real cash now.',
          },
        ],
      },
    ],
  },
  {
    conceptId: 'cash-vs-profit',
    opening: [
      {
        from: 'tutor',
        text: 'Think of profit as a movie review of last month’s model. Cash is whether the car has gas this morning.',
      },
      {
        from: 'tutor',
        text: 'They’re related — but they answer different questions. Confusing them is how “I was profitable” becomes “payroll bounced.”',
      },
    ],
    branches: [
      {
        id: 'broke',
        label: 'how can profit be up and cash be down?',
        turns: [
          { from: 'you', text: 'how can profit be up and cash be down?' },
          {
            from: 'tutor',
            text: 'You sold on credit (AR up), restocked inventory, paid down loan principal, or took an owner draw. Profit can ignore those cash exits; the bank cannot.',
          },
        ],
      },
      {
        id: 'flush',
        label: 'what about a loss with lots of cash?',
        turns: [
          { from: 'you', text: 'what about a loss with lots of cash?' },
          {
            from: 'tutor',
            text: 'A loan, a prepay, or selling off equipment can fill the account while the P&L still shows a loss. That cash often has a job already assigned — repayment or delivery.',
          },
        ],
      },
      {
        id: 'habit',
        label: 'what should I check weekly?',
        turns: [
          { from: 'you', text: 'what should I check weekly?' },
          {
            from: 'tutor',
            text: 'Three numbers: cash on hand, next 4–8 weeks of expected cash in/out, and whether AR is aging. Add gross margin monthly so the model doesn’t silently rot.',
          },
        ],
      },
    ],
  },
  {
    conceptId: 'gross-margin',
    opening: [
      {
        from: 'tutor',
        text: 'Picture every sale as a jar: money in, cost of the thing out. What’s left in the jar is gross profit — the only money that can pay rent, ads, and you.',
      },
      {
        from: 'tutor',
        text: 'Gross margin is that leftover as a percent of the sale. Thin jars mean overhead has nowhere to stand.',
      },
    ],
    branches: [
      {
        id: 'cogs',
        label: 'what counts as COGS?',
        turns: [
          { from: 'you', text: 'what counts as COGS?' },
          {
            from: 'tutor',
            text: 'Direct costs of the unit sold: materials, wholesale product cost, packaging, shipping to the customer, labor that only exists because of that job. Not the office Wi‑Fi.',
          },
        ],
      },
      {
        id: 'discount',
        label: 'why are discounts so dangerous?',
        turns: [
          { from: 'you', text: 'why are discounts so dangerous?' },
          {
            from: 'tutor',
            text: 'Discounts hit revenue first, while COGS often stays put. On a 40% margin, a 20% off coupon can erase half the contribution — you’re working for exposure, not oxygen.',
          },
        ],
      },
      {
        id: 'math',
        label: 'give me the math',
        turns: [
          { from: 'you', text: 'give me the math' },
          {
            from: 'tutor',
            text: 'Gross profit = Sales − COGS. Gross margin = Gross profit ÷ Sales. Contribution after variable costs is what fights fixed overhead; if that’s thin, volume only digs faster.',
          },
        ],
      },
    ],
  },
]

const fallback: TutorScript = {
  conceptId: '*',
  opening: [
    {
      from: 'tutor',
      text: "Let's slow down. Tell me which part felt slippery and we'll rebuild it from a shop-floor example you already know.",
    },
  ],
  branches: [
    {
      id: 'simpler',
      label: 'explain it simpler',
      turns: [
        { from: 'you', text: 'explain it simpler' },
        {
          from: 'tutor',
          text: 'Strip the jargon: profit is “did the model work on paper?” Cash is “can we pay people on Friday?” Margin is “how much of each sale is left after the direct cost of that sale?”',
        },
      ],
    },
  ],
}

export const tutorScriptFor = (conceptId: string): TutorScript =>
  scripts.find((s) => s.conceptId === conceptId) ?? fallback
