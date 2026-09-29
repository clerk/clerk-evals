import { describe, expect, test } from 'bun:test'
import {
  getAllModels,
  getDefaultModels,
  getModelEligibility,
  getModelInfo,
  MODEL_CUTOFF_DAYS,
  selectModels,
} from './models'
import { estimateCost } from '@/src/runners/shared'

const NOW = new Date('2026-09-03T00:00:00.000Z')

describe('model cutoff policy', () => {
  test('includes releases on the cutoff boundary', () => {
    const model = {
      provider: 'openai' as const,
      name: 'boundary-model',
      gatewayId: 'openai/boundary-model',
      label: 'Boundary Model',
      releasedAt: '2026-06-05',
    }

    expect(getModelEligibility(model, { now: NOW, cutoffDays: MODEL_CUTOFF_DAYS })).toEqual({
      included: true,
      reason: 'recent',
      ageDays: 90,
    })
  })

  test('excludes old models unless they are marked current best', () => {
    const oldModel = getModelInfo('openai', 'gpt-5.5')!
    const currentBest = getModelInfo('google', 'gemini-3.1-pro-preview')!

    expect(getModelEligibility(oldModel, { now: NOW }).reason).toBe('past-cutoff')
    expect(getModelEligibility(currentBest, { now: NOW }).reason).toBe('current-best')
  })

  test('keeps explicit legacy models in the full catalog', () => {
    expect(getDefaultModels({ now: NOW }).some((model) => model.name === 'gpt-4o')).toBe(false)
    expect(getAllModels().some((model) => model.name === 'gpt-4o')).toBe(true)
  })

  test('includes recent Convex leaders with their gateway IDs', () => {
    const defaults = getDefaultModels({ now: NOW }).map((model) => model.name)

    expect(defaults).toContain('grok-4.6')
    expect(defaults).toContain('grok-4.5')
    expect(defaults).toContain('hy4-preview')
    expect(defaults).toContain('kimi-k3')
    expect(getModelInfo('x-ai', 'grok-4.6')?.gatewayId).toBe('spacexai/grok-4.6')
  })
})

const newModels = [
  [
    'anthropic',
    'claude-sonnet-5-5',
    'anthropic/claude-sonnet-5.5',
    '2026-09-28',
    'Claude Sonnet 5.5',
    2,
    10,
  ],
  [
    'deepseek',
    'deepseek-v4.1-flash',
    'deepseek/deepseek-v4.1-flash',
    '2026-09-08',
    'DeepSeek V4.1 Flash',
    0.3,
    1.2,
  ],
  ['zai', 'glm-5.3-flash', 'zai/glm-5.3-flash', '2026-08-26', 'GLM 5.3 Flash', 0.15, 0.5],
  [
    'anthropic',
    'claude-opus-5-5',
    'anthropic/claude-opus-5.5',
    '2026-09-22',
    'Claude Opus 5.5',
    4,
    20,
  ],
  ['openai', 'gpt-6-astra', 'openai/gpt-6-astra', '2026-09-04', 'GPT-6 Astra', 10, 50],
  ['openai', 'gpt-6-sol', 'openai/gpt-6-sol', '2026-09-22', 'GPT-6 Sol', 2, 10],
  ['openai', 'gpt-6-luna', 'openai/gpt-6-luna', '2026-09-22', 'GPT-6 Luna', 0.1, 0.5],
  ['x-ai', 'grok-4.7', 'spacexai/grok-4.7', '2026-09-21', 'Grok 4.7', 2, 6],
] as const

describe('September 2026 model refresh', () => {
  const now = new Date('2026-09-28T00:00:00.000Z')

  test.each(newModels)(
    '%s/%s has its gateway route, metadata, and rates',
    (provider, name, gatewayId, releasedAt, label, inputRate, outputRate) => {
      const entry = getAllModels().find(
        (model) => model.provider === provider && model.name === name,
      )
      expect(entry).toMatchObject({ provider, name, gatewayId, releasedAt, label })
      expect(getDefaultModels({ now }).map((model) => model.name)).toContain(name)
      expect(estimateCost(name, { promptTokens: 1_000_000, completionTokens: 0 })).toBe(inputRate)
      expect(estimateCost(name, { promptTokens: 0, completionTokens: 1_000_000 })).toBe(outputRate)
    },
  )

  test.each([
    ['openai', 'gpt-6-astra', 'gpt-5.6-sol'],
    ['anthropic', 'claude-opus-5-5', 'claude-fable-5-1'],
    ['x-ai', 'grok-4.7', 'grok-4.6'],
  ] as const)('%s current best moves to %s', (provider, current, former) => {
    const currentModel = getAllModels().find(
      (model) => model.provider === provider && model.name === current,
    )
    const formerModel = getAllModels().find(
      (model) => model.provider === provider && model.name === former,
    )
    expect(currentModel?.currentBest).toBe(true)
    expect(formerModel?.currentBest).toBeUndefined()
  })

  test('Flash additions do not have a current-best exception', () => {
    expect(getModelInfo('deepseek', 'deepseek-v4.1-flash')?.currentBest).toBeUndefined()
    expect(getModelInfo('zai', 'glm-5.3-flash')?.currentBest).toBeUndefined()
  })

  test('Sonnet 5.5 uses the age cutoff and remains available for explicit selection', () => {
    const sonnet = getModelInfo('anthropic', 'claude-sonnet-5-5')!
    const afterCutoff = new Date('2026-12-28T00:00:00.000Z')

    expect(sonnet.currentBest).toBeUndefined()
    expect(getModelEligibility(sonnet, { now }).reason).toBe('recent')
    expect(getModelEligibility(sonnet, { now: afterCutoff }).reason).toBe('past-cutoff')
    expect(getDefaultModels({ now: afterCutoff })).not.toContainEqual(sonnet)
    expect(selectModels({ model: sonnet.name, now: afterCutoff })).toEqual({
      ok: true,
      models: [sonnet],
    })
  })
})

describe('model selection', () => {
  test('keeps case-insensitive explicit names in caller order', () => {
    const result = selectModels({ models: 'GROK-4.7, gpt-6-luna,DeepSeek-V4.1-Flash' })
    expect(result.ok && result.models.map((model) => model.name)).toEqual([
      'grok-4.7',
      'gpt-6-luna',
      'deepseek-v4.1-flash',
    ])
  })

  test('explicit selection can include a legacy model', () => {
    const result = selectModels({ models: 'gpt-4o,gpt-6-astra' })
    expect(result.ok && result.models.map((model) => model.name)).toEqual(['gpt-4o', 'gpt-6-astra'])
  })

  test.each([
    [{ models: '' }, 'empty name'],
    [{ models: 'gpt-6-sol,' }, 'empty name'],
    [{ models: 'not-a-model' }, 'Unknown model'],
    [{ models: 'gpt-6-sol,GPT-6-SOL' }, 'Duplicate model'],
    [{ model: 'gpt-6-sol', models: 'gpt-6-luna' }, 'either --model or --models'],
  ])('rejects invalid selection %o', (options, error) => {
    const result = selectModels(options)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain(error)
  })

  test('preserves provider and default selection', () => {
    const now = new Date('2026-09-28T00:00:00.000Z')
    const byProvider = selectModels({ provider: 'DEEPSEEK', now })
    expect(byProvider.ok && byProvider.models.map((model) => model.name)).toEqual([
      'deepseek-v4.1-flash',
    ])
    const defaults = selectModels({ now })
    expect(defaults.ok && defaults.models).toEqual(getDefaultModels({ now }))
  })
})
