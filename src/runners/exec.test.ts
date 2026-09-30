import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { getModel } from '@/src/providers'
import exec from './exec'
import * as shared from './shared'

afterEach(() => {
  mock.restore()
})

test('returns the upstream stream error when the SDK rejects its output promises', async () => {
  const upstreamError = new Error('Gateway request failed')
  const languageModel = getModel('openai', 'gpt-6-sol')
  if (!languageModel) throw new Error('Test model is missing from the catalog')

  spyOn(languageModel, 'doStream').mockRejectedValue(upstreamError)
  spyOn(shared, 'resolveModel').mockReturnValue(languageModel)

  const result = await exec({
    provider: 'openai',
    model: 'gpt-6-sol',
    evalPath: new URL('../evals/auth/protect', import.meta.url).pathname,
    maxRetries: 0,
  })

  expect(result.ok).toBe(false)
  expect(result.error).toBe(upstreamError)
})
