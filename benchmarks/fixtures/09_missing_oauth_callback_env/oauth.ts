// OAuth redirection helper
export function getOAuthRedirect() {
  const url = process.env.OAUTH_REDIRECT_URL;
  return url || "https://example.com/callback";
}
