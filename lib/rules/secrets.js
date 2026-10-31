/**
 * Rule: Secrets & Credentials Scanner
 * Flags leaked API keys, tokens, private keys, database strings, etc.
 */

const SECRET_PATTERNS = [
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Rotate key immediately and use environment variables or AWS Secrets Manager.'
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key Assignment',
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']([A-Za-z0-9\/+=]{40})["']/gi,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Remove AWS secret key and use AWS IAM Roles or Vault.'
  },
  {
    id: 'github-token',
    name: 'GitHub Personal Access Token',
    regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{20,40}|ghs_[a-zA-Z0-9]{20,40})/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Revoke token on GitHub and store in secret management.'
  },
  {
    id: 'stripe-secret-key',
    name: 'Stripe Live Secret Key',
    regex: /(?:sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,})/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Invalidate live Stripe API key and set in runtime environment.'
  },
  {
    id: 'slack-token',
    name: 'Slack Token or Webhook',
    regex: /(?:xox[baprs]-[0-9a-zA-Z]{10,48}|https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+)/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Regenerate Slack webhook or bot token.'
  },
  {
    id: 'private-key',
    name: 'Private Encryption Key (RSA/EC/OpenSSH)',
    regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY[^-]*-----/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Never commit private keys to version control. Add to .gitignore.'
  },
  {
    id: 'jwt-token',
    name: 'Hardcoded JSON Web Token (JWT)',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'WARN',
    category: 'Security',
    recommendation: 'Ensure this is not a production or long-lived authentication token.'
  },
  {
    id: 'generic-api-key',
    name: 'Hardcoded API Key / Secret Variable',
    regex: /(?:api_key|apikey|secret_key|client_secret|auth_token|access_token|private_key)\s*[:=]\s*["']([a-zA-Z0-9_\-\.]{18,})["']/gi,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Extract credential into environment variable.'
  },
  {
    id: 'db-connection-string',
    name: 'Database URI with Credentials',
    regex: /(?:postgres|mysql|mongodb|redis|mariadb):\/\/[^:]+:[^@\s]+@[a-zA-Z0-9\.-]+(?::[0-9]+)?\/[^\s"']+/gi,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Use DATABASE_URL environment variable without embedding cleartext passwords.'
  },
  {
    id: 'google-api-key',
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z\\-_]{35}/g,
    severity: 'ERROR',
    category: 'Security',
    recommendation: 'Restrict this key in Google Cloud Console and load dynamically.'
  }
];

const SAFE_PLACEHOLDERS = [
  'example', 'placeholder', 'dummy', 'xxxx', 'your_', 'test_', 'my_secret',
  'fake', 'replace_me', 'changeme', '0000000', '12345678', 'user:pass', 'user:password'
];

function isSafeMatch(matchedText) {
  const lower = matchedText.toLowerCase();
  return SAFE_PLACEHOLDERS.some(p => lower.includes(p));
}

function maskSecret(str) {
  if (str.length <= 8) return '********';
  return str.slice(0, 4) + '...' + str.slice(-4);
}

export function scanForSecrets(filePath, content, customPatterns = []) {
  const findings = [];
  const lines = content.split('\n');
  const allPatterns = [...SECRET_PATTERNS, ...customPatterns];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    for (const pattern of allPatterns) {
      pattern.regex.lastIndex = 0;
      let match;

      while ((match = pattern.regex.exec(line)) !== null) {
        const fullMatch = match[0];
        const secretVal = match[1] || fullMatch;

        if (isSafeMatch(secretVal)) continue;

        findings.push({
          ruleId: `secrets/${pattern.id}`,
          category: 'Security',
          severity: pattern.severity,
          title: pattern.name,
          filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          snippet: line.trim(),
          highlight: maskSecret(secretVal),
          recommendation: pattern.recommendation,
          autoFixable: false
        });
      }
    }
  }

  return findings;
}
