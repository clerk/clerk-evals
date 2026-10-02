/** Only the agent runners' structured command events can satisfy this check. */
export async function ranClerkInit(
  _response: string,
  context?: { executedCommands?: readonly string[] },
): Promise<boolean> {
  return (context?.executedCommands ?? []).some((command) =>
    /\bnpx\s+(?:-y\s+)?clerk@latest\s+init\b/.test(command),
  )
}
