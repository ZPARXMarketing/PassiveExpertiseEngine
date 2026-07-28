import type { ConceptStudy } from '../types'

/**
 * Authored study pages for the finance sample.
 * Same shape the generator returns, so a generated page is a drop-in swap.
 */
export const financeStudy: Record<string, ConceptStudy> = {
  revenue: {
    source: 'authored',
    tagline: 'Every dollar of sales, sorted by where it actually came from.',
    whyItMatters:
      'One lump “sales” number hides the whole business. Once revenue is split by stream you can see which service carries the shop, which one is busywork, and which one only looks big because it is priced high and delivered rarely. Every margin calculation downstream inherits the quality of this split — mislabel revenue here and gross margin lies to you for the rest of the year.',
    sections: [
      {
        heading: 'What counts as revenue',
        body: 'Revenue is money earned by delivering your product or service to a customer. Not every deposit in the bank qualifies. A loan lands in checking and is not revenue. A refund leaves the bank and reduces it. An owner putting personal cash into the business is equity, not a sale. The test is simple: did a customer receive something of value in exchange?',
        bullets: [
          'Customer paid for a service delivered → revenue',
          'Bank loan or line-of-credit draw → liability, not revenue',
          'Owner deposits personal money → equity contribution',
          'Refund or chargeback → contra-revenue, subtract it',
          'Gift-card sold but not redeemed → deferred revenue until used',
        ],
      },
      {
        heading: 'Splitting into streams',
        body: 'A stream is a group of sales that behave the same way: similar delivery cost, similar repeat pattern, similar price. For a med-spa that usually means injectables, memberships, facials and retail product. Four to six streams is the sweet spot. Two is too coarse to act on; fifteen is a spreadsheet nobody maintains past March.',
        bullets: [
          'Group by how it is delivered, not by how it is marketed',
          'Split anything you would price or staff differently',
          'Merge anything under ~5% of sales into “other” until it grows',
        ],
      },
      {
        heading: 'Recurring vs one-off',
        body: 'Recurring revenue — memberships, retainers, subscriptions — is worth more per dollar than one-off revenue because it is predictable. Predictable revenue lets you commit to fixed costs like a lease or a full-time injector. One-off revenue is real money but it resets to zero every month, so a business made entirely of one-off sales must re-earn its rent thirty days at a time.',
        bullets: [
          'Recurring: charged on a schedule without a new sale',
          'One-off: requires a fresh decision from the customer',
          'Track them separately even inside the same service line',
        ],
      },
      {
        heading: 'Worked example: one messy month',
        body: 'A med-spa closes the month with $24,600 in deposits. Split out: Botox packages $18,400 (one-off, high ticket), facial memberships $6,200 (recurring), and a $5,000 transfer that turns out to be the owner moving money to personal — not revenue at all, so real revenue is $24,600. Botox is 75% of sales but sits in a single stream with a supplier who raises prices annually. Memberships are only 25% of sales but arrive whether or not the phone rings. That mix is the actual story of the business, and it is invisible in the one-line total.',
        bullets: [
          'Botox packages: $18,400 · 75% of revenue · one-off',
          'Facial memberships: $6,200 · 25% of revenue · recurring',
          'Owner transfer: $5,000 · not revenue, exclude it',
        ],
      },
      {
        heading: 'Why mix changes margin',
        body: 'Two months with identical revenue can produce wildly different profit. Injectables carry real product cost, so every dollar drags a supplier invoice behind it. A membership that entitles someone to a facial costs mostly staff time you were paying for anyway. Shift the mix 10 points toward the higher-cost stream and margin falls even though the top line never moved — which is why “revenue is flat” is never a complete sentence.',
      },
      {
        heading: 'How to keep the split clean',
        body: 'Streams only stay useful if tagging happens at the point of sale, not in a heroic month-end cleanup. Set up categories in your booking or POS system that map one-to-one to your streams, and make the bank feed a check rather than the source of truth. Ten minutes of setup buys you a year of honest numbers.',
        bullets: [
          'Mirror your stream names in the POS categories',
          'Reconcile POS totals to bank deposits weekly, not monthly',
          'Book refunds against the stream that generated the sale',
        ],
      },
    ],
    formulas: [
      {
        name: 'Revenue mix',
        expression: 'stream revenue ÷ total revenue',
        note: 'Run it every month — a drifting mix explains margin moves the top line hides.',
      },
      {
        name: 'Average ticket',
        expression: 'stream revenue ÷ number of transactions',
        note: 'Rising ticket with flat revenue means fewer customers spending more.',
      },
      {
        name: 'Recurring share',
        expression: 'recurring revenue ÷ total revenue',
        note: 'The share of next month you can forecast before the phone rings.',
      },
    ],
    keyTerms: [
      { term: 'Revenue stream', definition: 'A group of sales that share delivery cost and buying pattern.' },
      { term: 'Recurring revenue', definition: 'Revenue that repeats on a schedule without a new purchase decision.' },
      { term: 'Deferred revenue', definition: 'Cash collected for something not yet delivered — a liability until it is.' },
      { term: 'Contra-revenue', definition: 'Refunds, discounts and chargebacks that reduce gross sales.' },
      { term: 'Owner draw', definition: 'Money moved from the business to the owner — never revenue, never an expense.' },
      { term: 'Average ticket', definition: 'Typical revenue per transaction in a stream.' },
      { term: 'Revenue mix', definition: 'The percentage each stream contributes to total revenue.' },
    ],
    mistakes: [
      'Counting bank deposits as revenue — loans, transfers and owner contributions inflate the top line and wreck every ratio built on it.',
      'Booking gift cards as revenue on sale instead of on redemption, which pulls next quarter’s sales into this month.',
      'Leaving refunds in a separate “expense” bucket, making both revenue and costs look bigger than they are.',
      'Creating so many streams that nobody maintains them, so within two months everything lands in “misc”.',
      'Reporting only total revenue to yourself, then being surprised when a flat month has half the profit.',
    ],
    checkYourself: [
      {
        q: 'A $12,000 line of credit hits the business account. How much revenue was earned?',
        a: 'Zero. That is a liability — you owe it back. It raises cash without touching the P&L.',
      },
      {
        q: 'Why is a $6,200 membership month worth more than $6,200 of walk-in facials?',
        a: 'It is recurring and predictable, so it can support fixed commitments like rent or salaried staff. Walk-ins must be re-earned every month.',
      },
      {
        q: 'Revenue is identical to last month but profit dropped $2,000. Name the likely revenue-side cause.',
        a: 'The mix shifted toward a stream with higher delivery cost — more injectables, fewer memberships — so the same top line drags more COGS.',
      },
      {
        q: 'A client buys a $500 package of five treatments and uses one. How much is revenue this month?',
        a: 'Roughly $100 earned; the remaining $400 is deferred revenue — cash in hand, service still owed.',
      },
      {
        q: 'What is the fastest test for whether a deposit is revenue?',
        a: 'Ask whether a customer received something of value in exchange. If not, it is financing, equity or a transfer.',
      },
    ],
  },

  'cogs-opex': {
    source: 'authored',
    tagline: 'Costs that scale with each sale versus costs of keeping the doors open.',
    whyItMatters:
      'This single split decides what gross margin means. Put a cost in the wrong bucket and you will either think your service is unprofitable when it is fine, or think you have room to discount when you do not. It is also the split that tells you what happens if volume doubles: COGS doubles with it, OpEx mostly does not.',
    sections: [
      {
        heading: 'The scaling test',
        body: 'Ask one question of every cost: if I sold one more unit tomorrow, would this line go up? If yes, it is COGS — cost of goods sold, the direct cost of delivering the sale. If it stays flat whether you serve ten clients or a hundred, it is OpEx — the cost of having a business at all. Rent does not care how busy you were. Botox vials care very much.',
        bullets: [
          'Moves with volume → COGS',
          'Flat regardless of volume → OpEx',
          'Moves in steps (hire a second injector) → OpEx that behaves semi-variably',
        ],
      },
      {
        heading: 'What normally lands in COGS',
        body: 'Direct materials and consumables, the product you resell, merchant processing fees on the sale, and directly billable labour where you pay per service delivered. In a med-spa: injectable product, syringes and needles, retail skincare you resell, and a contractor injector paid per appointment.',
        bullets: [
          'Injectable product from the supplier',
          'Syringes, needles, gloves consumed per treatment',
          'Retail product cost for items you resell',
          'Per-service contractor pay',
        ],
      },
      {
        heading: 'What normally lands in OpEx',
        body: 'Rent, utilities, salaried and front-desk wages, marketing, software, insurance, professional fees. These pay for capacity and presence rather than any specific sale. Marketing is the one people argue about: it drives sales, but you spend it before you know whether a sale happens, so it sits in OpEx.',
        bullets: [
          'Rent and utilities',
          'Front-desk and salaried wages',
          'Advertising and software subscriptions',
          'Insurance, licensing and accounting fees',
        ],
      },
      {
        heading: 'The gray lines',
        body: 'Some costs genuinely sit on the border, and the right answer is less important than a consistent one. Medical waste disposal rises with treatment volume but is usually billed as a flat monthly contract, so most operators park it in OpEx. Card processing fees are technically per-sale but small enough that many small businesses leave them in OpEx. Pick a rule, write it down, and never change it mid-year — comparability across months is worth more than theoretical purity.',
        bullets: [
          'Medical waste on a flat contract → OpEx by convention',
          'Card fees → COGS if you want true unit economics, OpEx if you want simplicity',
          'Owner draws → neither; they are equity movements',
        ],
      },
      {
        heading: 'Worked example: tagging one month',
        body: 'From the med-spa month: revenue $24,600. Injectable product $7,100, retail COGS $980, syringes and consumables $610 → COGS totals $8,690. Front-desk wages $4,200, rent and utilities $3,800, ads $1,600, medical waste $240 → OpEx totals $9,840. Gross profit is $24,600 − $8,690 = $15,910, or 64.7% gross margin. After OpEx, operating profit is $6,070. Move that $7,100 of injectable product into OpEx by mistake and gross margin leaps to 93.5% — a number that would have you discounting yourself out of business.',
        bullets: [
          'COGS: $7,100 + $980 + $610 = $8,690',
          'OpEx: $4,200 + $3,800 + $1,600 + $240 = $9,840',
          'Gross profit $15,910 · operating profit $6,070',
        ],
      },
      {
        heading: 'Why the split predicts the future',
        body: 'The COGS/OpEx ratio tells you what growth does to you. A business that is mostly COGS scales linearly — double revenue, roughly double cost, same margin. A business that is mostly OpEx has operating leverage: the next sale carries almost no extra cost, so profit accelerates past a break-even point. Knowing which one you are running is the difference between growth fixing your problem and growth amplifying it.',
      },
    ],
    formulas: [
      { name: 'Gross profit', expression: 'Revenue − COGS', note: 'What is left to pay for everything else.' },
      { name: 'COGS ratio', expression: 'COGS ÷ Revenue', note: 'The share of each sale consumed by delivering it.' },
      {
        name: 'Break-even revenue',
        expression: 'Fixed OpEx ÷ gross margin %',
        note: 'Revenue needed before operating profit turns positive.',
      },
    ],
    keyTerms: [
      { term: 'COGS', definition: 'Direct cost of delivering a specific sale; rises with volume.' },
      { term: 'OpEx', definition: 'Cost of operating the business regardless of volume.' },
      { term: 'Variable cost', definition: 'A cost that moves roughly in proportion to units sold.' },
      { term: 'Fixed cost', definition: 'A cost that stays flat across a normal range of volume.' },
      { term: 'Semi-variable cost', definition: 'A cost that jumps in steps as capacity is added.' },
      { term: 'Operating leverage', definition: 'How much profit accelerates when revenue grows, given a fixed cost base.' },
      { term: 'Gross profit', definition: 'Revenue minus COGS — the pool that funds OpEx and profit.' },
    ],
    mistakes: [
      'Putting all wages in one bucket. Per-service contractor pay is COGS; the salaried front desk is OpEx. Merging them makes gross margin meaningless.',
      'Classifying advertising as COGS because it "generates sales" — it is spent before any sale exists and does not scale per unit.',
      'Treating owner draws as OpEx, which understates profit and hides that cash left for personal reasons.',
      'Changing your gray-line rules mid-year, so month-over-month comparisons measure your bookkeeping instead of your business.',
      'Forgetting merchant fees entirely, quietly overstating gross margin by two to three points.',
    ],
    checkYourself: [
      {
        q: 'You sell one more facial tomorrow. Which costs move?',
        a: 'Consumables and any per-service labour move. Rent, insurance, software and the salaried front desk do not.',
      },
      {
        q: 'Why does misclassifying injectable product as OpEx inflate gross margin?',
        a: 'Gross margin subtracts only COGS. Moving a real delivery cost below the gross-profit line makes each sale look far more profitable than it is.',
      },
      {
        q: 'Fixed OpEx is $9,840 and gross margin is 64.7%. What revenue breaks even?',
        a: 'About $15,200 — $9,840 ÷ 0.647.',
      },
      {
        q: 'Is a $240 flat monthly medical-waste contract COGS or OpEx?',
        a: 'A gray line. Most operators call it OpEx because it is billed flat. Either answer works as long as you keep it consistent.',
      },
      {
        q: 'A business is 80% OpEx by cost. What happens to profit if revenue doubles?',
        a: 'Profit rises much faster than revenue — that is operating leverage, since most of the cost base does not follow the extra sales.',
      },
    ],
  },

  'cash-vs-profit': {
    source: 'authored',
    tagline: 'The P&L tells you if the model works. The bank tells you if you survive Friday.',
    whyItMatters:
      'Profitable businesses fail for cash reasons all the time. Accrual accounting books a sale when it is earned; the bank moves when money actually lands. The gap between those two clocks is where payroll bounces, and it is entirely predictable if you forecast it. This is the concept that turns a bookkeeping report into an operating decision.',
    sections: [
      {
        heading: 'Two different clocks',
        body: 'Accrual accounting records revenue when you deliver and expenses when you incur them, matching effort to result in the right period. Cash accounting records money when it moves. Both are honest; they answer different questions. Accrual asks "did this month work?" Cash asks "can we pay people?" You need both, and a small business that only watches one is flying with half an instrument panel.',
      },
      {
        heading: 'Where the gap comes from',
        body: 'Four things drive nearly all of the divergence: receivables (you delivered, they have not paid), inventory (cash out now, expensed only when sold), loan principal (leaves the bank, never appears on the P&L), and owner draws (same). None of these are exotic — they are just the standard ways money moves without an expense line to explain it.',
        bullets: [
          'Receivables: revenue booked, cash pending',
          'Inventory and prepaid: cash out ahead of the expense',
          'Loan principal: cash out, only the interest hits the P&L',
          'Owner draws and distributions: cash out, equity movement',
          'Timing of tax payments, which arrive in lumps',
        ],
      },
      {
        heading: 'Worked example: the profitable payroll crisis',
        body: 'Start the eight weeks with $28,000 in the bank. Collections run about $5,500 a week and cash costs about $4,200, so the baseline is +$1,300 a week. Add a $9,000 injector restock in week 3 and a $6,000 tax payment in week 6. Cash climbs to about $30,600 by week 2, drops to roughly $22,900 after the restock, recovers to about $25,500 by week 5, then falls to around $20,800 after the tax hit in week 6. Week 6 is the trough. Every one of those weeks is profitable on the P&L — the restock is inventory and the tax payment is not an operating expense — yet the bank balance swings by nearly $10,000.',
        bullets: [
          'Baseline weekly cash change: +$1,300',
          'Week 3 restock: −$9,000 (inventory, not an expense)',
          'Week 6 tax: −$6,000 (not operating profit)',
          'Trough: week 6, roughly $20,800',
        ],
      },
      {
        heading: 'Reading the trough',
        body: 'The trough week is the only number that matters for survival planning. Ask two things: does it stay above the floor you need for payroll and rent, and how much slack sits between the trough and zero? In the example there is comfortable room, so a $3,000 laser-lease deposit in week 4 is affordable — it lowers the week 6 trough to about $17,800, still safe. Change the restock to $20,000 and the same "profitable" business has a problem.',
      },
      {
        heading: 'Building the forecast in ten minutes',
        body: 'You do not need software. List the next eight weeks in a column. Start with today’s bank balance. Add expected collections, subtract expected cash costs, then add a line for every known lump — tax, restock, insurance renewal, deposit. Carry the balance forward. Update it weekly with actuals. That single sheet prevents more small-business failures than any accounting upgrade.',
        bullets: [
          'Start from the real bank balance, not the P&L',
          'Forecast collections, not sales',
          'List lumpy items explicitly — they cause every surprise',
          'Refresh weekly; a stale forecast is worse than none',
        ],
      },
    ],
    formulas: [
      {
        name: 'Weekly net cash',
        expression: 'collections − cash costs − lumpy outflows',
        note: 'Chain these to carry a running balance forward.',
      },
      {
        name: 'Operating cash flow (indirect)',
        expression: 'net profit + non-cash expenses − change in working capital',
        note: 'Why profit and cash diverge, in one line.',
      },
      {
        name: 'Cash conversion gap',
        expression: 'days to collect + days of inventory − days to pay suppliers',
        note: 'Days you fund the business out of your own pocket.',
      },
    ],
    keyTerms: [
      { term: 'Accrual basis', definition: 'Revenue and expenses recorded when earned or incurred, not when paid.' },
      { term: 'Cash basis', definition: 'Revenue and expenses recorded when money actually moves.' },
      { term: 'Accounts receivable', definition: 'Money customers owe you for work already delivered.' },
      { term: 'Working capital', definition: 'Current assets minus current liabilities — cash tied up running day to day.' },
      { term: 'Loan principal', definition: 'The borrowed amount being repaid; a cash outflow with no expense line.' },
      { term: 'Trough week', definition: 'The lowest projected cash point in a forecast — the real risk moment.' },
    ],
    mistakes: [
      'Treating the bank balance as profit, so a big collection week feels like a good month and a restock week feels like a disaster.',
      'Forecasting sales instead of collections, which flatters every week where customers pay late.',
      'Leaving tax and insurance renewals out of the forecast because they are "not operating" — they still empty the account.',
      'Reading only the ending balance instead of the trough, then getting caught in week 6.',
      'Assuming a profitable business cannot run out of money. Fast-growing businesses are the most likely to.',
    ],
    checkYourself: [
      {
        q: 'The P&L shows $6,000 profit but the bank fell $3,000. Name three explanations.',
        a: 'Receivables grew (sales booked, not collected), inventory was purchased, or cash left as loan principal, owner draws or a tax payment.',
      },
      {
        q: 'In the eight-week sketch, which week is the trough and why?',
        a: 'Week 6 — the $6,000 tax payment lands after the week 3 restock has already drawn the balance down and before it has fully rebuilt.',
      },
      {
        q: 'Why does buying inventory hurt cash without hurting profit?',
        a: 'Inventory is an asset when purchased. It only becomes an expense (COGS) when it is sold, so cash leaves in one period and profit falls in a later one.',
      },
      {
        q: 'Can the business afford a $3,000 deposit in week 4?',
        a: 'Yes — the trough drops from about $20,800 to about $17,800, still well clear of the payroll floor.',
      },
      {
        q: 'One sentence: accrual versus cash.',
        a: 'Accrual asks whether the model worked this period; cash asks whether you can pay people on Friday.',
      },
    ],
  },

  'gross-margin': {
    source: 'authored',
    tagline: 'What is left of each sales dollar after the direct cost of delivering it.',
    whyItMatters:
      'Gross margin is the cleanest read on whether your pricing and delivery model work, because it strips out everything that is not about the sale itself. It sets the ceiling on every other number: your gross margin percentage is literally how many cents of each dollar are available to cover rent, payroll and profit. A pricing decision, a supplier negotiation, or a shift in mix shows up here first.',
    sections: [
      {
        heading: 'The formula and what it is asking',
        body: 'Gross margin = (Revenue − COGS) ÷ Revenue, expressed as a percentage. It answers one question: after paying for the thing I just delivered, how much is left? Note that it says nothing about whether the business is profitable. A 70% gross margin with enormous overhead still loses money. Gross margin measures the sale; net margin measures the business.',
      },
      {
        heading: 'Worked example',
        body: 'The med-spa month: revenue $24,600, COGS $8,690. Gross profit is $15,910 and gross margin is 15,910 ÷ 24,600 = 64.7%. So roughly 65 cents of every dollar survives delivery. With $9,840 of OpEx, the business needs about $15,200 of revenue just to break even — and it did $24,600, so it cleared roughly $6,070 of operating profit.',
        bullets: [
          'Revenue $24,600 − COGS $8,690 = gross profit $15,910',
          'Gross margin: 64.7%',
          'Break-even revenue: $9,840 ÷ 0.647 ≈ $15,200',
        ],
      },
      {
        heading: 'What good looks like',
        body: 'Benchmarks are directional, not gospel. Service businesses with light materials often run 60–80%. Businesses that resell physical product run 25–50%. Restaurants land near 60–70% on food cost alone before labour. The useful comparison is not the industry average but your own trend: a margin that fell four points over two quarters is telling you something real, whatever the benchmark says.',
        bullets: [
          'Service-heavy: often 60–80%',
          'Product resale: often 25–50%',
          'Your own trend beats any published benchmark',
        ],
      },
      {
        heading: 'The three levers',
        body: 'Only three things move gross margin: price, direct cost, and mix. Raising price is the fastest and scariest. Reducing direct cost means supplier terms, waste and yield. Shifting mix means selling more of the higher-margin stream — usually the cheapest lever because it needs no negotiation and no price change, just attention on what you promote.',
        bullets: [
          'Price: a 5% increase drops almost entirely to gross profit',
          'Direct cost: supplier terms, batch buying, reducing waste',
          'Mix: promote the stream that already carries margin',
        ],
      },
      {
        heading: 'How mis-tagging destroys the number',
        body: 'Because gross margin depends entirely on where the COGS line is drawn, tagging errors do not just add noise — they invert conclusions. Push a real delivery cost into OpEx and margin looks fantastic, so you discount. Pull an overhead cost into COGS and margin looks broken, so you raise prices into a market that will not bear it. Before trusting any margin trend, confirm the tagging rules did not change.',
      },
      {
        heading: 'Margin percent versus margin dollars',
        body: 'Percentage is for comparing and diagnosing; dollars are for paying bills. A 90% margin on $2,000 of sales is $1,800, which does not cover rent. A 40% margin on $50,000 is $20,000, which does. When someone proposes a change that "improves margin", ask what it does to gross profit dollars — dropping the low-margin stream sometimes drops the rent money with it.',
      },
    ],
    formulas: [
      { name: 'Gross margin %', expression: '(Revenue − COGS) ÷ Revenue × 100' },
      { name: 'Gross profit', expression: 'Revenue − COGS', note: 'The dollars, not the ratio — this is what pays overhead.' },
      {
        name: 'Break-even revenue',
        expression: 'Fixed OpEx ÷ gross margin %',
        note: 'How much you must sell before operating profit exists.',
      },
      {
        name: 'Price for a target margin',
        expression: 'unit cost ÷ (1 − target margin)',
        note: 'Set price from cost and the margin you need, not from a markup habit.',
      },
    ],
    keyTerms: [
      { term: 'Gross margin', definition: 'Gross profit as a percentage of revenue.' },
      { term: 'Gross profit', definition: 'Revenue minus COGS, in dollars.' },
      { term: 'Contribution margin', definition: 'Revenue minus all variable costs for one unit — margin per sale.' },
      { term: 'Markup', definition: 'Price over cost as a percentage of cost — not the same as margin.' },
      { term: 'Mix shift', definition: 'A change in the proportion of revenue coming from each stream.' },
      { term: 'Break-even', definition: 'The revenue level where gross profit exactly covers fixed costs.' },
    ],
    mistakes: [
      'Confusing markup with margin. A 50% markup on a $10 cost gives a $15 price and a 33% margin, not 50%.',
      'Comparing your margin to an industry benchmark computed with a different COGS definition.',
      'Chasing margin percentage while gross profit dollars fall — cutting the biggest stream because it is the least efficient.',
      'Reading a margin trend without checking whether the tagging rules changed mid-year.',
      'Forgetting discounts and refunds, which reduce revenue and quietly cut margin more than expected.',
    ],
    checkYourself: [
      {
        q: 'Sales $40,000, COGS $15,000. Gross margin?',
        a: '62.5% — (40,000 − 15,000) ÷ 40,000.',
      },
      {
        q: 'Unit cost is $30 and you need a 60% margin. What is the price?',
        a: '$75 — 30 ÷ (1 − 0.60).',
      },
      {
        q: 'Gross margin is 65% and fixed OpEx is $13,000. What revenue breaks even?',
        a: '$20,000 — 13,000 ÷ 0.65.',
      },
      {
        q: 'Margin rose from 62% to 68% but profit fell. What likely happened?',
        a: 'Revenue dropped, or a high-volume lower-margin stream was cut. Percentage improved while gross profit dollars shrank.',
      },
      {
        q: 'Name the three levers on gross margin.',
        a: 'Price, direct cost, and revenue mix.',
      },
    ],
  },

  'net-margin': {
    source: 'authored',
    tagline: 'What the business keeps after everything, not just after delivery.',
    whyItMatters:
      'Net margin is the honest scoreboard. It folds overhead back in, which means it is the number that decides whether growth plans are funded by the business or by hope. A healthy gross margin with a thin net margin is a specific, diagnosable condition: the sales work and the overhead does not.',
    sections: [
      {
        heading: 'From gross to net',
        body: 'Start at revenue, subtract COGS to get gross profit, subtract operating expenses to get operating profit, then subtract interest and taxes to get net profit. Net margin is net profit ÷ revenue. Each subtraction answers a different question: COGS asks whether the sale works, OpEx asks whether the operation works, interest and tax ask what the structure costs.',
        bullets: [
          'Revenue − COGS = gross profit',
          'Gross profit − OpEx = operating profit',
          'Operating profit − interest − tax = net profit',
        ],
      },
      {
        heading: 'Worked example',
        body: 'Revenue $24,600, COGS $8,690, OpEx $9,840. Gross profit $15,910 (64.7%), operating profit $6,070, so operating margin is 24.7%. Assume $400 of loan interest and no entity-level tax for a pass-through LLC: net profit is $5,670 and net margin is 23.0%. Note that the $5,000 owner draw appears nowhere — it is an equity movement, not an expense, even though the bank felt it.',
        bullets: [
          'Gross margin 64.7% → operating margin 24.7% → net margin 23.0%',
          'Overhead consumed 40 points of margin',
          'Owner draw: excluded from the P&L entirely',
        ],
      },
      {
        heading: 'Reading the gap',
        body: 'The distance between gross and net margin is the price of your overhead. Forty points, as above, is not automatically bad — it is the cost of a lease, a front desk and marketing that fills the calendar. It becomes a problem when it grows while revenue does not, or when the overhead is not buying capacity you actually use. Track the gap as a number in its own right.',
      },
      {
        heading: 'Which levers move net without killing growth',
        body: 'Overhead cuts are not equal. Software consolidation, renegotiated insurance and unused subscriptions are free money. Cutting marketing raises net margin this month and lowers revenue next quarter. Cutting front-desk hours raises net margin and lowers rebooking rates. The test is whether the cost is buying future revenue: if yes, cutting it is borrowing from tomorrow.',
        bullets: [
          'Safe: unused software, over-specified insurance, waste',
          'Dangerous: marketing that is actually working, capacity you will need',
          'Structural: rent per usable hour, staffing model, financing cost',
        ],
      },
      {
        heading: 'Why growth can lower net margin first',
        body: 'Adding a second location or a new service line loads overhead before the revenue arrives. Net margin dips, and that dip is an investment rather than a failure — provided you know how long it should last and what the recovery looks like. Decide the expected shape before you spend, so the dip is a plan rather than a surprise.',
      },
    ],
    formulas: [
      { name: 'Net margin', expression: 'net profit ÷ revenue × 100' },
      { name: 'Operating margin', expression: 'operating profit ÷ revenue × 100', note: 'Before interest and tax — best for comparing operations.' },
      { name: 'Overhead ratio', expression: 'OpEx ÷ revenue', note: 'The gap between gross and operating margin.' },
      { name: 'Net profit', expression: 'Revenue − COGS − OpEx − interest − tax' },
    ],
    keyTerms: [
      { term: 'Net margin', definition: 'Net profit as a percentage of revenue.' },
      { term: 'Operating margin', definition: 'Profit from operations before interest and tax, over revenue.' },
      { term: 'EBITDA', definition: 'Earnings before interest, tax, depreciation and amortisation — a rough cash-profit proxy.' },
      { term: 'Overhead', definition: 'Operating costs that support the business rather than a specific sale.' },
      { term: 'Pass-through entity', definition: 'A business whose profit is taxed on the owner’s return, so no tax line appears on the P&L.' },
      { term: 'Bottom line', definition: 'Net profit — the last line of the income statement.' },
    ],
    mistakes: [
      'Subtracting owner draws to get net profit. Draws are equity, not expense; including them understates real profitability.',
      'Comparing net margins across businesses with different entity types, since one may carry a tax line and the other does not.',
      'Cutting marketing to hit a net margin target, then wondering why revenue fell two months later.',
      'Ignoring the gross-to-net gap and attacking COGS when the actual problem is overhead.',
      'Treating a growth-driven margin dip as failure without checking whether it is on the planned recovery path.',
    ],
    checkYourself: [
      {
        q: 'Revenue $100k, COGS $35k, OpEx $45k, interest $2k. Net margin?',
        a: '18% — net profit is $18,000 on $100,000 of revenue.',
      },
      {
        q: 'Gross margin 70%, net margin 5%. Where is the problem?',
        a: 'Overhead. The sale works; the operating cost base is consuming 65 points of margin.',
      },
      {
        q: 'Why is operating margin better than net margin for comparing two shops?',
        a: 'It excludes financing and tax structure, so you compare operations rather than how each business is financed.',
      },
      {
        q: 'A $5,000 owner draw happened this month. How does net profit change?',
        a: 'Not at all. It is an equity distribution — cash leaves, but the P&L is untouched.',
      },
      {
        q: 'Name one safe and one dangerous overhead cut.',
        a: 'Safe: unused software subscriptions. Dangerous: marketing that is currently filling the calendar.',
      },
    ],
  },

  runway: {
    source: 'authored',
    tagline: 'How many months of survival the current bank balance buys at current burn.',
    whyItMatters:
      'Runway converts your bank balance into time, and time is the unit decisions are actually made in. Every serious choice — hire, lease, discount, raise — is really a question about how many months you have and what happens to that number. It is deliberately last on this path because it is only trustworthy once cash flow and margins are honest.',
    sections: [
      {
        heading: 'The calculation',
        body: 'Runway = cash on hand ÷ average monthly net burn, where burn is cash out minus cash in. If the business is cash-flow positive there is no runway limit in the usual sense, and the question becomes how long the buffer survives a bad quarter instead. Use cash burn, not accounting loss: the two differ for exactly the reasons covered in cash versus profit.',
      },
      {
        heading: 'Worked example',
        body: 'Cash on hand $28,000. Cash collections average $22,000 a month and cash costs average $25,500, so net burn is $3,500 a month. Runway is 28,000 ÷ 3,500 = 8 months. Now add a $4,000-a-month injector hire: burn rises to $7,500 and runway drops to under 4 months. Same decision, framed two ways — "we are adding a $48k salary" versus "we are trading half our runway for capacity". The second framing is the one that gets decided correctly.',
        bullets: [
          'Cash $28,000 ÷ burn $3,500 = 8 months',
          'After a $4,000/mo hire: 28,000 ÷ 7,500 ≈ 3.7 months',
          'Every fixed-cost decision is a runway decision',
        ],
      },
      {
        heading: 'Fixed versus variable burn',
        body: 'Split burn the same way you split costs. Fixed burn — rent, salaries, insurance — continues whatever happens and is what you are really betting on. Variable burn moves with volume and partly self-corrects in a downturn. A business with mostly fixed burn has a hard floor and a short reaction time; one with mostly variable burn can throttle down. Two businesses with identical eight-month runway can have very different risk.',
        bullets: [
          'Fixed burn: continues at zero revenue',
          'Variable burn: falls when volume falls',
          'Compute worst-case runway using fixed burn only',
        ],
      },
      {
        heading: 'What to do at each threshold',
        body: 'Under three months is an emergency: stop discretionary spending, chase receivables, and talk to your bank before you need to. Three to six months means act now — cut, raise, or change pace while you still have choices. Six to twelve months is the normal operating zone where investments are reasonable. Over twelve months, the risk flips: idle cash that is not buying growth is its own kind of waste.',
        bullets: [
          '< 3 months: emergency measures, collect aggressively',
          '3–6 months: decide and act while options exist',
          '6–12 months: normal zone, invest deliberately',
          '> 12 months: consider whether cash should be working',
        ],
      },
      {
        heading: 'Extending runway honestly',
        body: 'There are only four levers: collect faster, spend slower, sell more, or add outside money. The first is usually the fastest and least painful, and the most neglected — a 45-day collection cycle cut to 20 days is free runway. Cutting costs works but has a floor. Raising or borrowing buys time at a price, and its cost is lowest when you do not yet need it.',
        bullets: [
          'Collect faster: deposits, shorter terms, card on file',
          'Spend slower: defer non-committal costs first',
          'Sell more: only helps if the sale is cash-positive quickly',
          'Outside money: cheapest before you are desperate',
        ],
      },
    ],
    formulas: [
      { name: 'Runway (months)', expression: 'cash on hand ÷ monthly net burn' },
      { name: 'Net burn', expression: 'monthly cash out − monthly cash in' },
      { name: 'Worst-case runway', expression: 'cash on hand ÷ fixed monthly burn', note: 'Assumes revenue goes to zero — the true floor.' },
      { name: 'Runway cost of a hire', expression: 'new runway = cash ÷ (burn + monthly cost)' },
    ],
    keyTerms: [
      { term: 'Runway', definition: 'Months of operation remaining at the current burn rate.' },
      { term: 'Net burn', definition: 'Cash leaving the business per month, net of cash coming in.' },
      { term: 'Gross burn', definition: 'Total cash spent per month, ignoring incoming cash.' },
      { term: 'Default alive', definition: 'On the current trajectory, the business reaches profitability before cash runs out.' },
      { term: 'Cash floor', definition: 'The minimum balance needed to safely cover payroll and fixed obligations.' },
    ],
    mistakes: [
      'Using accounting loss instead of cash burn, which ignores inventory purchases, loan principal and owner draws.',
      'Averaging burn across a quarter that included one unusual month, hiding a worsening trend.',
      'Ignoring lumpy annual costs — insurance, tax, licence renewals — that quietly shorten runway.',
      'Waiting until runway is under three months to seek financing, which is exactly when it costs the most.',
      'Counting a credit line as cash on hand. It is optional cash that can be withdrawn by the lender when conditions turn.',
    ],
    checkYourself: [
      {
        q: 'Cash $60,000, burn $7,500 a month. Runway?',
        a: '8 months.',
      },
      {
        q: 'Why use cash burn rather than net loss?',
        a: 'Net loss omits inventory purchases, loan principal and owner draws, all of which drain cash without appearing as expenses.',
      },
      {
        q: 'Two shops both have 8 months of runway. One is 90% fixed burn, one is 40%. Who is riskier?',
        a: 'The 90% fixed one — its costs continue if revenue falls, so its worst-case runway is close to its stated runway.',
      },
      {
        q: 'Runway is 5 months. What is the first move?',
        a: 'Act now while options remain: collect receivables aggressively, defer non-committal spend, and open financing conversations before the number gets smaller.',
      },
      {
        q: 'You are considering a $4,000-a-month hire with $28,000 in the bank and $3,500 of burn. What is the runway question?',
        a: 'Runway falls from 8 months to under 4. The real question is whether that hire produces cash-positive revenue inside those 4 months.',
      },
    ],
  },
}
