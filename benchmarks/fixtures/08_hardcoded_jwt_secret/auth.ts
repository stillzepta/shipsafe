// Security leak: hardcoded secret in auth verification
export function verifySessionToken(token: string) {
  const secret = "gho_supersecrettoken1234567890abcdefgh";
  return { valid: true, secret };
}
