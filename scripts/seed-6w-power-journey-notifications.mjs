// Seeds the programme_notification_templates Firestore collection with the
// 6-Week Transforming Business Power Journey notification copy.
// Source of truth for the copy is src/config/transformingBusiness6wNotifications.ts.
// Keep both files in sync if copy changes.

import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!admin.apps.length) {
  let credential
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  } else {
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
    try {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
      credential = admin.credential.cert(serviceAccount)
    } catch {
      credential = admin.credential.applicationDefault()
    }
  }
  admin.initializeApp({ credential })
}

const db = admin.firestore()
const { serverTimestamp } = admin.firestore.FieldValue

const PROGRAMME = 'transforming-business-6w'
const TARGET_AUDIENCE = 'Transforming Business 6-Week Power Journey learners'
const SENDER = 'Tier 4 Leaders Team'

const POLLS = {
  1: {
    question:
      "When you're trying to influence a senior stakeholder, where does your communication break down first?",
    options: [
      'I over-explain -- too much context, too fast',
      'I under-explain -- I assume they already know the why',
      'My tone shifts -- I go formal and lose my voice',
      "I push for a decision before I've earned the buy-in",
    ],
  },
  2: {
    question:
      'What is the single biggest thing that stops you pitching an idea you believe in at work?',
    options: [
      "I don't think the senior people will take me seriously",
      "I don't know how to structure a pitch without it sounding rehearsed",
      "I've been shot down before, and I haven't wanted to go there again",
      'I pitch -- but I soften it to the point where it loses the edge',
    ],
  },
  3: {
    question: 'What is the real block on the change initiative closest to you right now?',
    options: [
      "The vision is not landing -- people don't see why it matters",
      "The roadmap is vague -- people don't know what to do Monday",
      'Senior sponsorship is flaky -- the message keeps shifting',
      'The team is tired -- this is change number four this year',
    ],
  },
  4: {
    question: 'Under change pressure, where does your EQ give out first?',
    options: [
      'Self-regulation -- I get reactive when the plan slips',
      'Empathy -- I under-read how people are feeling about the change',
      'Social skill -- I know what to do but the delivery lands wrong',
      'All of them -- just at different times, depending on who is in the room',
    ],
  },
  5: {
    question:
      "Of the signals below, which is the primary way you're tracking whether your change is working?",
    options: [
      'Milestones delivered -- output metrics',
      'Adoption rates -- usage metrics',
      'Behaviour change -- qualitative, observational',
      "Honestly, I'm not systematically tracking anything yet",
    ],
  },
  6: {
    question:
      'Compared to the leader who started this journey six weeks ago, what has actually shifted?',
    options: [
      'How I communicate -- clearer, more tailored, less corporate',
      'How I run change -- more structured, more empathetic, more measured',
      'Both of the above',
      'The frameworks are clear -- the behaviours are still catching up',
    ],
  },
}

const POLL_URLS = {
  1: 'https://canva.link/vnqmudmrbclm335',
  2: 'https://canva.link/1ng1y0ctt3soqei',
  3: 'https://canva.link/qqcottywko3twg8',
  4: 'https://canva.link/p0my4cvznikxhye',
  5: 'https://canva.link/sxs4kmj15rmr79b',
  6: 'https://canva.link/xusmsurgfc9dqsr',
}

const GAMMA_URLS = {
  1: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-v7h1eh456y902sz',
  2: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-kzhuk5im4z5q7he',
  3: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-2hv40i25frolwlg',
  4: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-zck9wuofalsypjs',
  5: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-2lfpq0zahfucfum',
  6: 'https://gamma.app/docs/Digital-Edge-AI-Prompts-qxj6whxvqk4reih',
}

const PODCAST_URLS = {
  1: { podcast: 'https://youtu.be/zDtg3_l4SL8?si=RpiZZOKj29JtM3LD', workbook: 'https://canva.link/5lawehkji6pr7v8' },
  2: { podcast: 'https://youtu.be/1ICq3TkSbps?si=LxIcqgjxSkL7JTLd', workbook: 'https://canva.link/prhgdj6v1k9bqgd' },
  3: { podcast: 'https://youtu.be/Px_Ix4BO90k?si=rt4Z1FUsq5q2Iz5i', workbook: 'https://canva.link/hxuahu4qj9j52u6' },
  4: { podcast: 'https://youtu.be/qlBo-jmw-Wk?si=fkEJFGa3qyZxR1dv', workbook: 'https://canva.link/0tnaf277xtxztbm' },
  5: { podcast: 'https://youtu.be/wpyPoctC0vk?si=APtucPfAVVEFyb3V', workbook: 'https://canva.link/axd181pdemt18ze' },
  6: { podcast: 'https://youtu.be/Zg2LRLCHwtA?si=jFO5osbY3f-T36aY', workbook: 'https://canva.link/pvquc25ynqs9ubd' },
}

const AFFIRMATIONS = {
  1: { title: 'Welcome to the Power Journey', body: `Welcome, {{firstName}}. This week is about how you actually come across when it matters -- in a pitch, in a pushback, in a room where influence is earned and not given. Most leaders think they communicate clearly. Their teams know otherwise. This week we get honest about the gap.` },
  2: { title: 'Influence is a practice', body: `Week 2, {{firstName}}. Last week you worked on fundamentals -- how people process information, tone, feedback. This week you put it under pressure: presenting, active listening, conflict communication, and the comms of sales. The Connection Blueprint Capstone closes the loop. Influence is not a talent. It's a practice.` },
  3: { title: 'New course. New rhythm.', body: `Week 3, {{firstName}}. New course. New rhythm. Last course was about how you speak. This course is about what you're leading people through -- transformation that rewires how the business works. This week you learn to communicate the vision so people actually move, not just nod.` },
  4: { title: 'The heaviest week', body: `Week 4, {{firstName}}. This is the heaviest week in the journey -- Change Strategies, Leading a Team Through Change, and Leveraging EQ, back-to-back. Change programmes fail on exactly these three: no roadmap, no team care, no emotional intelligence. This week you build all three.` },
  5: { title: 'Behavioural KPIs, not feelings', body: `Week 5, {{firstName}}. Stakeholder management, conflict, problem solving, and measuring change impact. This is the unglamorous middle of transformation leadership -- the part where you learn to track what actually shifted versus what everyone claims shifted. Behavioural KPIs, not feelings.` },
  6: { title: 'Final week', body: `Final week, {{firstName}}. Six weeks ago you showed up to work on how you influence and lead change. This week you synthesise it. The Change Leader Playbook pulls together vision, strategy, stakeholder work, continuous improvement, and storytelling into one operating system. Most practitioners finish a journey with frameworks. You finish with a playbook.` },
}

const POLL_INBOX_BODIES = {
  1: `Before the Art of Connection Baseline Assessment, tell us: when you're trying to influence a senior stakeholder, where does your communication actually break down? We revisit this at end of Week 2.`,
  2: `Two weeks in. Before the Connection Blueprint Capstone: what is the single biggest thing that stops you pitching an idea you actually believe in at work?`,
  3: `Starting Leading Through Change. Before you dig in: what is actually blocking the change initiative closest to you right now?`,
  4: `This week is Change Strategies plus Leveraging EQ. Before the content: where does your emotional intelligence actually give out under change pressure?`,
  5: `Measuring Change Impact week. Gut answer: what are you actually tracking right now on your change initiative?`,
  6: `Final poll. Six weeks ago you answered the first one. What has actually shifted in how you lead transformation?`,
}

const PEER_NUDGES = {
  1: { title: 'Peer session: Creative Problem Solving', body: `Your first peer session is waiting, {{firstName}}. Creative Problem Solving Session -- 30 minutes with a partner. Bring one communication breakdown from your last month at work. Not the easy one. The one where you walked away thinking "that didn't go how I wanted." Your partner helps you rewind and redesign it.` },
  2: { title: 'Peer session: Stakeholder Mapping', body: `Stakeholder Mapping peer session is open, {{firstName}}. 30 minutes. Bring a list of the 5-7 stakeholders on your current initiative. Your partner walks you through who actually decides, who influences, who resists, and who you are overestimating your relationship with. Bring honesty. Nothing else is useful here.` },
  3: { title: 'Peer session: Peer-to-Peer Ideation Workshop', body: `Peer-to-Peer Ideation Workshop is open, {{firstName}}. 30+ minutes. This one is different -- less reflection, more build. Bring one stuck problem on your change initiative. Your partner co-ideates with you. You leave with three options you would not have generated alone. No solo thinking in a transformation context.` },
  4: { title: 'Peer session: Change Readiness Assessment', body: `Change Readiness Assessment peer session is open, {{firstName}}. 30 minutes. Bring your current change initiative and the team it's landing on. Your partner walks you through three questions: Are they informed? Are they capable? Are they willing? Whichever you rate lowest is where Week 5's work needs to go.` },
  5: { title: 'Peer session: Feasibility Study Exercise', body: `Feasibility Study Exercise peer session is open, {{firstName}}. 30 minutes. Bring one proposed next step on your change initiative. Your partner pressure-tests the feasibility -- resources, dependencies, risk, timing. You leave with the plan de-risked or the plan in the bin. Either is a win.` },
  6: { title: 'Peer session: Stakeholder Communication Plan', body: `The final peer session is open, {{firstName}}. Stakeholder Communication Plan -- 30 minutes to draft who you communicate what to, when, across the next 90 days. Your Week 2 Connection Blueprint, your Week 4 Change Readiness work, and your Week 6 Change Leader Playbook all feed into this. One plan. One page. Walk it out on Monday.` },
}

const PROGRESS_CHECK_DAY2 = {
  1: `{{firstName}}, you are at {{currentPoints}} points. Target by end of this week: 6,500. Pass rate for the journey is 40,000. The first LIFT Module payout lands at Week 2 completion -- 7,000 points in one hit when you finish Stakeholder Influence for Transformation Leaders. Stay in the course.`,
  2: `{{firstName}}, you are at {{currentPoints}} of 21,000. Final week of Stakeholder Influence for Transformation Leaders. The Connection Blueprint Capstone closes the course and triggers a 7,000-point payout. This is the biggest points moment of the journey so far. Block time for it this week.`,
  3: `Leading Through Change and Continuous Improvement has started, {{firstName}}. You are at {{currentPoints}} of 28,500 target. New course, new rhythm. This one is four weeks -- longer and heavier than the first. Vision and Digital Transformation are this week. Pace yourself.`,
  4: `{{firstName}}, you are at {{currentPoints}} of 36,000. Heads-up: this is the heaviest content week in Leading Through Change -- Change Strategies, Leading a Team Through Change, plus Leveraging EQ. Block two sessions this week. Do not leave this one for the weekend.`,
  5: `{{firstName}}, you are at {{currentPoints}} of 43,500. This week shifts from strategy to execution -- Stakeholder Management, Conflict, Problem Solving, and Measuring Change Impact. This is where most programmes lose people. Don't.`,
  6: `Final week, {{firstName}}. You are at {{currentPoints}} points. The Change Leader Playbook Capstone triggers the final 7,000-point payout. Finishing the course on time is the difference between passing and not passing the journey.`,
}

const PROGRESS_CHECK_DAY5 = {
  1: `End of Week 1, {{firstName}}. Sitting at {{currentPoints}} of 6,500. Stakeholder Influence for Transformation Leaders closes next week. The Connection Blueprint Capstone is the single biggest points moment coming up. Bank one session this weekend if you can.`,
  2: `Stakeholder Influence for Transformation Leaders closes this weekend, {{firstName}}. {{currentPoints}} points banked. If the Connection Blueprint Capstone is not finished by Sunday, you miss the 7,000-point payout. Finish it. Everything else can wait.`,
  3: `End of Week 3, {{firstName}}. {{currentPoints}} out of 28,500. The Communicating a Vision section is a quick catch-up if you're behind. The next bi-weekly checkpoint lands at end of Week 4.`,
  4: `End of Week 4, {{firstName}}: {{currentPoints}} of 36,000. You are halfway through Leading Through Change. The final LIFT Module payout is at Week 6 -- another 7,000. Stay in.`,
  5: `End of Week 5, {{firstName}}: {{currentPoints}} points. One week left. The Change Leader Playbook Capstone lands next week. You are within reach of the 40,000 pass rate -- the final LIFT Module payout at end of Week 6 clears it. Do not coast. Finish what you started.`,
  6: `48 hours to go, {{firstName}}. {{currentPoints}} points. The Capstone, Personal Assessment, and Course Feedback close this weekend. Do them. The 7,000 payout is on the other side of finishing.`,
}

const SURVEYS = {
  1: { week: 1, day: 3, title: 'Open the app: W1 Baseline Assessment', body: `{{firstName}}, the Art of Connection Baseline Assessment is inside the course this week. 10 minutes. Your answers become your reference point for Week 2. Open the app.` },
  2: { week: 2, day: 6, title: 'Open the app: W2 Course Feedback', body: `{{firstName}}, before you close Stakeholder Influence for Transformation Leaders, complete the Course Feedback survey inside the course. 5 minutes. Your feedback shapes the next cohort.` },
  4: { week: 4, day: 3, title: 'Open the app: W4 Leadership Self Assessment', body: `{{firstName}}, the Leadership Self Assessment for Leading Through Change is inside the course this week. Same drill as Week 1: 10 minutes, your reference point for Week 6. Open the app.` },
  6: { week: 6, day: 6, title: 'Open the app: Final Course Feedback', body: `Final survey, {{firstName}}. Course Feedback for Leading Through Change is inside the course. 5 minutes. Last thing before graduation.` },
}

const buildEmailHtml = (paragraphs, links) => {
  const greeting = `<p style="margin:0 0 16px;font-size:15px;color:#2D3748;">Hi <strong>{{firstName}}</strong>,</p>`
  const paragraphsHtml = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;color:#4A5568;line-height:1.6;">${p}</p>`)
    .join('')
  const linksHtml = links
    ? links
        .map(
          (l) =>
            `<p style="margin:0 0 8px;font-size:14px;color:#4A5568;line-height:1.6;"><strong>${l.label}:</strong> <a href="${l.url}" style="color:#350e6f;">${l.url}</a></p>`,
        )
        .join('')
    : ''
  const signoff = `<p style="margin:24px 0 0;font-size:14px;color:#4A5568;">${SENDER}</p>`
  return `${greeting}${paragraphsHtml}${linksHtml}${signoff}`
}

const buildEmailText = (paragraphs, links) => {
  const greeting = `Hi {{firstName}},`
  const paragraphsText = paragraphs.join('\n\n')
  const linksText = links ? '\n\n' + links.map((l) => `${l.label}: ${l.url}`).join('\n') : ''
  return `${greeting}\n\n${paragraphsText}${linksText}\n\n${SENDER}`
}

const email = (subject, preview, paragraphs, links) => ({
  subject,
  preview,
  bodyHtml: buildEmailHtml(paragraphs, links),
  bodyText: buildEmailText(paragraphs, links),
})

const DIGITAL_EDGE_EMAILS = {
  1: email(
    'The Claude prompt that maps your communication defaults in 10 minutes',
    'A prompt that turns three recent stakeholder moments into a map of how you over-explain, under-explain, hedge, or go corporate under pressure.',
    [
      `This week you're working on communication fundamentals. Most leaders don't know their own defaults until someone reflects them back. This prompt does that in ten minutes.`,
      `You paste three recent high-stakes stakeholder moments. Claude tells you the pattern -- over-explainer, hedger, corporate-voice shifter, premature closer. Then it names the one you do most.`,
      `Open the Gamma, copy the prompt, do the work. 10 minutes. Bring what you find into your Creative Problem Solving Session peer session.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[1] }],
  ),
  2: email(
    'Build your Connection Blueprint in 20 minutes',
    "A prompt that takes your Week 1 default-pattern work and this week's presenting, listening, and conflict comms lessons and produces a one-page blueprint for how you influence.",
    [
      `You're closing Stakeholder Influence for Transformation Leaders this week. The Capstone asks you to produce a Connection Blueprint. Most practitioners stare at the blank template and freeze.`,
      `This week's Digital Edge is a prompt that turns your Week 1 default-pattern work, your Week 2 listening and conflict reflections, and your stakeholder mapping into a first draft of the blueprint. 20 minutes. One page.`,
      `Walk into Stakeholder Mapping peer session with it already drafted.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[2] }],
  ),
  3: email(
    'Stress-test your change vision before your team tunes it out',
    'A prompt that takes your current change vision and returns the four ways your team will likely hear it -- including the one that tanks adoption.',
    [
      `Leading Through Change opens with Communicating a Vision. Every change programme has a vision. Most of them don't land because the leader stress-tested the pitch in their head, not in the team's.`,
      `This week's Digital Edge is a prompt that takes your vision statement and returns how four different archetypes of your team will actually hear it: the True Believer, the Tired Pragmatist, the Quiet Cynic, and the Exposed Middle Manager. Then it tells you which rewrite closes the gap.`,
      `Open the Gamma. Copy the prompt. Do the work. 15 minutes.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[3] }],
  ),
  4: email(
    'A change roadmap prompt that flags the EQ moments before they hit',
    "Most change plans map tasks and dependencies. They don't map the emotional pinch points. This prompt maps both.",
    [
      `This week is Change Strategies, Leading a Team Through Change, and Leveraging EQ. These three live together because they break together. A change roadmap that ignores the emotional pinch points fails at exactly those pinch points.`,
      `This week's Digital Edge is a prompt that takes your change roadmap and overlays the EQ moments -- where people will feel exposed, resistant, or checked out. It names the conversations you need to have before those weeks land, not during.`,
      `Test the output in your Change Readiness Assessment peer session.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[4] }],
  ),
  5: email(
    'Build a behavioural KPI dashboard for your change in 15 minutes',
    'Most change dashboards track outputs. This prompt builds one that tracks whether behaviour has actually shifted.',
    [
      `This week is Stakeholder Management, Conflict, Problem Solving, and Measuring Change Impact. The measurement part is where most change programmes quietly lose the plot. Deliverables get counted. Behaviours don't.`,
      `This week's Digital Edge is a prompt that takes your change initiative and produces a behavioural KPI dashboard -- what to observe, how often, what signals good versus bad. 15 minutes. One dashboard.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[5] }],
  ),
  6: email(
    'Your 90-day Change Leader Playbook (final Digital Edge)',
    'Last one. Takes your Connection Blueprint, your vision stress-test, your change roadmap, your behavioural KPI dashboard, and your capstone -- and produces one page for the next 90 days.',
    [
      `Final Digital Edge. This is the conversion moment.`,
      `This prompt takes everything: your Week 2 Connection Blueprint, your Week 3 vision stress-test, your Week 4 EQ-mapped roadmap, your Week 5 behavioural KPI dashboard, and your Change Leader Playbook Capstone. It produces one page. Three 30-day blocks. Clear actions.`,
      `This is the document you reference for the next 90 days. Book a 15-minute conversation with your exec sponsor, your manager, or your most trusted peer. Walk them through it. Don't email it. Walk them through it.`,
      `Proud of you for finishing. Now the real work starts.`,
    ],
    [{ label: 'Gamma', url: GAMMA_URLS[6] }],
  ),
}

const SHAMELESS_PODCAST_EMAILS = {
  1: email(
    'Weekend listen: the pitch that finally landed after 18 months',
    '30-60 min podcast + workbook to complete. Pairs with Mastering Communication Fundamentals.',
    [
      `This week's Shameless Podcast pairs with Mastering Communication Fundamentals. A practitioner walks through 18 months of trying to pitch the same idea to her executive team, what she kept getting wrong, and the single shift that made the last pitch land.`,
      `Not the glossy TED version. The version with the pre-meeting nerves and the post-meeting analysis.`,
      `Block an hour this weekend. Listen with the workbook open. The workbook is where the points land and, more importantly, where the podcast becomes useful to your own work.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[1].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[1].workbook }],
  ),
  2: email(
    'Weekend listen: the stakeholder she misread for a year',
    '30-60 min podcast + workbook. Pairs with Presenting with Confidence and Stakeholder Mapping.',
    [
      `Week 2 closes Stakeholder Influence for Transformation Leaders. This week's Shameless Podcast is a practitioner talking about the senior stakeholder she misread for a year -- and what happened when she finally mapped them honestly instead of hopefully.`,
      `One hour over the weekend. Do the workbook. Bring the reflections into your Connection Blueprint.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[2].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[2].workbook }],
  ),
  3: email(
    'Weekend listen: the vision that sounded great and changed nothing',
    '30-60 min podcast + workbook. Pairs with Communicating a Vision.',
    [
      `New course. This week's podcast is a practitioner walking through the change vision they spent months crafting, delivered in a town hall to applause, and six months later realised had changed nothing in how the team actually worked.`,
      `What they did about it. What they'd do differently now. The workbook walks you through your own vision.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[3].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[3].workbook }],
  ),
  4: email(
    'Weekend listen: the EQ moment that saved the programme',
    '30-60 min podcast + workbook. Pairs with Leading a Team Through Change and Leveraging EQ.',
    [
      `This week is the heaviest content week of the journey. This week's Shameless Podcast is a practitioner describing the moment their change programme was about to collapse, what the team was really feeling underneath the status updates, and the single empathetic conversation that kept the thing alive.`,
      `Not a hero story. A recovery story.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[4].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[4].workbook }],
  ),
  5: email(
    'Weekend listen: what they measured, what mattered, and the gap between them',
    '30-60 min podcast + workbook. Pairs with Measuring Change Impact.',
    [
      `This week's work is measurement and stakeholder management. This week's podcast is a practitioner talking about a year of change metrics that looked great on the steering-committee slides -- and the leading indicator they weren't tracking that predicted the whole thing would unwind.`,
      `What they missed. What they track now. The workbook walks you through your own dashboard.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[5].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[5].workbook }],
  ),
  6: email(
    'Final weekend listen: what actually stuck',
    '30-60 min podcast + workbook. Closes Leading Through Change and Continuous Improvement. Closes the Power Journey.',
    [
      `Last one. A practitioner who completed the Transforming Business Power Journey six months ago talks about what actually stuck, what faded, and what they wish they'd known at Week 6.`,
      `No fluff. No graduation-speech energy. Just the honest view from the other side of the journey.`,
      `Workbook is your closure. Finish it. Proud of you.`,
    ],
    [{ label: 'Podcast', url: PODCAST_URLS[6].podcast }, { label: 'Workbook Playbook', url: PODCAST_URLS[6].workbook }],
  ),
}

const buildWeekTemplates = (week) => {
  const out = []

  out.push({
    key: `tb6w_w${week}_d1_affirmation`,
    programme: PROGRAMME,
    week,
    day: 1,
    contentKind: 'affirmation',
    channel: 'in_app',
    title: AFFIRMATIONS[week].title,
    messageBody: AFFIRMATIONS[week].body,
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d1_poll`,
    programme: PROGRAMME,
    week,
    day: 1,
    contentKind: 'poll',
    channel: 'in_app',
    title: `Week ${week} poll`,
    messageBody: `${POLL_INBOX_BODIES[week]} ${POLL_URLS[week]}`,
    externalUrl: POLL_URLS[week],
    referenceContent: { poll: POLLS[week] },
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d2_progress`,
    programme: PROGRAMME,
    week,
    day: 2,
    contentKind: 'progress_check',
    channel: 'push',
    progressVariant: 'day_2',
    title: `Week ${week} mid-week check`,
    messageBody: PROGRESS_CHECK_DAY2[week],
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d3_digital_edge`,
    programme: PROGRAMME,
    week,
    day: 3,
    contentKind: 'digital_edge_email',
    channel: 'email',
    title: DIGITAL_EDGE_EMAILS[week].subject,
    messageBody: DIGITAL_EDGE_EMAILS[week].preview,
    externalUrl: GAMMA_URLS[week],
    emailContent: DIGITAL_EDGE_EMAILS[week],
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d4_peer`,
    programme: PROGRAMME,
    week,
    day: 4,
    contentKind: 'peer_nudge',
    channel: 'in_app',
    title: PEER_NUDGES[week].title,
    messageBody: PEER_NUDGES[week].body,
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d5_progress`,
    programme: PROGRAMME,
    week,
    day: 5,
    contentKind: 'progress_check',
    channel: 'push',
    progressVariant: 'day_5',
    title: `Week ${week} end-of-week check`,
    messageBody: PROGRESS_CHECK_DAY5[week],
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  out.push({
    key: `tb6w_w${week}_d6_podcast`,
    programme: PROGRAMME,
    week,
    day: 6,
    contentKind: 'shameless_podcast_email',
    channel: 'email',
    title: SHAMELESS_PODCAST_EMAILS[week].subject,
    messageBody: SHAMELESS_PODCAST_EMAILS[week].preview,
    externalUrl: PODCAST_URLS[week].podcast,
    emailContent: SHAMELESS_PODCAST_EMAILS[week],
    targetAudience: TARGET_AUDIENCE,
    isActive: true,
  })

  return out
}

const surveyTemplates = [1, 2, 4, 6].map((sw) => ({
  key: `tb6w_w${sw}_d${SURVEYS[sw].day}_survey`,
  programme: PROGRAMME,
  week: SURVEYS[sw].week,
  day: SURVEYS[sw].day,
  contentKind: 'survey_reminder',
  channel: 'push',
  title: SURVEYS[sw].title,
  messageBody: SURVEYS[sw].body,
  targetAudience: TARGET_AUDIENCE,
  isActive: true,
}))

const templates = [
  ...buildWeekTemplates(1),
  ...buildWeekTemplates(2),
  ...buildWeekTemplates(3),
  ...buildWeekTemplates(4),
  ...buildWeekTemplates(5),
  ...buildWeekTemplates(6),
  ...surveyTemplates,
]

const buildDoc = (template) => {
  const out = {
    key: template.key,
    programme: template.programme,
    week: template.week,
    day: template.day,
    contentKind: template.contentKind,
    channel: template.channel,
    title: template.title,
    messageBody: template.messageBody,
    targetAudience: template.targetAudience,
    isActive: true,
  }
  if (template.progressVariant) out.progressVariant = template.progressVariant
  if (template.externalUrl) out.externalUrl = template.externalUrl
  if (template.referenceContent) out.referenceContent = template.referenceContent
  if (template.emailContent) out.emailContent = template.emailContent
  return out
}

const seed = async () => {
  console.log(
    `Seeding programme_notification_templates for ${PROGRAMME} -- ${templates.length} templates.`,
  )

  let created = 0
  let updated = 0
  const collectionRef = db.collection('programme_notification_templates')

  for (const template of templates) {
    const existing = await collectionRef.where('key', '==', template.key).limit(1).get()

    if (existing.empty) {
      await collectionRef.add({
        ...buildDoc(template),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
      created += 1
      console.log(`Created: ${template.key}`)
    } else {
      await existing.docs[0].ref.set(
        { ...buildDoc(template), updated_at: serverTimestamp() },
        { merge: true },
      )
      updated += 1
      console.log(`Updated: ${template.key}`)
    }
  }

  console.log(`Seed complete. Created ${created}, updated ${updated} (total ${templates.length}).`)
  process.exit(0)
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
