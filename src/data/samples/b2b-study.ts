import type { ConceptStudy } from '../types'

/** Authored study pages for the B2B lead-gen sample. */
export const b2bStudy: Record<string, ConceptStudy> = {
  icp: {
    source: 'authored',
    tagline: 'The buying context worth spending money on — and the one worth ignoring.',
    whyItMatters:
      'Every downstream decision inherits the ICP. Copy, channel choice, pricing and even the demo script are all answers to "who is this for". A vague ICP does not produce vague results; it produces expensive ones, because you pay full price for reach that could never convert.',
    sections: [
      {
        heading: 'What an ICP actually is',
        body: 'An ideal customer profile describes an account, not a person, and it is defined by buying context rather than demographics. Industry, company size, tech stack, geography, and — most importantly — the trigger event that makes the problem urgent this quarter. "Ops directors at 20–200 store US retailers coming off a stockout quarter" is an ICP. "SMB decision makers who care about growth" is a wish.',
        bullets: [
          'Firmographics: industry, size, geography, structure',
          'Pain: the specific operational failure you remove',
          'Trigger: what makes it urgent now rather than someday',
          'Buying role: who feels the pain and who signs',
        ],
      },
      {
        heading: 'Triggers beat attributes',
        body: 'Attributes tell you who could buy; triggers tell you who is buying. A retailer that just lost a quarter to stockouts, a company that just hired its first ops director, a business that just took funding — each event creates a window where budget and attention exist simultaneously. Targeting on triggers routinely outperforms targeting on attributes by several multiples on reply rate, because timing is most of the battle.',
        bullets: [
          'Funding, hiring, leadership change, new location',
          'Public failure: outage, stockout, compliance finding',
          'Contract renewal windows for the incumbent tool',
        ],
      },
      {
        heading: 'Disqualifiers save more than qualifiers',
        body: 'Write the "do not pursue" list first and make it specific: under 20 stores, no dedicated ops function, already on a two-year contract with a competitor. Disqualifiers protect the scarcest resource in lead gen, which is rep attention. A rep who spends Tuesday on accounts that structurally cannot buy has lost a day that no amount of good copy recovers.',
      },
      {
        heading: 'Worked example: sharpening in three passes',
        body: 'Pass one: "retailers who need better inventory management" — untargetable. Pass two: "US retailers, 20–200 stores, with an ops or supply-chain lead" — now you can build a list. Pass three: add the trigger and the disqualifier — "…that posted stockout-driven revenue misses in the last two quarters; exclude anyone who signed a competitor in the last 12 months". Pass three is a list of maybe 400 accounts a rep can work seriously, instead of 40,000 they will spam.',
        bullets: [
          'Pass 1: pain only → untargetable',
          'Pass 2: + firmographics → list buildable',
          'Pass 3: + trigger and disqualifier → workable territory',
        ],
      },
      {
        heading: 'Validating with evidence, not opinion',
        body: 'Derive the ICP from your best existing customers rather than a whiteboard. Take the accounts with the fastest close, highest retention and lowest support load, and find what they share. If you have no customers yet, run the ICP as an explicit hypothesis for one quarter with a defined kill criterion — otherwise it quietly becomes permanent by accident.',
      },
    ],
    keyTerms: [
      { term: 'ICP', definition: 'The account profile most likely to buy, succeed and stay.' },
      { term: 'Buyer persona', definition: 'The individual role inside an ICP account who feels the pain.' },
      { term: 'Trigger event', definition: 'A change that makes the problem urgent and budget available now.' },
      { term: 'Firmographics', definition: 'Company-level attributes: industry, headcount, revenue, geography.' },
      { term: 'Disqualifier', definition: 'An attribute that removes an account from targeting regardless of fit.' },
      { term: 'TAM', definition: 'Total addressable market — every account that could theoretically buy.' },
      { term: 'SAM', definition: 'Serviceable addressable market — the slice you can actually reach and serve.' },
    ],
    mistakes: [
      'Writing an ICP from aspiration rather than from your best current customers.',
      'Describing a persona (job title and hobbies) and calling it an ICP, which gives you nobody to put on a list.',
      'Skipping disqualifiers, so reps burn their week on accounts that structurally cannot buy.',
      'Making the ICP so broad that messaging must stay generic to fit everyone.',
      'Never revisiting it — the ICP that fit at ten customers rarely fits at a hundred.',
    ],
    checkYourself: [
      {
        q: 'Which is sharper: "SMB decision makers who care about growth" or "ops directors at 20–200 store US retailers after a stockout quarter"?',
        a: 'The second. It names role, segment, geography and a trigger, so you can build a list and write specific copy.',
      },
      {
        q: 'Why do trigger events outperform firmographics alone?',
        a: 'Firmographics say who could buy; triggers say who has urgency and budget right now. Timing drives most of the reply-rate difference.',
      },
      {
        q: 'What should you write before the qualifier list?',
        a: 'The disqualifier list — it protects rep attention, which is the scarcest resource in outbound.',
      },
      {
        q: 'Where should ICP evidence come from?',
        a: 'Your fastest-closing, highest-retaining, lowest-support customers — not a whiteboard exercise.',
      },
    ],
  },

  offer: {
    source: 'authored',
    tagline: 'A sharp promise that earns a reply, not a full product pitch.',
    whyItMatters:
      'A stranger gives you about seven seconds. The wedge is what fits in those seconds: one pain they recognise, one outcome they want, one next step small enough to say yes to. Get it right and mediocre targeting still books meetings; get it wrong and perfect targeting produces silence.',
    sections: [
      {
        heading: 'Pain, promise, proof, CTA',
        body: 'The structure is four beats and it fits in about 90 words. Name the pain in the prospect\'s own vocabulary. State the outcome specifically, with a number if you have one. Offer one piece of proof — a comparable customer, a result, a concrete mechanism. Then ask for something small. Four beats, in that order, no preamble.',
        bullets: [
          'Pain: the operational failure they would recognise instantly',
          'Promise: the outcome, quantified where possible',
          'Proof: one comparable customer or mechanism, not a case-study dump',
          'CTA: the smallest next step that still moves things forward',
        ],
      },
      {
        heading: 'Length discipline',
        body: 'Cold outbound is read on a phone between meetings. Under 120 words, no attachments, no images, no calendar link wall. Every sentence you add lowers the probability the whole thing is read. The wedge is not where you explain the product; it is where you earn the conversation in which you explain the product.',
      },
      {
        heading: 'The CTA is a size decision',
        body: '"Book a 30-minute demo" asks for a commitment before trust exists. "Worth a 10-minute look at your stockout numbers?" asks for a decision the prospect can make alone, right now, without checking a calendar. Interest-check CTAs typically outperform meeting-request CTAs on reply rate — you are optimising for the reply, and the meeting follows from it.',
        bullets: [
          'Interest check: "worth a look?" — lowest friction',
          'Specific micro-offer: a benchmark, teardown, or one number',
          'Meeting request: highest friction, save it for warm replies',
        ],
      },
      {
        heading: 'Worked example',
        body: 'For inventory leads at 20–200 store retailers: "Most ops teams your size find out about a stockout when a store manager calls, not when the forecast breaks. We flag drift about nine days earlier — a 60-store grocery chain cut emergency transfers by roughly a third in their first quarter. Worth a ten-minute look at your top 20 SKUs?" That is 55 words: recognisable pain, quantified promise, one comparable proof point, one low-friction ask.',
      },
      {
        heading: 'Testing it honestly',
        body: 'Change one variable at a time and hold sample size high enough to mean anything — a hundred sends tells you almost nothing. Test the pain line first, since it decides whether the rest gets read, then the CTA. Reply rate is the metric that matters; open rate has been unreliable since privacy-protected mail became the default.',
        bullets: [
          'Test pain line first, CTA second, proof last',
          'Judge on reply rate and positive-reply rate, not opens',
          'Give each variant enough volume to be readable',
        ],
      },
    ],
    keyTerms: [
      { term: 'Wedge', definition: 'The narrow, sharp opening claim that earns a first reply.' },
      { term: 'Value proposition', definition: 'The outcome you deliver, stated from the buyer\'s side.' },
      { term: 'CTA', definition: 'The specific next action you ask the reader to take.' },
      { term: 'Positive reply rate', definition: 'Share of sends that produce genuine interest, not just any response.' },
      { term: 'Social proof', definition: 'Evidence a comparable company already got the outcome.' },
      { term: 'Pattern interrupt', definition: 'An opening that breaks the template rhythm the reader is used to skipping.' },
    ],
    mistakes: [
      'Leading with your company and funding history instead of the reader\'s problem.',
      'Asking for 30 minutes in the first touch, which is a commitment before any trust exists.',
      'Stacking three CTAs so the reader must choose, and chooses nothing.',
      'Using internal jargon for the pain — if they do not call it that, they will not recognise themselves.',
      'Testing five variables at once on 200 sends and declaring a winner from noise.',
    ],
    checkYourself: [
      {
        q: 'Name the four beats of a wedge in order.',
        a: 'Pain, promise, proof, CTA.',
      },
      {
        q: 'Why does "worth a ten-minute look?" usually beat "book a 30-minute demo"?',
        a: 'It is a decision the reader can make alone and immediately, with no calendar commitment — so more people reply, and meetings follow from replies.',
      },
      {
        q: 'Why is open rate a poor test metric now?',
        a: 'Privacy-protected mail inflates and distorts opens. Reply rate — specifically positive replies — is the honest signal.',
      },
      {
        q: 'What is the target length for a cold wedge?',
        a: 'Under 120 words, no attachments — it is read on a phone between meetings.',
      },
    ],
  },

  channels: {
    source: 'authored',
    tagline: 'Where meetings come from, with volume math attached.',
    whyItMatters:
      'A channel plan without arithmetic is a wish list. Working backwards from a meetings target to daily activity turns "we need more leads" into a specific number of touches, a specific budget, and a specific person responsible — which is the difference between a plan and an aspiration.',
    sections: [
      {
        heading: 'Backsolve from the goal',
        body: 'Start at the meetings target and divide by conversion rates until you reach an activity you can schedule. Thirty meetings a month at a 3% outbound reply-to-meeting rate needs roughly 1,000 quality touches — about 50 a day across a working month. If that number is impossible with your headcount, the plan is wrong before it starts, and you have learned that in five minutes instead of a quarter.',
        bullets: [
          '30 meetings ÷ 3% → ~1,000 touches/month → ~50/day',
          'If the daily number is impossible, change the plan, not the target',
          'Run the same math per channel before allocating budget',
        ],
      },
      {
        heading: 'What each channel is actually for',
        body: 'Outbound buys precision: you choose exactly who hears from you, and it works from day one, but it does not compound. Paid buys speed and volume against intent, and stops the day you stop paying. Partners and referrals convert best and cost least, but you cannot turn them up on demand. Content compounds and is slow. A mix exists because no single channel is fast, cheap and durable at once.',
        bullets: [
          'Outbound: precise, immediate, does not compound',
          'Paid: fast volume, buys intent, stops when spend stops',
          'Partners: highest conversion, lowest control over timing',
          'Content: compounds, slow to start',
        ],
      },
      {
        heading: 'One refusable metric per channel',
        body: 'Each channel gets exactly one metric you will not rationalise away. Outbound: positive reply rate. Paid: cost per qualified lead, not cost per click. Partners: meetings sourced per active partner. When a channel misses its metric two periods running, it changes or it stops. Without this rule every channel survives forever on anecdote.',
      },
      {
        heading: 'Worked example: 30 meetings a month',
        body: 'Allocate 50% to LinkedIn and email outbound (15 meetings, ~500 touches at 3%), 30% to paid search (9 meetings; at a $120 cost per qualified lead and a 35% lead-to-meeting rate, roughly 26 leads and about $3,100 of spend), and 20% to partners (6 meetings from three active partners at two each). Watch positive reply rate, cost per qualified lead, and meetings per partner respectively. If paid drifts past $180 per qualified lead, the offer is probably the problem, not the bid.',
        bullets: [
          'Outbound 50% → 15 meetings → ~500 touches',
          'Paid 30% → 9 meetings → ~26 leads → ~$3,100',
          'Partners 20% → 6 meetings → 3 active partners',
        ],
      },
      {
        heading: 'Leading versus lagging',
        body: 'Meetings booked is a lagging metric — by the time it moves, the cause is three weeks old. Touches sent, connection acceptance and reply rate are leading, and you can act on them this week. Manage the leading metrics daily and review the lagging ones monthly. Reversing that is how teams discover a broken quarter in week eleven.',
      },
    ],
    formulas: [
      { name: 'Touches needed', expression: 'meetings target ÷ touch-to-meeting rate' },
      { name: 'Daily activity', expression: 'monthly touches ÷ working days' },
      { name: 'Channel budget', expression: 'meetings from channel ÷ lead-to-meeting rate × cost per lead' },
      { name: 'Blended cost per meeting', expression: 'total channel spend ÷ meetings sourced' },
    ],
    keyTerms: [
      { term: 'Channel mix', definition: 'How meeting volume is distributed across acquisition sources.' },
      { term: 'Touch', definition: 'One deliberate contact attempt with a targeted account.' },
      { term: 'Leading indicator', definition: 'A metric that moves before the outcome and can be acted on now.' },
      { term: 'Lagging indicator', definition: 'A metric that confirms an outcome after the fact.' },
      { term: 'Sourced meeting', definition: 'A meeting attributed to the channel that originated it.' },
      { term: 'Channel saturation', definition: 'The point where more effort in a channel stops adding meetings.' },
    ],
    mistakes: [
      'Setting a meetings target without backsolving to daily activity, so nobody knows what today requires.',
      'Running four channels badly instead of two well, then having no signal on any of them.',
      'Measuring paid on cost per click, which optimises for traffic rather than qualified pipeline.',
      'Judging a compounding channel like content on a 30-day window and killing it early.',
      'Managing lagging metrics daily and leading metrics monthly — exactly backwards.',
    ],
    checkYourself: [
      {
        q: 'You need 20 meetings a month and convert 4% of touches. How many touches, and how many per working day?',
        a: '500 touches, about 25 a day across 20 working days.',
      },
      {
        q: 'Which channel converts best but cannot be turned up on demand?',
        a: 'Partners and referrals — highest conversion, lowest control over timing.',
      },
      {
        q: 'Why is cost per click the wrong headline metric for paid?',
        a: 'It optimises for traffic. Cost per qualified lead ties spend to pipeline that can actually close.',
      },
      {
        q: 'Paid cost per qualified lead jumped from $120 to $180 with no bid change. First hypothesis?',
        a: 'The offer or landing page stopped converting — check message-to-market fit before raising or cutting bids.',
      },
    ],
  },

  cpc: {
    source: 'authored',
    tagline: 'What a click, a lead and a customer are allowed to cost.',
    whyItMatters:
      'This is where "we need more leads" gets a budget attached. The chain from click to customer is pure arithmetic, and once you can run it in your head you can tell within a minute whether a channel is viable, whether the offer is broken, or whether the sales team is the constraint.',
    sections: [
      {
        heading: 'The chain',
        body: 'CPC is spend ÷ clicks. CPL is spend ÷ leads, which equals CPC ÷ landing-page conversion rate. CAC is spend ÷ customers, which equals CPL ÷ lead-to-customer conversion rate. Each step multiplies, which is why a small conversion improvement anywhere in the chain beats a large bid reduction almost every time.',
        bullets: [
          'CPC = spend ÷ clicks',
          'CPL = CPC ÷ landing-page conversion rate',
          'CAC = CPL ÷ lead-to-customer conversion rate',
        ],
      },
      {
        heading: 'Worked example',
        body: '$4,000 of spend produces 1,000 clicks, so CPC is $4.00. The landing page converts 8%, giving 80 leads and a CPL of $50. Sales closes 10% of those leads, so 8 customers at a CAC of $500. If contract value is $6,000 with 70% gross margin, lifetime gross profit is $4,200 against $500 of CAC — an 8.4:1 ratio, comfortably healthy. Now hold spend flat and lift landing-page conversion from 8% to 12%: CPL falls to $33 and CAC to $333, with no negotiation and no extra budget.',
        bullets: [
          'CPC $4.00 · CPL $50 · CAC $500',
          'LTV gross profit $4,200 → LTV:CAC ≈ 8.4:1',
          '8% → 12% page conversion cuts CAC by a third',
        ],
      },
      {
        heading: 'When a cheap lead is expensive',
        body: 'A $40 CPL sounds like a win until you look at what it converts to. If those leads close at 1% instead of 10%, CAC is $4,000 rather than $400, and every one of them consumed sales time on the way. Cheap unqualified leads are worse than no leads: they cost money, they cost attention, and they make the pipeline look healthy while it is not.',
      },
      {
        heading: 'Diagnosing which layer is broken',
        body: 'Symptoms map cleanly to layers. High CPC with normal conversion is an auction or targeting problem. Normal CPC with low landing-page conversion is a message-to-market problem. Good CPL with terrible close rate means the offer attracts the wrong people, or sales is not equipped. Read the chain top to bottom and fix the first number that is out of line — fixing a downstream layer while an upstream one is broken wastes the effort.',
        bullets: [
          'CPC high, conversion fine → targeting or auction',
          'CPC fine, page conversion low → message-to-market',
          'CPL fine, close rate low → wrong audience or sales gap',
        ],
      },
      {
        heading: 'Setting a ceiling before you spend',
        body: 'Work backwards from unit economics. If gross profit per customer is $4,200 and you want a 3:1 LTV:CAC ratio, your CAC ceiling is $1,400. At a 10% close rate that permits a $140 CPL; at 8% page conversion that permits an $11 CPC. Now you have a bid ceiling derived from the business rather than from what the platform suggests, and you know exactly when to walk away.',
      },
    ],
    formulas: [
      { name: 'CPC', expression: 'ad spend ÷ clicks' },
      { name: 'CPL', expression: 'ad spend ÷ leads', note: 'Equivalently CPC ÷ landing-page conversion rate.' },
      { name: 'CAC', expression: 'total acquisition spend ÷ new customers' },
      { name: 'LTV:CAC', expression: 'lifetime gross profit ÷ CAC', note: '3:1 is a common floor for healthy paid acquisition.' },
      { name: 'CAC ceiling', expression: 'lifetime gross profit ÷ target LTV:CAC ratio' },
    ],
    keyTerms: [
      { term: 'CPC', definition: 'Cost per click — what one visit costs.' },
      { term: 'CPL', definition: 'Cost per lead — what one captured contact costs.' },
      { term: 'CAC', definition: 'Customer acquisition cost — total spend per new customer.' },
      { term: 'LTV', definition: 'Lifetime value — gross profit expected from a customer over the relationship.' },
      { term: 'MQL', definition: 'Marketing-qualified lead — meets the fit bar, not yet sales-verified.' },
      { term: 'Payback period', definition: 'Months of gross profit needed to recover CAC.' },
      { term: 'Conversion rate', definition: 'Share of one stage that advances to the next.' },
    ],
    mistakes: [
      'Optimising CPC while ignoring conversion, which buys cheaper traffic that converts worse.',
      'Comparing CPL across channels with different lead definitions, so the numbers are not the same unit.',
      'Celebrating a low CPL without checking close rate — cheap junk leads inflate CAC and burn sales time.',
      'Using revenue rather than gross profit in LTV, which overstates how much CAC you can afford.',
      'Ignoring CAC payback period, so a healthy LTV:CAC ratio still starves the business of cash.',
    ],
    checkYourself: [
      {
        q: 'Spend $3,000, 600 clicks. What is CPC?',
        a: '$5.00.',
      },
      {
        q: 'CPC is $5 and the landing page converts 10%. What is CPL?',
        a: '$50 — CPC ÷ conversion rate.',
      },
      {
        q: 'CPL is $50 and sales closes 8%. What is CAC?',
        a: '$625.',
      },
      {
        q: 'When is a $40 CPL a disaster?',
        a: 'When those leads barely close. At a 1% close rate CAC is $4,000, and the cheap leads also consumed sales capacity on the way.',
      },
      {
        q: 'Gross profit per customer is $3,000 and you want 3:1 LTV:CAC. What is the CAC ceiling?',
        a: '$1,000.',
      },
    ],
  },

  pipeline: {
    source: 'authored',
    tagline: 'Named stages and honest conversion rates turn activity into a forecast.',
    whyItMatters:
      'Without defined stages, pipeline is a feeling. With them, it is arithmetic: you can predict next quarter, find where deals actually die, and tell whether a bad month came from too few leads or from a broken middle. This node is locked until the unit economics above are solid, because forecasting from numbers you do not trust is worse than not forecasting.',
    sections: [
      {
        heading: 'Stages are exit criteria, not vibes',
        body: 'Every stage needs an objective, verifiable exit test — something a third party could confirm from the record. "Discovery" is not a stage; "prospect confirmed the pain and named a budget owner" is. Vibes-based stages make forecasts uselessly optimistic, because everything sits in "interested" until it dies.',
        bullets: [
          'Each stage defines what must be true to leave it',
          'The test must be verifiable from the CRM record',
          'Marketing and sales use the same definitions or the funnel breaks',
        ],
      },
      {
        heading: 'A workable default set',
        body: 'Five or six stages is enough for most B2B motions: Lead, Qualified (fit and pain confirmed), Meeting Held, Proposal, Negotiation, Closed. More stages create more places for deals to hide. Fewer make the middle opaque. Whatever you choose, keep the set stable for at least a year — every change resets your historical conversion data.',
      },
      {
        heading: 'Worked example: reading the funnel',
        body: '400 leads → 120 qualified (30%) → 60 meetings held (50%) → 24 proposals (40%) → 8 closed (33%). Overall lead-to-close is 2%. The weakest link is lead-to-qualified: 70% of leads fail the fit bar, which points at targeting or at a lead magnet attracting the wrong audience. Doubling ad spend here buys more of the same waste. Fixing targeting so 45% qualify produces 12 closed deals from the same 400 leads.',
        bullets: [
          '400 → 120 → 60 → 24 → 8; lead-to-close 2%',
          'Weakest link: 30% lead-to-qualified',
          'Fixing targeting beats doubling spend',
        ],
      },
      {
        heading: 'Forecasting without lying to yourself',
        body: 'Weighted pipeline multiplies each open deal by its stage conversion rate — useful in aggregate, misleading on any single deal. Pair it with a commit list: deals the rep will personally stand behind, with a date and a named decision maker. Weighted pipeline tells you the shape of the quarter; the commit list tells you the floor.',
        bullets: [
          'Weighted pipeline: sum of (deal value × stage conversion rate)',
          'Commit list: rep-backed deals with dates and named buyers',
          'Report both — one is a distribution, the other is a floor',
        ],
      },
      {
        heading: 'Where deals actually die',
        body: 'Track stage-to-stage conversion and average time in stage together. A stage with a normal conversion rate but a ballooning duration is where deals go to stall, and stalled deals are usually lost deals that nobody has closed out yet. Aggressive pipeline hygiene — closing dead deals honestly — makes every other number trustworthy.',
      },
    ],
    formulas: [
      { name: 'Stage conversion', expression: 'deals exiting stage ÷ deals entering stage' },
      { name: 'Overall win rate', expression: 'closed-won ÷ total leads entering' },
      { name: 'Weighted pipeline', expression: 'Σ (deal value × stage conversion probability)' },
      { name: 'Pipeline coverage', expression: 'open pipeline value ÷ quota', note: '3–4x is a common working target.' },
      { name: 'Sales cycle length', expression: 'average days from qualified to closed-won' },
    ],
    keyTerms: [
      { term: 'Pipeline stage', definition: 'A step with objective exit criteria a deal must meet to advance.' },
      { term: 'Conversion rate', definition: 'Share of deals advancing from one stage to the next.' },
      { term: 'Weighted pipeline', definition: 'Deal values discounted by stage probability.' },
      { term: 'Pipeline coverage', definition: 'How many times quota the open pipeline represents.' },
      { term: 'Sales cycle', definition: 'Elapsed time from qualification to close.' },
      { term: 'Stalled deal', definition: 'A deal well past normal time-in-stage with no next step booked.' },
    ],
    mistakes: [
      'Defining stages by rep sentiment instead of verifiable exit criteria.',
      'Letting sales and marketing use different definitions of "qualified", which makes the funnel unreadable.',
      'Leaving dead deals open so pipeline coverage looks healthy while the forecast rots.',
      'Changing the stage set every two quarters, destroying the historical rates the forecast depends on.',
      'Adding leads to fix a middle-of-funnel problem — more volume through a broken stage produces more waste.',
    ],
    checkYourself: [
      {
        q: '400 leads, 120 qualified, 60 meetings, 24 proposals, 8 closed. Overall win rate?',
        a: '2% — 8 ÷ 400.',
      },
      {
        q: 'In that funnel, which stage should you fix first?',
        a: 'Lead-to-qualified at 30%. Most loss happens there, so targeting or lead source is the constraint.',
      },
      {
        q: 'What makes a stage definition legitimate?',
        a: 'An objective exit criterion a third party could verify from the record — not the rep\'s confidence.',
      },
      {
        q: 'Why report both weighted pipeline and a commit list?',
        a: 'Weighted pipeline describes the likely shape of the quarter; the commit list gives a rep-backed floor. Neither alone is a forecast.',
      },
      {
        q: 'A stage has normal conversion but rising time-in-stage. What is happening?',
        a: 'Deals are stalling there. Stalled deals are usually losses nobody has closed out, and they inflate coverage.',
      },
    ],
  },
}
