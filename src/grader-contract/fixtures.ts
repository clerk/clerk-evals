import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import type { Graders } from '@/src/graders'
import type { GraderContractCase } from './types'
import { GraderContractError } from './runtime'

type FixtureData = {
  fail?: unknown
}

function readFailList(data: FixtureData, fixtureName: string): string[] {
  if (data.fail === undefined) return []
  if (!Array.isArray(data.fail) || data.fail.some((name) => typeof name !== 'string')) {
    throw new GraderContractError(`${fixtureName} must define fail as a list of grader names`)
  }

  const names = data.fail as string[]
  if (new Set(names).size !== names.length) {
    throw new GraderContractError(`${fixtureName} contains duplicate grader names in fail`)
  }
  return names
}

export function parseContractFixture(
  raw: string,
  fixtureName: string,
  graders: Graders,
  accepted: boolean,
): GraderContractCase {
  const { content, data } = matter(raw)
  const fail = readFailList(data as FixtureData, fixtureName)
  const graderNames = Object.keys(graders)
  const unknownNames = fail.filter((name) => !(name in graders))

  if (accepted && fail.length > 0) {
    throw new GraderContractError(`${fixtureName} is accepted and cannot define failing graders`)
  }
  if (!accepted && fail.length === 0) {
    throw new GraderContractError(`${fixtureName} is rejected and must define failing graders`)
  }
  if (unknownNames.length > 0) {
    throw new GraderContractError(
      `${fixtureName} refers to unknown graders: ${unknownNames.join(', ')}`,
    )
  }
  if (content.trim().length === 0) {
    throw new GraderContractError(`${fixtureName} has no grader input`)
  }

  return {
    name: fixtureName,
    input: content.trim(),
    expected: Object.fromEntries(
      graderNames.map((name) => [name, accepted || !fail.includes(name)]),
    ),
  }
}

async function loadFixtureGroup(
  root: string,
  group: 'accepted' | 'rejected',
  graders: Graders,
): Promise<GraderContractCase[]> {
  const directory = path.join(root, group)
  let names: string[]
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.md')).sort()
  } catch {
    throw new GraderContractError(`Missing grader contract directory: ${directory}`)
  }

  return Promise.all(
    names.map(async (name) => {
      const raw = await readFile(path.join(directory, name), 'utf8')
      return parseContractFixture(raw, `${group}/${name}`, graders, group === 'accepted')
    }),
  )
}

export async function loadGraderContractCases(
  evalPath: string,
  graders: Graders,
): Promise<GraderContractCase[]> {
  const root = path.join(evalPath, 'grader-contract')
  const accepted = await loadFixtureGroup(root, 'accepted', graders)
  const rejected = await loadFixtureGroup(root, 'rejected', graders)
  return [...accepted, ...rejected]
}
