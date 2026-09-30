import { describe, expect, test } from 'bun:test'

import { formatErrorDetails } from './error'

describe('formatErrorDetails', () => {
  test('includes nested retry and gateway fields', () => {
    const gatewayError = Object.assign(new Error('Gateway timed out'), {
      name: 'GatewayResponseError',
      statusCode: 504,
      isRetryable: true,
      generationId: 'generation-123',
    })
    const retryError = Object.assign(new Error('Failed after 3 attempts'), {
      reason: 'maxRetriesExceeded',
      errors: [gatewayError],
      lastError: gatewayError,
    })

    const details = formatErrorDetails(retryError)

    expect(details).toContain('Failed after 3 attempts')
    expect(details).toContain('GatewayResponseError')
    expect(details).toContain('generation-123')
    expect(details).toContain('maxRetriesExceeded')
  })

  test('redacts sensitive nested fields and handles cycles', () => {
    const response: Record<string, unknown> = { authorization: 'Bearer private' }
    response.self = response
    const error = Object.assign(new Error('Request failed'), { response })

    const details = formatErrorDetails(error)

    expect(details).not.toContain('Bearer private')
    expect(details).toContain('[redacted]')
    expect(details).toContain('[circular]')
  })
})
