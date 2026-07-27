import type { FeedItem } from './types'

export const todaysThread: FeedItem[] = [
  { kind: 'lesson', id: 'feed-cash-cycle', lessonId: 'lesson-cash-cycle' },
  {
    kind: 'quickCheck',
    id: 'feed-check-profit',
    tag: 'Cash ≠ profit',
    check: {
      question: 'Your P&L shows a $4k profit this month. Your bank…',
      options: ['could still be down for the month', 'must also be up $4k'],
      correctIndex: 0,
      explanation:
        'Profit is accrual storytelling. Cash moves with collections, inventory buys, loan principal, and owner draws — none of which equal “profit.”',
    },
  },
  {
    kind: 'refresh',
    id: 'feed-refresh-cogs',
    tag: 'refresh · 3d ago',
    daysAgo: 3,
    title: 'COGS — what counts',
    prompt: 'Finish the thought: COGS only includes costs that…',
    reveal:
      'are directly tied to producing or acquiring what you sold — materials, product cost, shipping out, job-specific labor — not rent or brand ads.',
    durationSec: 30,
  },
  { kind: 'lesson', id: 'feed-cash-vs-profit', lessonId: 'lesson-cash-vs-profit' },
  {
    kind: 'quickCheck',
    id: 'feed-check-cycle',
    tag: 'Cash cycle',
    check: {
      question: 'Selling more on net-60 while stocking more inventory typically…',
      options: ['lengthens the cash cycle', 'shortens the cash cycle'],
      correctIndex: 0,
      explanation:
        'More inventory days + longer receivable days = cash stuck longer. Growth without tighter terms can starve a healthy-looking shop.',
    },
  },
  {
    kind: 'refresh',
    id: 'feed-refresh-runway',
    tag: 'refresh · 6d ago',
    daysAgo: 6,
    title: 'Runway — 30s recap',
    prompt: 'Runway in months is roughly cash on hand divided by…',
    reveal:
      'monthly net burn (cash out − cash in). If burn is $8k and cash is $40k, you have about 5 months — unless collections slip.',
    durationSec: 30,
  },
]

export const totalThreadMinutes = 4
