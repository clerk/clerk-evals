import { describe, expect, test } from 'bun:test'
import {
  getAllModels,
  getDefaultModels,
  getModelEligibility,
  getModelInfo,
  MODEL_CUTOFF_DAYS,
} from './models'

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
