/**
 * T4L Coach Guidelines - Version 1 · August 2026
 */

import type { MentorGuidelinesSection } from '@/content/mentorGuidelines'

export const COACH_GUIDELINES_META = {
  title: 'T4L Coach Guidelines',
  subtitle:
    'For Ambassador Coaches delivering one-to-one coaching on the Transformation Leader platform',
  version: 'Version 1 · August 2026',
  note: 'This document sits alongside your coaching agreement. The agreement covers commercial terms, session rates, and contracting. This document covers practice. Where the two ever conflict, the agreement wins on commercials and this document wins on practice.',
} as const

export const COACH_GUIDELINES_SECTIONS: MentorGuidelinesSection[] = [
  {
    id: 'who-coaches',
    number: 1,
    title: 'Who coaches at T4L',
    blocks: [
      {
        type: 'paragraph',
        text: 'T4L coaching is delivered by practitioners. Not by professional coaches who have only read about transformation. You are here because you have run the work, and because you can hold a session without turning it into a consulting pitch.',
      },
      {
        type: 'paragraph',
        text: 'That combination is rarer than it sounds and it is the whole product. A practitioner who cannot resist solving becomes a consultant. A coach with no operating experience cannot tell when a client is describing a real constraint versus an imagined one. You have to be both, and the discipline sits in knowing which mode you are in at any moment.',
      },
    ],
  },
  {
    id: 'two-surfaces',
    number: 2,
    title: 'Two coaching surfaces, different rules',
    blocks: [
      {
        type: 'paragraph',
        text: 'You may be delivering one of two things. Know which before you open the call.',
      },
      {
        type: 'table',
        table: {
          headers: ['', 'Journey office hours', 'Transformation Coaching'],
          rows: [
            [
              'Who',
              'Leaders enrolled on a Journey',
              'Anyone, enrolled or not. Often bought by their organization.',
            ],
            ['Basis', 'Included in the Journey', 'Purchased. Standard is one session or five.'],
            ['Points', '2,000 per Coach Session, coach-issued', 'None'],
            [
              'Focus',
              'Applying the Journey material to their real work',
              'Whatever the client contracts for',
            ],
            ['Length', '60 minutes', '60 minutes'],
            ['Assessment link', 'Adjacent to assessed work. See section 7.', 'None'],
          ],
        },
      },
      {
        type: 'emphasis',
        text: 'Office hours are not free coaching sessions with a different name. They are bounded: the client’s own transformation work, in the frame of the Journey material. If an office-hours conversation is repeatedly pulling toward career, personal life, or matters outside the Journey, that is a signal to tell the practitioner that paid coaching exists and is a better container for it. Say it once, factually, and drop it. Selling inside an included session damages trust in both products.',
      },
    ],
  },
  {
    id: 'not-mentoring',
    number: 3,
    title: 'Coaching is not mentoring',
    blocks: [
      {
        type: 'paragraph',
        text: 'Mentors on this platform give away what they know. You do the opposite by default.',
      },
      {
        type: 'paragraph',
        text: 'The mentee of a mentor leaves with the mentor’s experience. The client of a coach leaves with their own thinking, sharpened, and a decision they own. If your client is quoting you back to themselves three months later, something has gone slightly wrong.',
      },
      {
        type: 'emphasis',
        text: 'This does not mean you withhold everything. Practitioner coaching earns its price partly because you can say “I have watched that fail twice, here is how.” Do it, but do it deliberately and late, and label it. “I am going to step out of coaching for a minute and tell you something as a practitioner. You can take it or leave it.” Then step back in. The naming is what protects the contract. Advice that arrives unlabelled inside a coaching session quietly converts the client from thinker to recipient.',
      },
      {
        type: 'emphasis',
        text: 'Rough proportion: eighty percent questions, twenty percent experience, and never the reverse.',
      },
    ],
  },
  {
    id: 'contracting',
    number: 4,
    title: 'Contracting',
    blocks: [
      {
        type: 'paragraph',
        text: 'Contracting is the single highest-return ten minutes in coaching, and it is the thing most practitioner coaches skip because it feels like admin. It is not admin. It is the session working before the session starts.',
      },
      {
        type: 'paragraph',
        text: 'In the first session of any engagement, get explicit agreement on:',
      },
      {
        type: 'numbered',
        items: [
          'The outcome. Not the topic. “I want to think about my team” is a topic. “I want to be able to hold a direct conversation with my head of data without backing down” is an outcome. Push until it is observable by someone else.',
          'How they will know it worked. What would be different, and who would notice.',
          'What is off-limits. Some clients have areas they will not open. Ask, and respect it without exploring why.',
          'How they want to be challenged. Their app profile carries a challenge preference. Confirm it verbally. People routinely set it to “push me hard” and then mean something softer.',
          'Confidentiality and its limits. Section 8. Say it out loud, do not assume they read it.',
          'The number of sessions and what happens at the end.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Re-contract at the start of any session where the client’s stated goal has visibly moved. Working the old goal because it was agreed in session one is a common and expensive failure.',
      },
    ],
  },
  {
    id: 'session-structure',
    number: 5,
    title: 'Session structure',
    blocks: [
      {
        type: 'paragraph',
        text: 'Four moves. Not a script, and rarely in a clean order, but if a session ended and you cannot say you made all four, it was a conversation rather than a coaching session.',
      },
      {
        type: 'subsection',
        title: 'Move one: land the session',
        blocks: [
          {
            type: 'emphasis',
            text: '“What is the one thing that, if we worked on it for the next hour, would make this hour worth it?”',
          },
          {
            type: 'paragraph',
            text: 'Then hold them to it. Clients present the safe version first. The presenting problem and the real problem are usually adjacent, not identical, and the real one arrives around minute twelve. Do not close the agenda too early and do not let it drift into three topics.',
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Move two: widen before narrowing',
        blocks: [
          {
            type: 'paragraph',
            text: 'Most practitioners arrive with two options and a preference. Your job is to make sure the two options are the real ones.',
          },
          {
            type: 'bullets',
            items: [
              'What is the version of this you have not said out loud?',
              'What are you assuming that you have not tested?',
              'If this were happening to someone you respect, what would you see that they cannot?',
              'What would you do if you knew you could not be blamed for it?',
              'What is the cost of doing nothing, and is that cost being carried by you or by someone else?',
              'Whose problem is this, actually?',
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Move three: find the constraint',
        blocks: [
          {
            type: 'paragraph',
            text: 'There is nearly always one thing genuinely in the way, and it is nearly never the thing named first. It is usually a relationship, a fear about competence, or an unspoken political fact.',
          },
          {
            type: 'bullets',
            items: [
              'What has stopped you already?',
              'What would you have to give up to do this?',
              'Who benefits from the current situation staying as it is?',
              'What are you protecting?',
            ],
          },
          {
            type: 'emphasis',
            text: 'When the real constraint surfaces, the client’s language changes. They slow down, or get more specific, or go quiet. That shift is the signal you are on it. Stay there. Do not rescue the silence.',
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Move four: commit',
        blocks: [
          {
            type: 'paragraph',
            text: 'End with something specific enough that it either happened or it did not.',
          },
          {
            type: 'bullets',
            items: [
              'What are you going to do, by when?',
              'What is the first move, the one you could make tomorrow?',
              'What will get in the way, and what is your plan for that?',
              'Who needs to know?',
            ],
          },
          {
            type: 'emphasis',
            text: '“I will think about it” is not a commitment. Push once, gently. If they still will not commit, that is data worth naming: “I notice we get concrete and then it goes soft. What is that about?”',
          },
        ],
      },
    ],
  },
  {
    id: 'session-count',
    number: 6,
    title: 'How many sessions you have',
    blocks: [
      {
        type: 'emphasis',
        text: 'Coaching volume is bought, not fixed by the journey. Standard is one session or five. An organization may buy a different number for a cohort, and the platform will show you what was purchased before you contract.',
      },
      {
        type: 'paragraph',
        text: 'This changes how you open.',
      },
      {
        type: 'subsection',
        title: 'One session',
        blocks: [
          {
            type: 'paragraph',
            text: 'You have an hour and no second chance, so contract in the first ten minutes and commit in the last ten. Do not attempt to find a deep constraint. Take the goal they arrive with, make it sharper, find the one thing in the way, and get a commitment. A single session that produces one real decision is a success. A single session that opens something you cannot close is not.',
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Five sessions',
        blocks: [
          {
            type: 'paragraph',
            text: 'Use the arc below.',
          },
        ],
      },
      {
        type: 'table',
        table: {
          headers: ['Session', 'Focus'],
          rows: [
            [
              '1',
              'Contracting and the real goal. Expect the stated goal to change by session two.',
            ],
            ['2', 'The constraint. What is actually in the way, named honestly.'],
            [
              '3',
              'Action and the first live attempt. Something happens in the world between two and three.',
            ],
            [
              '4',
              'What happened. This is usually the most valuable session, because reality has now interfered with the plan.',
            ],
            [
              '5',
              'Consolidation and handover. What they take forward without you, and what they will do when the same pattern shows up again.',
            ],
          ],
        },
      },
      {
        type: 'emphasis',
        text: 'Between sessions: the client works, not you. Do not build them decks. Do not send reading lists as a matter of routine. Occasional and specific is fine. Habitual is you doing the work.',
      },
    ],
  },
  {
    id: 'assessed-work',
    number: 7,
    title: 'Coaching near assessed work',
    blocks: [
      {
        type: 'paragraph',
        text: 'This is the line that matters most, and it is where a well-meaning coach can damage a practitioner’s qualification.',
      },
      {
        type: 'paragraph',
        text: 'Journey clients are being assessed. The Capstone is 50 percent of their competence pass, case studies 30, practicals portfolio 20. Their work must be theirs.',
      },
      {
        type: 'subsection',
        title: 'You may',
        blocks: [
          {
            type: 'bullets',
            items: [
              'Coach the thinking behind a practical. What they have considered, what they have not.',
              'Ask questions that expose a weak assumption.',
              'Help them find their own structure.',
              'Point them to the framework discipline the Journey teaches.',
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'You may not',
        blocks: [
          {
            type: 'bullets',
            items: [
              'Read a draft and mark it up.',
              'Supply content, wording, or worked answers.',
              'Tell them what a specific case study is “really about.”',
              'Predict a grade or comment on marking.',
            ],
          },
        ],
      },
      {
        type: 'emphasis',
        text: 'The test: if the practitioner would be able to defend their submission to an assessor without mentioning you, you are on the right side of the line. If your fingerprints are on the artifact, you have crossed it.',
      },
      {
        type: 'paragraph',
        text: 'If asked directly for answers, say so plainly and without drama: “I will not do that, because it would put your assessment at risk. What I will do is help you get to your own answer faster.” Nobody has ever ended a coaching relationship over that sentence.',
      },
      {
        type: 'emphasis',
        text: 'You never issue an assessment judgment, and you never see marks. Assessment sits with the Transformation Partner and the moderator. That separation is what makes the qualification defensible.',
      },
    ],
  },
  {
    id: 'ethics',
    number: 8,
    title: 'Ethics, boundaries, and duty of care',
    blocks: [
      {
        type: 'emphasis',
        text: 'Confidentiality. Sessions are confidential. You log that a session occurred, its length, and a one-line non-identifying theme. Nothing else. Where an employer sponsored the seat, the employer receives no session content, ever. If a sponsor asks you directly, refer them to the Programme Lead.',
      },
      {
        type: 'paragraph',
        text: 'The exceptions, and there are only three:',
      },
      {
        type: 'numbered',
        items: [
          'Risk of harm to the client or another person.',
          'Disclosure of conduct that endangers others.',
          'Assessment integrity, where you become aware that submitted work is not the client’s own.',
        ],
      },
      {
        type: 'emphasis',
        text: 'Coaching is not therapy. You are working with a competent adult on a professional goal. If the material is grief, trauma, addiction, or a mental health condition, coaching is the wrong container regardless of how well the session is going. Acknowledge it, say clearly that this needs support you are not qualified to give, ask whether they have that support, and notify the Programme Lead the same day. Do not attempt a handover conversation on your own judgment about what they need.',
      },
      {
        type: 'paragraph',
        text: 'Conflicts of interest. Declare before the first session if you have a commercial relationship with the client’s organization, are a competitor, or know a named third party in the situation. Declare, then let the Programme Lead decide. Do not decide yourself that it is fine.',
      },
      {
        type: 'paragraph',
        text: 'No selling. You do not pitch your own consulting, your employer’s services, or a role at your organization inside a T4L coaching session. If a client initiates, tell them it happens outside the coaching relationship and that the coaching relationship ends if the commercial one starts.',
      },
      {
        type: 'paragraph',
        text: 'Dual relationships. You cannot coach someone you also mentor on this platform, or someone in a cohort you facilitate. If the platform pairs you into that overlap, flag it.',
      },
    ],
  },
  {
    id: 'quality',
    number: 9,
    title: 'Quality and how you get better',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Supervision. Coaches meet as a group quarterly to bring live cases, anonymized. Attendance is part of holding a coaching seat, not optional.',
          'Client feedback is collected after session one and at the end of an engagement. Two questions: did the coach do more listening than talking, and did you leave with something you own. Both are read.',
          'Self-review after each session. Two questions, thirty seconds: where did I talk when I should have waited, and what did I not ask because I was uncomfortable? The second one is where the growth is.',
          'Reassignment carries no stigma. Some pairings do not work for reasons neither party controls. Raise it early with the Programme Lead. A reassignment in session two is a normal event. In session five it is a failure.',
        ],
      },
    ],
  },
  {
    id: 'admin',
    number: 10,
    title: 'Admin',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Issue Coach Session points within 48 hours for Journey clients. Late points create false Warning flags on a practitioner’s window status.',
          'Log date, duration, and one-line theme. Never content.',
          'Keep availability current in the app.',
          'Cancellations and no-shows follow your coaching agreement. Apply the terms consistently, including when you would rather not.',
        ],
      },
    ],
  },
  {
    id: 'short-version',
    number: 11,
    title: 'The short version',
    blocks: [
      {
        type: 'emphasis',
        text: 'Contract properly, then ask more than you tell. Find the constraint, not the topic. Label it when you step out of coaching to give a practitioner’s view, and step back in afterward. Never touch assessed work. Send them somewhere else the moment the material stops being professional, and do it the same day.',
      },
    ],
  },
]
