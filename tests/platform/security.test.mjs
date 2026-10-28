import { describe, test, expect } from '@jest/globals';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { issueServiceToken, verifyServiceToken, passwordHash, passwordMatches } from '../../dist/platform/security.js';
import { requireWrite } from '../../dist/platform/contracts.js';
const keys = generateKeyPairSync('ed25519');
const context = { tenantId: randomUUID(), subjectId: randomUUID(), correlationId: randomUUID(), role: 'owner' };
const config = { service: 'gateway', signingKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), services: { gateway: { publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } } };
describe('platform trust boundary', () => {
  test('preserves the trusted tenant context and checks audience', () => {
    const token = issueServiceToken(config, 'gateway', 'execution', context);
    expect(verifyServiceToken(config, 'execution', token, ['gateway'])).toEqual(context);
    expect(() => verifyServiceToken(config, 'projects', token, ['gateway'])).toThrow();
  });
  test('rejects a signed issuer outside the receiver allowlist', () => {
    expect(() => verifyServiceToken(config, 'execution', issueServiceToken(config, 'gateway', 'execution', context), ['telemetry'])).toThrow();
  });
  test('rejects a modified tenant and an invalid signature', () => {
    const token = issueServiceToken(config, 'gateway', 'execution', context);
    const [body, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    claims.context.tenantId = randomUUID();
    expect(() => verifyServiceToken(config, 'execution', `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`, ['gateway'])).toThrow();
    expect(() => verifyServiceToken(config, 'execution', `${body}.AA`, ['gateway'])).toThrow();
  });
  test('cannot use another service identity', () => expect(() => issueServiceToken(config, 'identity', 'execution', context)).toThrow());
  test('blocks writes from viewers', () => { expect(() => requireWrite({ ...context, role: 'viewer' })).toThrow(); expect(() => requireWrite(context)).not.toThrow(); });
  test('stores a salted password derivative and rejects a wrong password', async () => {
    const hash = await passwordHash('a-long-test-password');
    expect(hash).not.toContain('a-long-test-password');
    expect(await passwordMatches('a-long-test-password', hash)).toBe(true);
    expect(await passwordMatches('another-password', hash)).toBe(false);
  });
});
