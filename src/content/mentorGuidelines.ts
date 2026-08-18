/**
 * T4L Mentor Guidelines - Version 1 · August 2026
 * Source of truth for the first-login modal and /mentor/guidelines page.
 */

export type MentorGuidelinesTable = {
  headers: string[]
  rows: string[][]
}

export type MentorGuidelinesBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'emphasis'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; table: MentorGuidelinesTable }
  | { type: 'subsection'; title: string; blocks: MentorGuidelinesBlock[] }
  | { type: 'promptGroup'; title: string; prompts: { n: number; text: string }[] }

export type MentorGuidelinesSection = {
  id: string
  number: number
  title: string
  blocks: MentorGuidelinesBlock[]
}

export const MENTOR_GUIDELINES_META = {
  title: 'T4L Mentor Guidelines',
  subtitle: 'For mentors on the Transformation Leader platform',
  version: 'Version 1 · August 2026',
} as const

export const MENTOR_GUIDELINES_SECTIONS: MentorGuidelinesSection[] = [
  {
    id: 'why-you-are-here',
    number: 1,
    title: 'Why you are here',
    blocks: [
      {
        type: 'paragraph',
        text: 'You have done the work our practitioners are doing now. That is the whole qualification. You are not here because you are the most senior person in the room. You are here because you have been through something they are currently inside of, and you came out the other side with something usable.',
      },
      {
        type: 'paragraph',
        text: 'A mentor meet-up is worth 2,000 points to your mentee and it is you who issues them. That matters less than what actually happens in the hour, but it does mean the session gets logged, and it does mean a leader who never requests one is carrying a points gap.',
      },
    ],
  },
  {
    id: 'what-a-mentor-is',
    number: 2,
    title: 'What a mentor is, and what a mentor is not',
    blocks: [
      {
        type: 'paragraph',
        text: 'There are four adult humans in a practitioner’s journey and they do different jobs. Know which one you are.',
      },
      {
        type: 'table',
        table: {
          headers: ['Role', 'What they do', 'How they work'],
          rows: [
            [
              'Transformation Partner',
              'Runs the weekly cohort session. Issues points for attendance and module completion. Tracks pace and flags Warning or Alert status.',
              'Group. Scheduled. Accountable for the cohort.',
            ],
            [
              'Mentor (you)',
              'Shares lived experience. Offers perspective on career, judgment calls, politics, and what the job actually costs.',
              'One to one. Monthly. Relationship-led.',
            ],
            [
              'Ambassador Coach',
              'Works on the mentee’s own goal using questions, not answers. Does not give advice by default.',
              'One to one. Booked. Outcome-led.',
            ],
            [
              'Peer',
              'Same cohort, same week, same pressure. Sense-checks practicals.',
              'Reciprocal. Self-booked.',
            ],
          ],
        },
      },
      {
        type: 'emphasis',
        text: 'A mentor gives away what they know. A coach draws out what the mentee already knows. Both are useful. They are not the same session and mentees can tell when the two get mixed.',
      },
      {
        type: 'subsection',
        title: 'You are not',
        blocks: [
          {
            type: 'bullets',
            items: [
              'Their assessor. You never see their capstone marks, and you never help write a summative submission. If they ask you to review capstone content, redirect them to their Transformation Partner.',
              'Their therapist. If the conversation goes somewhere clinical, see section 8.',
              'Their recruiter. Do not use mentoring sessions to source candidates for your own organization, sell services, or pitch. This is the fastest way to lose a mentoring seat.',
              'Obliged to have an answer. “I have never faced that, and here is who I would ask” is a complete and useful response.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'the-cadence',
    number: 3,
    title: 'The cadence',
    blocks: [
      {
        type: 'paragraph',
        text: 'Mentor meet-ups run monthly, on the leader’s journey length.',
      },
      {
        type: 'paragraph',
        text: 'One meet-up per month. The number of meet-ups is the length of the journey in months, and the platform sets it automatically.',
      },
      {
        type: 'table',
        table: {
          headers: ['Journey', 'Meet-ups', 'Points available'],
          rows: [
            ['3-Month', '3', '6,000'],
            ['6-Month', '6', '12,000'],
            ['9-Month', '9', '18,000'],
          ],
        },
      },
      {
        type: 'paragraph',
        text: 'The 6-Week Power Journey has no mentor component. It is too short to build the relationship that makes mentoring work.',
      },
      {
        type: 'emphasis',
        text: 'Length: 60 minutes.',
      },
      {
        type: 'paragraph',
        text: 'How a meet-up happens: the leader sends you a request with a proposed time. You accept it or propose another. You never book on their behalf. This is deliberate. A meet-up the leader asked for gets prepared for. A meet-up that appeared in their calendar gets attended.',
      },
      {
        type: 'paragraph',
        text: 'The consequence: if they do not request one, it does not happen, and they lose that month. If two consecutive months pass with no request, message them once. If nothing comes back, tell their Transformation Partner. Do not chase a third time.',
      },
    ],
  },
  {
    id: 'session-structure',
    number: 4,
    title: 'Session structure',
    blocks: [
      {
        type: 'subsection',
        title: 'First meet-up: build the ground',
        blocks: [
          {
            type: 'paragraph',
            text: 'Do not solve anything in the first session. You are establishing whether this person will tell you the truth in month four, and nothing else.',
          },
          {
            type: 'numbered',
            items: [
              'Open with a real question. Pick one from section 6. One, not a list.',
              'Tell them something that cost you. Not your CV. A decision that went badly, or a period where you were out of your depth. This sets the ceiling for how honest they will be with you. If you open with your wins, you will get their wins back for nine months.',
              'Ask what they actually want from you. Their app profile has a “what do you want from a mentor” answer. Read it before the call, then ask them anyway. What people select in an app and what they say out loud are often different, and the spoken version is the real one.',
              'Agree the boundaries. What is off the table, how they can contact you between sessions, what you will and will not do.',
              'Close with one thing. One thing they will do before the next session. Theirs, not yours.',
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Middle meet-ups: work the live problem',
        blocks: [
          {
            type: 'numbered',
            items: [
              'Two minutes on the last commitment. Did it happen. If not, what got in the way. No judgment, real curiosity. The obstacle is usually the more interesting material.',
              'What is live right now. Let them set the agenda. If they arrive with nothing, section 6 has reconnect prompts.',
              'Your experience, offered not imposed. The phrasing matters. “Here is what I did and here is what it cost me” lands. “You should” does not. Give them the reasoning behind your decision, not just the decision, because their situation will differ from yours in ways neither of you can see yet.',
              'One thing. Again.',
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Final meet-up: hand it forward',
        blocks: [
          {
            type: 'numbered',
            items: [
              'What has changed. Compare against what they told you in session one. Be specific. Most people cannot see their own delta.',
              'What is still unfinished. Name it honestly. A journey ending does not mean the work ended.',
              'Who they should meet. The single most valuable thing you own is your network. One warm introduction is worth more than nine months of advice.',
              'Whether this continues. Some mentoring relationships outlive the journey. Say plainly whether yours will, so they are not left guessing.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'how-to-say-things',
    number: 5,
    title: 'How to say things',
    blocks: [
      {
        type: 'emphasis',
        text: 'Instead of “you should,” try “when I was in that spot, here is what I chose and here is what it cost.” They keep the agency, you keep the credibility, and if it goes wrong they own it.',
      },
      {
        type: 'emphasis',
        text: 'Silence is a tool. After you ask a real question, count to five. The first answer is the prepared one. The second answer is the true one, and it only arrives if you leave room.',
      },
      {
        type: 'emphasis',
        text: 'Ask about the cost, not just the plan. “What is this going to take out of you?” surfaces more than any strategy question. Transformation work has a personal price and most practitioners have nowhere to say that out loud.',
      },
      {
        type: 'emphasis',
        text: 'Do not fix the emotion. If they are angry about a stakeholder, sit in the anger for a minute before moving to tactics. Skipping to tactics tells them the feeling was inconvenient.',
      },
      {
        type: 'emphasis',
        text: 'Bring the thing they cannot Google. They have courses, frameworks, podcasts, and an AI assistant. What they do not have is someone who can tell them how a board actually reacted when a program slipped, or what happens politically when you kill your own project. That is your edge. Use it.',
      },
    ],
  },
  {
    id: 'conversation-bank',
    number: 6,
    title: 'Icebreaker and conversation bank',
    blocks: [
      {
        type: 'emphasis',
        text: 'Rule: pick one. Never work through a list. A question is an opening, not an agenda. If the first one lands, follow it for twenty minutes and abandon the rest.',
      },
      {
        type: 'promptGroup',
        title: 'First meeting, opening',
        prompts: [
          { n: 1, text: 'What made you sign up for this, and what is the version you would not put in a form?' },
          { n: 2, text: 'Who is the leader you have learned the most from, and did they know they were teaching you?' },
          { n: 3, text: 'What is the thing you are best at that nobody in your current role has noticed?' },
          { n: 4, text: 'What did you want to be doing at this stage of your career, and how far off is it?' },
          { n: 5, text: 'What is the question you have been carrying that you have not had anyone to ask?' },
          { n: 6, text: 'Tell me about a decision you are still thinking about years later.' },
          { n: 7, text: 'What do people consistently misread about you at work?' },
          { n: 8, text: 'What part of your job would you do for free, and what part would you pay to never do again?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Story-based, gets past the CV',
        prompts: [
          { n: 9, text: 'What was your first real management mistake, and who paid for it?' },
          { n: 10, text: 'When did you last change your mind about something important at work?' },
          { n: 11, text: 'What is a piece of career advice you were given that turned out to be wrong for you?' },
          { n: 12, text: 'Which project failure taught you more than any of your wins?' },
          { n: 13, text: 'When have you been the only person in the room who thought something was a bad idea, and what did you do?' },
          { n: 14, text: 'What is the biggest gap between how a job was described and how it actually was?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Current situation',
        prompts: [
          { n: 15, text: 'What is taking up the most space in your head this week?' },
          { n: 16, text: 'Who is the hardest person for you to work with right now, and what do you think their version of the story is?' },
          { n: 17, text: 'What is the decision you are avoiding?' },
          { n: 18, text: 'If your program stopped tomorrow, what would people say the real reason was?' },
          { n: 19, text: 'Where are you spending time that does not match what you say your priorities are?' },
          { n: 20, text: 'What would have to be true for you to feel like this year was a success?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Linked to Leading Self in the Age of AI',
        prompts: [
          { n: 21, text: 'When do you notice yourself performing confidence you do not feel?' },
          { n: 22, text: 'What does your default reaction look like under pressure, and who has seen it?' },
          { n: 23, text: 'Where do you think you are underqualified, and is that read accurate or is it fear?' },
          { n: 24, text: 'What are you protecting that you should probably let go of?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Linked to Innovation and AI for Digital Transformation',
        prompts: [
          { n: 25, text: 'What is the AI decision on your desk right now that you are least sure about?' },
          { n: 26, text: 'Where is your organization adopting because of pressure rather than a case?' },
          { n: 27, text: 'What would you have to see to change your mind about a tool you currently believe in?' },
          { n: 28, text: 'Which of your data problems is everyone politely ignoring?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Linked to Fostering AI-Ready Teams',
        prompts: [
          { n: 29, text: 'Who on your team is quietly not on board, and how do you know?' },
          { n: 30, text: 'What conversation have you been putting off with someone who reports to you?' },
          { n: 31, text: 'Where is your team performing certainty they do not have?' },
          { n: 32, text: 'Who on your team is going to be most affected by what you are building, and have you told them?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Linked to Transforming Business with AI',
        prompts: [
          { n: 33, text: 'Which number in your business case do you privately not believe?' },
          { n: 34, text: 'What is the question your CFO will ask that you cannot answer yet?' },
          { n: 35, text: 'If the benefits do not land by month six, what happens to you personally?' },
          { n: 36, text: 'What are you measuring because it is easy rather than because it matters?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Reconnect prompts, later sessions',
        prompts: [
          { n: 37, text: 'What has shifted since we last spoke, even slightly?' },
          { n: 38, text: 'What did you say you would do, and what actually happened?' },
          { n: 39, text: 'What have you stopped doing since this journey started?' },
          { n: 40, text: 'Who noticed a change in you before you noticed it yourself?' },
        ],
      },
      {
        type: 'promptGroup',
        title: 'Lighter, when the relationship needs air',
        prompts: [
          { n: 41, text: 'What is the best thing you have read, watched, or listened to lately, work or not?' },
          { n: 42, text: 'What did you want to be at fourteen, and is there anything left of that person?' },
          { n: 43, text: 'What is something you are good at that has nothing to do with work?' },
          { n: 44, text: 'Where in the world do you think most clearly?' },
        ],
      },
    ],
  },
  {
    id: 'when-the-session-stalls',
    number: 7,
    title: 'When the session stalls',
    blocks: [
      {
        type: 'emphasis',
        text: 'They arrive with nothing. Go to prompt 15 or 37. If still nothing, tell a story of your own about the same stage in your career. Stories generate questions where questions do not.',
      },
      {
        type: 'emphasis',
        text: 'They only want validation. Give it once, honestly, then ask what they would do if they knew you would not be impressed either way.',
      },
      {
        type: 'emphasis',
        text: 'They want you to solve it. “I could tell you what I would do, but I do not know your CEO. Walk me through what the two real options are and I will tell you where I have seen each one break.”',
      },
      {
        type: 'emphasis',
        text: 'They cancel repeatedly. Ask directly whether the pairing is working. Nobody is served by a mentorship neither party wants. Reassignment through the Transformation Partner is normal and carries no penalty.',
      },
      {
        type: 'emphasis',
        text: 'They want more time than you have. Say your limit plainly at the start. Mentors burn out silently and then disappear, which is worse for the mentee than a clear boundary in month one.',
      },
    ],
  },
  {
    id: 'boundaries',
    number: 8,
    title: 'Boundaries, confidentiality, and escalation',
    blocks: [
      {
        type: 'emphasis',
        text: 'Confidentiality is the default. What is said in a meet-up stays there. You may log that a session happened, its duration, and general themes. Never log content that would identify a third party or a commercially sensitive matter.',
      },
      {
        type: 'paragraph',
        text: 'Three exceptions, and only three:',
      },
      {
        type: 'numbered',
        items: [
          'Risk of harm to the mentee or someone else.',
          'Disclosure of conduct that endangers others.',
          'Something that makes the mentee’s assessment result unsafe, such as evidence of submitted work that is not theirs. This goes to the Transformation Partner, not to you to resolve.',
        ],
      },
      {
        type: 'paragraph',
        text: 'If a mentee discloses distress beyond the ordinary pressure of the job, you do not counsel. You do three things: acknowledge without minimizing, say plainly that this is outside what mentoring can hold, and ask whether they have support outside work. Then notify the Programme Lead the same day. You are not passing them off. You are getting them to someone qualified.',
      },
      {
        type: 'emphasis',
        text: 'Never: comment on another mentee, another mentor, or a named T4L staff member’s performance. Never share a mentee’s situation with their employer, including when their employer sponsored the seat.',
      },
    ],
  },
  {
    id: 'admin',
    number: 9,
    title: 'Admin',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Issue points within 48 hours of the meet-up. Late points distort a mentee’s window status and can push them into a false Warning flag.',
          'Log the session in the platform: date, duration, one-line theme. Not content.',
          'Update your availability in the app when it changes. An unbookable mentor looks like an absent one.',
          'Flag a reassignment need early. Month two, not month eight.',
        ],
      },
    ],
  },
  {
    id: 'the-short-version',
    number: 10,
    title: 'The short version',
    blocks: [
      {
        type: 'emphasis',
        text: 'Give away what you know. Tell them what it cost. Ask one real question and wait longer than is comfortable for the answer. Do not sell them anything. Send them to someone better than you when you are out of your depth, and make the introduction yourself.',
      },
    ],
  },
]
