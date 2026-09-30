import { describe, expect, test } from 'bun:test'

import type { DBScore, RunMetadata } from './db'
import { selectLatestScores } from './rebuild-scores'

const anchor: RunMetadata = {
  runId: 'baseline-main',
  mode: 'baseline',
  models: ['model-a'],
  evalKeys: ['eval-a'],
  suiteHash: 'suite',
  createdAt: '2026-09-03T00:00:00.000Z',
}

const score = (runId: string, value: number, updatedAt: string): DBScore => ({
  runId,
  model: 'model-a',
  label: 'Model A',
  framework: 'Next.js',
  category: 'Auth',
  evalKey: 'eval-a',
  value,
  updatedAt,
})

describe('selectLatestScores', () => {
  test('uses the newest exact cell from compatible recovery runs', () => {
    const runs = new Map<string, RunMetadata>([
      [anchor.runId, anchor],
      ['baseline-retry', { ...anchor, runId: 'baseline-retry' }],
    ])

    const selected = selectLatestScores(
      [
        score(anchor.runId, 0.25, '2026-09-03T01:00:00.000Z'),
        score('baseline-retry', 0.75, '2026-09-03T02:00:00.000Z'),
      ],
      runs,
      anchor,
    )

    expect(selected).toHaveLength(1)
    expect(selected[0]?.value).toBe(0.75)
    expect(selected[0]?.runId).toBe('baseline-retry')
  })

  test('excludes other modes, models, and eval keys', () => {
    const runs = new Map<string, RunMetadata>([
      [anchor.runId, anchor],
      ['skills-run', { ...anchor, runId: 'skills-run', mode: 'skills' }],
    ])
    const otherModel = { ...score(anchor.runId, 1, '2026-09-03T02:00:00.000Z'), model: 'model-b' }
    const otherEval = { ...score(anchor.runId, 1, '2026-09-03T03:00:00.000Z'), evalKey: 'eval-b' }

    expect(
      selectLatestScores(
        [score('skills-run', 1, '2026-09-03T01:00:00.000Z'), otherModel, otherEval],
        runs,
        anchor,
      ),
    ).toEqual([])
  })
})
