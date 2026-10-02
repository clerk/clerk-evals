import { getGitCommit } from '@/src/eval-identity'

export type SourceVersions = {
  skillsCommit?: string
  cliVersion?: string
}

/** The installed Skills checkout must be the same revision used for the prompt and metadata. */
export function resolveSourceVersions(args: {
  skillsEnabled: boolean
  skillsPath: string
  requestedSkillsSha?: string
  cliVersion?: string
  readCommit?: (path: string) => string | undefined
}): SourceVersions {
  const { skillsEnabled, skillsPath, requestedSkillsSha, cliVersion } = args
  if (requestedSkillsSha && !/^[0-9a-f]{40}$/.test(requestedSkillsSha)) {
    throw new Error('CLERK_SKILLS_SHA must be a full 40-character commit SHA')
  }

  const checkoutSha = skillsEnabled ? (args.readCommit ?? getGitCommit)(skillsPath) : undefined
  if (skillsEnabled && !checkoutSha) {
    throw new Error(`Skills checkout is missing or is not a Git repository: ${skillsPath}`)
  }
  if (skillsEnabled && requestedSkillsSha && checkoutSha !== requestedSkillsSha) {
    throw new Error(
      `Skills checkout ${checkoutSha} does not match CLERK_SKILLS_SHA ${requestedSkillsSha}`,
    )
  }

  return {
    skillsCommit: requestedSkillsSha ?? checkoutSha,
    cliVersion,
  }
}
