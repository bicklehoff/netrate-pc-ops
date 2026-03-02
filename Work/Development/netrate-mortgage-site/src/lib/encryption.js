// PII Encryption — AES-256-GCM
// Encrypts SSN and DOB at the application level before database storage.
// Each value gets a unique IV. Stored as: base64(iv):base64(ciphertext):base64(authTag)
//
// Key: 256-bit hex string in PII_ENCRYPTION_KEY env var
// Generate with: openssl rand -hex 32

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PII_ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('PII_ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns: "base64(iv):base64(ciphertext):base64(authTag)"
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt a stored encrypted string.
 * Input: "base64(iv):base64(ciphertext):base64(authTag)"
 * Returns: plaintext string
 */
export function decrypt(stored) {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:ciphertext:authTag');
  }
  const [ivB64, ciphertext, authTagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Extract last 4 digits of an SSN for display masking.
 * Input: "123-45-6789" or "123456789"
 * Returns: "6789"
 */
export function ssnLastFour(ssn) {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) {
    throw new Error('SSN must contain exactly 9 digits');
  }
  return digits.slice(-4);
}
