import type { ClientResource } from '@clerk/types'

export function getOtherSessionIds(client: ClientResource, currentSessionId: string): string[] {
  return client.activeSessions
    .filter((session) => session.id !== currentSessionId)
    .map((session) => session.id)
}
