import { describe, expect, test } from 'bun:test'
import { EVALUATIONS } from '@/src/config'
import type { Evaluation } from '@/src/interfaces'
import { mergeScores, selectCompleteModels, type FileScore } from './merge-scores'

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

  test('default publication omits Upgrades while keeping the model complete', () => {
    const rows = EVALUATIONS.map((evaluation) => score('complete', evaluation))
    const selected = selectCompleteModels(rows, rows, rows)
    const merged = mergeScores(selected.baseline, selected.mcp, selected.skills)

    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.baseline).toHaveLength(EVALUATIONS.length - 1)
    expect(merged.some((entry) => entry.category === 'Upgrades')).toBe(false)
  })

  test('does not require an excluded evaluation in any mode', () => {
    const publicEval = evaluations[0]!
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Auth',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const publicScore = score('complete', publicEval)
    const selected = selectCompleteModels(
      [publicScore],
      [publicScore],
      [publicScore],
      [publicEval, hiddenEval],
    )

    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.excludedModels).toEqual([])
    expect(selected.baseline).toEqual([publicScore])
  })

  test('removes excluded and legacy rows from all modes and merged scores', () => {
    const publicEval = evaluations[0]!
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Auth',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const hiddenOnlyEval: Evaluation = {
      framework: 'Next.js',
      category: 'Upgrades',
      path: 'evals/example/hidden-only',
      variant: 'nextjs',
      publishToLlmLeaderboard: false,
    }
    const publicRow = { ...score('complete', publicEval), value: 0.8, runId: 'public' }
    const hiddenRow = { ...score('complete', hiddenEval), value: 0.1, runId: 'hidden' }
    const legacyRow: FileScore = {
      model: 'complete',
      label: 'legacy',
      framework: 'Next.js',
      category: 'Auth',
      value: 0.2,
    }
    const mcpOnly = score('complete', hiddenOnlyEval, ' (MCP)')
    const mcpOnlyPath: FileScore = {
      model: 'complete',
      label: 'path (MCP)',
      framework: 'Next.js',
      category: 'Upgrades',
      evaluationPath: hiddenOnlyEval.path,
      value: 0.1,
    }
    const mcpOnlyLegacy: FileScore = {
      model: 'complete',
      label: 'legacy (MCP)',
      framework: 'Next.js',
      category: 'Upgrades',
      value: 0.1,
    }
    const unknownHidden: FileScore = {
      model: 'complete',
      label: 'old',
      framework: 'Next.js',
      category: 'Auth',
      evalKey: 'evals/example/old',
      value: 0.1,
    }
    const selected = selectCompleteModels(
      [publicRow, hiddenRow, legacyRow, unknownHidden],
      [publicRow, hiddenRow, legacyRow, unknownHidden, mcpOnly, mcpOnlyPath, mcpOnlyLegacy],
      [publicRow, hiddenRow, legacyRow, unknownHidden],
      [publicEval, hiddenEval, hiddenOnlyEval],
    )

    expect(selected.includedModels).toEqual(['complete'])
    for (const rows of [selected.baseline, selected.mcp, selected.skills]) {
      expect(rows).toEqual([publicRow])
    }
    const merged = mergeScores(selected.baseline, selected.mcp, selected.skills)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      category: 'Auth',
      value: 0.8,
      mcpScore: 0.8,
      skillsScore: 0.8,
      provenance: { evalKeys: [publicEval.path], baseRunIds: ['public'] },
    })
    expect(JSON.stringify(merged)).not.toContain('hidden')
    expect(JSON.stringify(merged)).not.toContain('Upgrades')
  })

  test('a missing published cell still blocks a model', () => {
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Auth',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const publicRows = evaluations.map((evaluation) => score('partial', evaluation))
    const hiddenRow = score('partial', hiddenEval)
    const selected = selectCompleteModels(
      [...publicRows, hiddenRow],
      [...publicRows, hiddenRow],
      [publicRows[0]!, hiddenRow],
      [...evaluations, hiddenEval],
    )

    expect(selected.includedModels).toEqual([])
    expect(selected.excludedModels).toEqual([
      { model: 'partial', baseline: 2, mcp: 2, skills: 1, expected: 2 },
    ])
  })

  test('resolves exact identity before category or conflicting path', () => {
    const publicEval = evaluations[0]!
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Auth',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const publicRow = {
      ...score('complete', publicEval),
      category: 'Upgrades' as const,
      evaluationPath: hiddenEval.path,
    }
    const hiddenRow = { ...score('complete', hiddenEval), category: 'Upgrades' as const }
    const selected = selectCompleteModels(
      [publicRow, hiddenRow],
      [publicRow, hiddenRow],
      [publicRow, hiddenRow],
      [publicEval, hiddenEval],
    )

    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.baseline).toEqual([publicRow])
    expect(selected.mcp).toEqual([publicRow])
    expect(selected.skills).toEqual([publicRow])
  })

  test('resolves a unique legacy path but closes an ambiguous excluded bucket', () => {
    const publicEval: Evaluation = {
      framework: 'Next.js',
      category: 'Add Auth',
      path: 'evals/example/shared',
      variant: 'public',
    }
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Add Auth',
      path: 'evals/example/shared',
      variant: 'hidden',
      publishToLlmLeaderboard: false,
    }
    const exactPublic = score('complete', publicEval)
    const ambiguous: FileScore = {
      model: 'complete',
      label: 'ambiguous',
      framework: 'Next.js',
      category: 'Add Auth',
      evaluationPath: publicEval.path,
      value: 0.1,
    }
    const selected = selectCompleteModels(
      [exactPublic, ambiguous],
      [exactPublic, ambiguous],
      [exactPublic, ambiguous],
      [publicEval, hiddenEval],
    )
    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.baseline).toEqual([exactPublic])

    const unique = selectCompleteModels([ambiguous], [ambiguous], [ambiguous], [publicEval])
    expect(unique.includedModels).toEqual(['complete'])
    expect(unique.baseline).toEqual([ambiguous])
  })

  test('keeps unknown rows in unaffected buckets and selects nothing from an empty registry', () => {
    const publicEval = evaluations[0]!
    const known = score('complete', publicEval)
    const unknown: FileScore = {
      model: 'complete',
      label: 'old',
      framework: 'iOS',
      category: 'Quickstarts',
      evalKey: 'evals/old',
      value: 0.4,
    }
    const categoryOnly: FileScore = {
      model: 'complete',
      label: 'legacy',
      framework: 'React',
      category: 'Auth',
      value: 0.5,
    }
    const hiddenOnly: Evaluation = {
      framework: 'Next.js',
      category: 'Upgrades',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const hiddenRow = score('hidden-only', hiddenOnly)
    const selected = selectCompleteModels(
      [known, unknown, categoryOnly, hiddenRow],
      [known, unknown, categoryOnly, hiddenRow],
      [known, unknown, categoryOnly, hiddenRow],
      [publicEval, hiddenOnly],
    )
    expect(selected.includedModels).toEqual(['complete'])
    expect(selected.baseline).toEqual([known, unknown, categoryOnly])
    expect(selected.excludedModels).toEqual([])
    expect(selectCompleteModels([known], [known], [known], [])).toEqual({
      baseline: [],
      mcp: [],
      skills: [],
      includedModels: [],
      excludedModels: [],
    })
    expect(selectCompleteModels([hiddenRow], [hiddenRow], [hiddenRow], [hiddenOnly])).toEqual({
      baseline: [],
      mcp: [],
      skills: [],
      includedModels: [],
      excludedModels: [],
    })
  })

  test('selection is repeatable and leaves inputs unchanged', () => {
    const publicEval = evaluations[0]!
    const hiddenEval: Evaluation = {
      framework: 'Next.js',
      category: 'Auth',
      path: 'evals/example/internal',
      publishToLlmLeaderboard: false,
    }
    const rows = Object.freeze([score('complete', publicEval), score('complete', hiddenEval)])
    const registry = Object.freeze([publicEval, hiddenEval])
    const original = JSON.stringify({ rows, registry })
    const first = selectCompleteModels(rows, rows, rows, registry)
    const second = selectCompleteModels(rows, rows, rows, registry)

    expect(first).toEqual(second)
    expect(first.baseline).toEqual([rows[0]!])
    expect(JSON.stringify({ rows, registry })).toBe(original)
  })
})
