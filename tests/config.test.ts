import { test } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword } from '../src/config.js';

test('password hashing and verification', async () => {
  const password = 'test-password-123';
  const hash = await hashPassword(password);

  assert.ok(hash.includes(':'), 'Hash should contain salt separator');

  const isValid = await verifyPassword(password, hash);
  assert.strictEqual(isValid, true, 'Password should verify correctly');

  const isInvalid = await verifyPassword('wrong-password', hash);
  assert.strictEqual(isInvalid, false, 'Wrong password should not verify');
});

test('password hash format', async () => {
  const password = 'secure-password-456';
  const hash = await hashPassword(password);

  const [salt, key] = hash.split(':');
  assert.ok(salt, 'Salt should exist');
  assert.ok(key, 'Key should exist');
  assert.strictEqual(salt.length, 32, 'Salt should be 32 characters (16 bytes hex)');
  assert.strictEqual(key.length, 128, 'Key should be 128 characters (64 bytes hex)');
});

test('different passwords produce different hashes', async () => {
  const password1 = 'password-one';
  const password2 = 'password-two';

  const hash1 = await hashPassword(password1);
  const hash2 = await hashPassword(password2);

  assert.notStrictEqual(hash1, hash2, 'Different passwords should produce different hashes');
});

test('same password produces different hashes', async () => {
  const password = 'same-password';

  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(password);

  assert.notStrictEqual(hash1, hash2, 'Same password with different salt should produce different hash');

  // But both should verify correctly
  assert.ok(await verifyPassword(password, hash1));
  assert.ok(await verifyPassword(password, hash2));
});

test('verify password with invalid hash format', async () => {
  const password = 'test-password';
  const invalidHash = 'invalid-hash';

  const result = await verifyPassword(password, invalidHash);
  assert.strictEqual(result, false, 'Invalid hash format should return false');
});
