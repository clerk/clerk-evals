import { defineGraders, getFileContent, type Grader, type GraderContext } from '@/src/graders'

const initPattern =
  /\b(?:npx\s+(?:-y\s+)?|pnpm\s+dlx\s+|bunx\s+|yarn\s+dlx\s+)clerk@latest\s+init\b/
const loginPattern = /\bclerk(?:@latest)?\s+auth\s+login\b/
const globalInstallPattern =
  /\b(?:npm\s+(?:install|i|add)|pnpm\s+(?:add|install)|bun\s+(?:add|install))\s+(?:-g|--global)\s+clerk(?:@\S+)?\b/

function commands(context?: GraderContext): readonly string[] {
  return context?.executedCommands ?? []
}

const ranInit: Grader = async (_artifact, context) =>
  commands(context).some((command) => initPattern.test(command))

const noLoginBeforeInit: Grader = async (_artifact, context) => {
  const executed = commands(context)
  const firstInit = executed.findIndex((command) => initPattern.test(command))
  if (firstInit < 0) return false
  return executed.slice(0, firstInit + 1).every((command) => !loginPattern.test(command))
}

const noGlobalCliInstall: Grader = async (_artifact, context) =>
  !commands(context).some((command) => globalInstallPattern.test(command))

export function nextjsGraders(version: 15 | 16 | 'empty') {
  const middlewarePath = version === 15 ? 'middleware.ts' : 'proxy.ts'
  const layoutHasProvider: Grader = async (artifact) => {
    const layout =
      getFileContent(artifact, 'app/layout.tsx') ?? getFileContent(artifact, 'src/app/layout.tsx')
    return Boolean(
      layout &&
      /<body\b[^>]*>[\s\S]*<ClerkProvider\b[\s\S]*<\/ClerkProvider>[\s\S]*<\/body>/.test(layout),
    )
  }
  const hasAuthControls: Grader = async (artifact) => {
    const workspace = artifact.split('## Final workspace').at(-1)
    return Boolean(
      workspace &&
      /<SignInButton\b/.test(workspace) &&
      /<SignUpButton\b/.test(workspace) &&
      /<UserButton\b/.test(workspace),
    )
  }
  const middlewareUsesClerk: Grader = async (artifact) => {
    const middleware =
      getFileContent(artifact, middlewarePath) ?? getFileContent(artifact, `src/${middlewarePath}`)
    return Boolean(
      middleware &&
      /from ['"]@clerk\/nextjs\/server['"]/.test(middleware) &&
      /\bclerkMiddleware\s*\(/.test(middleware),
    )
  }
  const frameworkMatchesFixture: Grader = async (artifact) => {
    const packageJson = getFileContent(artifact, 'package.json')
    if (!packageJson) return false
    try {
      const parsed = JSON.parse(packageJson) as { dependencies?: Record<string, string> }
      const next = parsed.dependencies?.next
      return Boolean(next && (version === 'empty' || new RegExp(`^[~^]?${version}\\.`).test(next)))
    } catch {
      return false
    }
  }
  const initFlags: Grader = async (_artifact, context) => {
    const init = commands(context).find((command) => initPattern.test(command))
    if (!init) return false
    if (version === 'empty') return /(?:^|\s)--framework\s+next\b/.test(init)
    return !/(?:^|\s)--(?:framework|pm|app|accountless|no-skills)\b/.test(init)
  }

  return defineGraders({
    ran_clerk_init: ranInit,
    no_login_before_init: noLoginBeforeInit,
    no_global_clerk_cli_install: noGlobalCliInstall,
    appropriate_init_flags: initFlags,
    correct_next_version: frameworkMatchesFixture,
    correct_middleware_file: middlewareUsesClerk,
    provider_inside_body: layoutHasProvider,
    visible_auth_controls: hasAuthControls,
  })
}
