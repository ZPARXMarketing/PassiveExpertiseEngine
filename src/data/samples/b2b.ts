import type { Domain } from '../types'
import { attachStudy, emptyMetrics, emptyProgress } from '../types'
import { hydrateSeeds } from '../retrieval'
import { b2bStudy } from './b2b-study'

const now = () => new Date().toISOString()

const ENGINE = 'pipeline-engine'
const MESSAGE = 'message-market-fit'

/**
 * Second sample domain — proves the domain switcher and independent saves.
 *
 * One route is selected with two layers: the second is generated but collapsed,
 * so the sample demonstrates progressive zoom without any model call.
 */
export function createB2bDomain(topic = 'B2B lead generation'): Domain {
  const domain: Domain = {
    id: `dom-b2b-${Date.now()}`,
    topic,
    title: 'B2B lead generation',
    createdAt: now(),
    source: 'sample',
    pathsChosen: true,
    paths: [
      {
        id: ENGINE,
        title: 'Build the pipeline engine',
        icon: '⚙️',
        pitch: 'Who to talk to, what to say, and where the meetings come from.',
        payoff: 'A repeatable month that produces meetings without heroics.',
        depth: 'moderate',
        weeks: 7,
        selected: true,
        selectedAt: now(),
        layers: [
          {
            id: `${ENGINE}-layer-0`,
            title: 'Target and message',
            conceptIds: ['icp', 'offer', 'channels'],
            unlocked: true,
            unlockedAt: now(),
            generated: true,
          },
          {
            id: `${ENGINE}-layer-1`,
            title: 'Unit economics and forecast',
            conceptIds: ['cpc', 'pipeline'],
            unlocked: false,
            generated: true,
          },
        ],
      },
      {
        id: MESSAGE,
        title: 'Message-market fit',
        icon: '✍️',
        pitch: 'Test what actually makes a stranger reply, one variable at a time.',
        payoff: 'Copy you can defend with reply-rate data instead of taste.',
        depth: 'shallow',
        weeks: 4,
        selected: false,
        layers: [
          {
            id: `${MESSAGE}-layer-0`,
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
        'From who you sell to how you buy meetings: define the ICP, sharpen the offer, pick channels, then prove unit economics before scaling pipeline.',
      goals: [
        'Write an ICP a rep can use tomorrow morning',
        'Ship an offer wedge that names pain, outcome, and CTA',
        'Do the CPC/CPL math that keeps paid spend honest',
      ],
      nodes: [
        {
          id: 'icp',
          icon: '🎯',
          label: 'ICP definition',
          x: 80,
          y: 48,
          pathId: ENGINE,
          layer: 0,
          status: 'mastered',
          is8020: true,
          retention: 90,
          summary: 'Who is worth talking to — and who is not',
          why: 'Decides who you spend outbound hours on, and who you refuse.',
          overview:
            'Ideal customer profile: firmographics, pains, and buying triggers. Everything downstream (offer, channels, copy) inherits this filter.',
          learnAbout: [
            'Firmographic + pain-based ICP',
            'Disqualifiers that save outbound time',
            'Signals that someone is “in market”',
          ],
        },
        {
          id: 'offer',
          icon: '✉️',
          label: 'offer wedge',
          x: 180,
          y: 130,
          pathId: ENGINE,
          layer: 0,
          status: 'learning',
          is8020: true,
          retention: 58,
          taskId: 'task-offer-page',
          summary: 'The sharp promise that opens a conversation',
          why: 'Changes whether a stranger reads past the first line.',
          overview:
            'A wedge is not a full product pitch — it is pain → outcome → low-friction CTA in a tight block a stranger will finish reading.',
          learnAbout: [
            'Pain / promise / proof structure',
            'Cold-outbound length discipline',
            'CTA that asks for a small next step',
          ],
        },
        {
          id: 'channels',
          icon: '📡',
          label: 'channel mix',
          x: 60,
          y: 130,
          pathId: ENGINE,
          layer: 0,
          status: 'available',
          retention: 45,
          taskId: 'task-channel-plan',
          summary: 'Where meetings come from at your volume target',
          why: 'Turns a meetings target into an activity number per channel.',
          overview:
            'Split effort across outbound, paid, and partners against a meetings goal. Each channel needs one metric you refuse to ignore.',
          learnAbout: [
            'Volume math from goal → activity',
            'LinkedIn, paid search, and partner roles',
            'Leading vs lagging channel metrics',
          ],
        },
        {
          id: 'cpc',
          icon: '🧮',
          label: 'CPC / CPL math',
          x: 120,
          y: 212,
          pathId: ENGINE,
          layer: 1,
          status: 'available',
          is8020: true,
          retention: 38,
          summary: 'What a lead is allowed to cost',
          why: 'Sets the budget a meeting is allowed to cost before growth is unprofitable.',
          overview:
            'Connect ad spend to cost-per-click and cost-per-lead so “we need more leads” has a budget attached — not hope.',
          learnAbout: [
            'CPC and CPL definitions',
            'Backsolving budget from target meetings',
            'When paid is broken vs when offer is broken',
          ],
        },
        {
          id: 'pipeline',
          icon: '🪜',
          label: 'pipeline stages',
          x: 120,
          y: 294,
          pathId: ENGINE,
          layer: 1,
          status: 'locked',
          retention: 0,
          summary: 'Stages from first touch to closed-won',
          why: 'Turns activity into a forecast someone else can plan against.',
          overview:
            'Named stages and conversion rates turn activity into a forecast. Locked until unit economics (CPC/CPL) are clear enough to trust volume.',
          learnAbout: [
            'Stage definitions that sales and marketing share',
            'Conversion rate discipline',
            'Where deals die — and what to fix first',
          ],
        },
      ],
      edges: [
        { from: 'icp', to: 'offer' },
        { from: 'icp', to: 'channels' },
        { from: 'offer', to: 'cpc' },
        { from: 'channels', to: 'cpc' },
        { from: 'cpc', to: 'pipeline', locked: true },
      ],
    },
    tasks: [
      {
        id: 'task-offer-page',
        conceptId: 'offer',
        title: 'Write the offer wedge',
        prompt:
          'In ≤150 words, write a cold-outbound offer wedge for a B2B SaaS that sells inventory forecasting to mid-market retailers. Name the ICP pain, the promised outcome, and the low-friction CTA.',
        kind: 'text',
        starterText: 'For inventory leads at 20–200 store retailers…\n',
        evalNote: 'Prototype accepts any serious write-up (≥ 100 chars).',
      },
      {
        id: 'task-channel-plan',
        conceptId: 'channels',
        title: 'Channel mix for 30 leads/mo',
        prompt:
          'Sketch a channel mix to hit ~30 qualified meetings/month: % split across LinkedIn outbound, paid search, and partner referrals. Note one metric you’d watch per channel.',
        kind: 'editor',
        starterText: 'Target: 30 qualified meetings / month\n\n1. LinkedIn outbound —\n2. Paid search —\n3. Partners —\n',
        evalNote: 'Offline acceptance: non-empty plan with all three channels mentioned.',
      },
    ],
    synthPrompts: [
      {
        id: 'synth-cpl',
        conceptId: 'cpc',
        prompt:
          'Explain CPL vs CAC to a founder who confuses “cheap leads” with “cheap customers.” When is a $40 CPL a disaster?',
        scaffold: [
          'What does CPL measure, and what does it ignore?',
          'How does close rate turn CPL into CAC?',
          'Name one case where a cheap lead costs more than an expensive one.',
        ],
        rubricKeywords: ['cpl', 'cac', 'close', 'conversion', 'lead', 'quality', 'pipeline'],
        passFeedback: 'You connected lead cost to close rate and CAC. Review cards are live.',
        failFeedback:
          'Mention both CPL (cost per lead) and how conversion to revenue turns it into CAC. Cheap junk leads can make a “low CPL” expensive.',
        itemsOnPass: [
          {
            id: 'item-cpl-1',
            conceptId: 'cpc',
            kind: 'short-answer',
            prompt: 'When is a low CPL still bad?',
            answer:
              'When lead-to-close conversion is terrible — CAC = CPL / conversion. Cheap unqualified leads inflate pipeline noise and sales cost.',
            keyPoints: ['conversion rate', 'cac is cpl divided by conversion', 'unqualified leads'],
          },
        ],
      },
    ],
    items: hydrateSeeds([
      {
        id: 'item-seed-icp',
        conceptId: 'icp',
        kind: 'discrimination',
        prompt: 'Which of these is an ICP rather than a persona poster?',
        options: [
          'Ops directors at 20–200 store US retailers, in the quarter after a stockout',
          'Growth-minded decision makers who value efficiency',
          'Busy professionals aged 30–50 who dislike spreadsheets',
        ],
        correctIndex: 0,
        explanation:
          'An ICP names a targetable buying context — role, segment, and a trigger you can detect. The others describe a mood, which nobody can build a list from.',
      },
      {
        id: 'item-seed-offer',
        conceptId: 'offer',
        kind: 'application',
        prompt:
          'Your cold email opens with three paragraphs about your company history. Rewrite the approach in two sentences — what goes first, and why?',
        keyPoints: [
          'lead with the pain the reader already has',
          'name the outcome',
          'ask for a small low-friction next step',
        ],
        answer:
          'Lead with the pain the reader already recognises, name the outcome you produce, and close with a next step small enough to say yes to. Your history is only interesting after they care.',
      },
      {
        id: 'item-seed-channels',
        conceptId: 'channels',
        kind: 'mcq',
        prompt: 'You need 30 meetings a month. What do you work out first?',
        options: [
          'The activity volume each channel needs to produce that many meetings',
          'Which channel your competitors post on most',
          'The creative direction for the campaign',
        ],
        correctIndex: 0,
        explanation:
          'Channel choice is downstream of volume math. Without the activity number, a channel plan is a preference, not a plan.',
      },
    ]),
    drills: [
      {
        id: 'drill-cpc',
        conceptId: 'cpc',
        title: 'CPC arithmetic — rapid fire',
        kind: 'rapid-calc',
        spec: { formula: 'cpc', rounds: 5, timeLimitSec: 40 },
      },
      {
        id: 'drill-icp-mcq',
        conceptId: 'icp',
        title: 'ICP sharpness',
        kind: 'mcq',
        spec: {
          question: 'Which ICP is sharp enough to write outbound copy against?',
          options: [
            '“SMB decision makers who care about growth”',
            '“Ops directors at 20–200 store US retailers after a stockout quarter”',
            '“Anyone who might need our software”',
          ],
          correctIndex: 1,
          explanation:
            'Sharp ICPs name role, segment, geography, and a trigger. Vague “SMB growth” ICPs produce mushy messaging.',
        },
      },
    ],
    metrics: emptyMetrics(),
    progress: emptyProgress(),
  }
  return attachStudy(domain, b2bStudy)
}
