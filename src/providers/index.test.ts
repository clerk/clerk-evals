import { describe, expect, test } from 'bun:test'
import { getModel } from './index'

describe('gateway model resolution', () => {
  test('uses the gateway model ID for a creator alias', () => {
    expect(getModel('x-ai', 'grok-4.6')?.modelId).toBe('spacexai/grok-4.6')
  })

  test('routes new creator models through Gateway', () => {
    expect(getModel('deepseek', 'deepseek-v4.1-flash')?.modelId).toBe(
      'deepseek/deepseek-v4.1-flash',
    )
    expect(getModel('zai', 'glm-5.3-flash')?.modelId).toBe('zai/glm-5.3-flash')
  })

  test('rejects model IDs outside the catalog', () => {
    expect(getModel('openai', 'not-a-model')).toBeUndefined()
  })
})
