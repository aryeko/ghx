export function membershipResponse(url: string, stack: { number: number } | null = null) {
  return { data: { repository: { pullRequest: { url, stack } } }, errors: undefined }
}

export function cliMembershipResponse(url: string, stack: { number: number } | null = null) {
  return { exitCode: 0, stderr: "", stdout: JSON.stringify(membershipResponse(url, stack)) }
}
