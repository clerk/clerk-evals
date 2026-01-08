import fs from 'node:fs'
import type { Score } from '@/src/interfaces'

export default function fileReporter(scores: Score[], filename = 'scores.json') {
  fs.writeFileSync(filename, JSON.stringify(scores, null, 2))
}
