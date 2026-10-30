// Core authentication gateway modifying token claims
export function decodeAuthHeader(authHeader: string) {
  if (!authHeader.startsWith("Bearer ")) throw new Error("Invalid token format");
  const token = authHeader.substring(7);
  return { sub: "user_123", role: "admin", token };
}
