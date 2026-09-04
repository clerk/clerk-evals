import { describe, expect, test } from 'bun:test'
import type { Evaluation } from '@/src/interfaces'
import { selectCompleteModels, type FileScore } from './merge-scores'

const evaluations: Evaluation[] = [
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/protect' },
  { framework: 'iOS', category: 'Add Auth', path: 'evals/add-auth', variant: 'ios' },
]

function score(model: string, evaluation: Evaluation, labelSuffix = ''): FileScore {
  return {
    model,
    label: `${model}${labelSuffix}`,
    framework: evaluation.framework,
    category: evaluation.category,
    value: 1,
    evalKey: evaluation.variant ? `${evaluation.path}::${evaluation.variant}` : evaluation.path,
  }
}

describe('complete model publication', () => {
  test('keeps only models with every exact cell in all modes', () => {
    const completeBaseline = evaluations.map((evaluation) => score('complete', evaluation))
    const completeMcp = evaluations.map((evaluation) => score('complete', evaluation, ' (MCP)'))
    const completeSkills = evaluations.map((evaluation) =>
      score('complete', evaluation, ' (Skills)'),
    )
    const partialBaseline = evaluations.map((evaluation) => score('partial', evaluation))
    const partialMcp = evaluations.map((evaluation) => score('partial', evaluation, ' (MCP)'))
    const partialSkills = [score('partial', evaluations[0]!, ' (Skills)')]

    const selected = selectCompleteModels(
      [...completeBaseline, ...partialBaseline],
      [...completeMcp, ...partialMcp],
      [...completeSkills, ...partialSkills],
      evaluations,
    )

    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.baseline).toHaveLength(2)
    expect(selected.mcp).toHaveLength(2)
    expect(selected.skills).toHaveLength(2)
    expect(selected.excludedModels).toEqual([
      { model: 'partial', baseline: 2, mcp: 2, skills: 1, expected: 2 },
    ])
  })

  test('does not count a duplicate cell as coverage', () => {
    const first = score('duplicate', evaluations[0]!)
    const selected = selectCompleteModels(
      [first, first],
      [first, first],
      [first, first],
      evaluations,
    )

    expect(selected.includedModels).toEqual([])
    expect(selected.excludedModels[0]).toMatchObject({ baseline: 1, mcp: 1, skills: 1 })
  })
})
