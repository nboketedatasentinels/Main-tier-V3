import { describe, expect, it } from 'vitest'
import { parseSurveyMonkeyDetailsToQuestions } from '@/utils/parseSurveyMonkeyDetails'

describe('parseSurveyMonkeyDetailsToQuestions', () => {
  it('expands matrix rating rows with the SurveyMonkey scale', () => {
    const questions = parseSurveyMonkeyDetailsToQuestions({
      pages: [
        {
          questions: [
            {
              family: 'presentation',
              headings: [{ heading: 'Rate yourself 1-10' }],
            },
            {
              family: 'matrix',
              subtype: 'rating',
              headings: [{ heading: 'Behaviours' }],
              answers: {
                rows: [
                  { text: 'I lead with purpose.' },
                  { text: 'I inspire others.' },
                ],
                choices: [
                  { text: '1', weight: 1 },
                  { text: '10', weight: 10 },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(questions).toEqual([
      { type: 'info', text: 'Rate yourself 1-10' },
      { type: 'info', text: 'Behaviours' },
      { type: 'rating', text: 'I lead with purpose.', min: 1, max: 10 },
      { type: 'rating', text: 'I inspire others.', min: 1, max: 10 },
    ])
  })

  it('keeps open-ended prompts including identity fields', () => {
    const questions = parseSurveyMonkeyDetailsToQuestions({
      pages: [
        {
          questions: [
            {
              family: 'open_ended',
              subtype: 'single',
              headings: [{ heading: 'Email address' }],
            },
            {
              family: 'open_ended',
              subtype: 'essay',
              headings: [{ heading: 'What did you learn?' }],
            },
          ],
        },
      ],
    })

    expect(questions).toEqual([
      { type: 'short_text', text: 'Email address' },
      { type: 'long_text', text: 'What did you learn?' },
    ])
  })
})
