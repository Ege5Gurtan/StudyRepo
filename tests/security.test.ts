import { describe, expect, it } from 'vitest';
import { isSensitivePath, redactSecrets } from '../electron/security';

describe('secret safety', () => {
  it('rejects sensitive paths across operating systems', () => {
    for (const filename of [
      '.env', 'src/.env.local', 'src\\.env.production',
      '.ssh/id_ed25519', 'secrets/api.ts', 'credentials/token.json',
      'keys/server.pem', 'certs/client.p12', '.npmrc', 'config/service-account.json',
      '.config/gcloud/application_default_credentials.json'
    ]) expect(isSensitivePath(filename)).toBe(true);
  });

  it('allows ordinary project code and documentation', () => {
    for (const filename of ['src/keyboard.ts', 'src/tokenizer.ts', 'src/main.cpp', 'README.md']) {
      expect(isSensitivePath(filename)).toBe(false);
    }
  });

  it('redacts recognizable credential formats, assignments, and private keys', () => {
    const key = 'sk-proj-' + 'a'.repeat(35);
    const token = 'ghp_' + 'b'.repeat(36);
    const input = [
      'const x = "hello";',
      'OPENAI_API_KEY=' + key,
      'GITHUB_TOKEN=' + token,
      'Authorization: Bearer 1234567890abcdef123456',
      '-----BEGIN PRIVATE KEY-----',
      'abc123',
      '-----END PRIVATE KEY-----'
    ].join('\n');
    const clean = redactSecrets(input);
    expect(clean).toContain('const x = "hello";');
    expect(clean).not.toContain(key);
    expect(clean).not.toContain(token);
    expect(clean).not.toContain('1234567890abcdef123456');
    expect(clean).not.toContain('abc123');
    expect(clean).toContain('[REDACTED');
  });
});
