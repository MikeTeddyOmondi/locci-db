import { test, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/config.js';

test('password hashing and verification', async () => {
  const password = 'test-password-123';
  const hash = await hashPassword(password);

  expect(hash).toContain(':');

  const isValid = await verifyPassword(password, hash);
  expect(isValid).toBe(true);

  const isInvalid = await verifyPassword('wrong-password', hash);
  expect(isInvalid).toBe(false);
});

test('password hash format', async () => {
  const password = 'secure-password-456';
  const hash = await hashPassword(password);

  const [salt, key] = hash.split(':');
  expect(salt).toBeTruthy();
  expect(key).toBeTruthy();
  expect(salt).toHaveLength(32); // 16 bytes hex
  expect(key).toHaveLength(128); // 64 bytes hex
});

test('different passwords produce different hashes', async () => {
  const password1 = 'password-one';
  const password2 = 'password-two';

  const hash1 = await hashPassword(password1);
  const hash2 = await hashPassword(password2);

  expect(hash1).not.toBe(hash2);
});

test('same password produces different hashes', async () => {
  const password = 'same-password';

  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(password);

  expect(hash1).not.toBe(hash2);

  // But both should verify correctly
  expect(await verifyPassword(password, hash1)).toBe(true);
  expect(await verifyPassword(password, hash2)).toBe(true);
});

test('verify password with invalid hash format', async () => {
  const password = 'test-password';
  const invalidHash = 'invalid-hash';

  const result = await verifyPassword(password, invalidHash);
  expect(result).toBe(false);
});
