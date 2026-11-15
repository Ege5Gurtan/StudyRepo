import path from 'node:path';

// Apply the same restrictions to browsing, indexing, and AI retrieval.
// These checks use path components so a legitimate file such as "keyboard.ts"
// is not blocked merely because it contains "key".
const sensitiveDirectories = new Set([
  '.git', '.ssh', '.aws', '.azure', '.config/gcloud', 'secrets', 'secret',
  'credentials', 'credential', 'keys', 'private'
]);
const sensitiveNames = new Set([
  '.env', '.npmrc', '.pypirc', '.netrc', '.dockerconfigjson',
  'id_rsa', 'id_dsa', 'id_ed25519', 'id_ecdsa',
  'credentials.json', 'service-account.json', 'service_account.json',
  'google-services.json', 'google-services.plist'
]);
const sensitiveSuffix = /\.(?:pem|key|p12|pfx|jks|keystore|asc|gpg)$/i;

export function isSensitivePath(filePath: string): boolean {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.some((part, index) => {
    const lower = part.toLowerCase();
    if (lower === '.env' || lower.startsWith('.env.')) return true;
    if (sensitiveNames.has(lower) || sensitiveSuffix.test(lower)) return true;
    if (index < parts.length - 1 && sensitiveDirectories.has(lower)) return true;
    return index > 0 && parts[index - 1].toLowerCase() === '.config' && lower === 'gcloud';
  });
}

// Heuristic, defense-in-depth redaction; it cannot guarantee that every
// proprietary credential format is recognized. Do not treat as a DLP solution.
export function redactSecrets(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk-(?:proj-|svc-)?[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{15,}|gh[pousr]_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{15,}|xox[baprs]-[A-Za-z0-9-]{15,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED TOKEN]')
    .replace(/\b((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GH_TOKEN|AWS_SECRET_ACCESS_KEY|DATABASE_URL|JWT_SECRET|CLIENT_SECRET|API_KEY|ACCESS_TOKEN|SECRET_KEY|PASSWORD)\s*[:=]\s*['"]?)([^\s'",;}]+)/gi, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9_.~+/-]{12,}/gi, '$1[REDACTED]');
}
