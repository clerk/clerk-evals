const CLERK_INIT = /\bnpx\s+(?:-y\s+)?clerk@latest\s+init\b/

/**
 * Agent runs pass the commands their structured tool events observed, so prose never counts there.
 * The text runner has no command channel, so its response has to give the command.
 */
export async function ranClerkInit(
  response: string,
  context?: { executedCommands?: readonly string[] },
): Promise<boolean> {
  const commands = context?.executedCommands
  return commands ? commands.some((command) => CLERK_INIT.test(command)) : CLERK_INIT.test(response)
}
