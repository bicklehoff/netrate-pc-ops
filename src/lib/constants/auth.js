/**
 * Auth flow constants — canonical source for magic link expiry, SMS OTP
 * length, attempt limits, lockout windows. Used by both the display copy
 * on auth pages AND the API routes that enforce these limits. Single
 * source prevents display drift from implementation.
 *
 * Consolidated from D8 Pass 5 findings BP-5 and BP-6. Survives D9 Layer 1
 * (auth layer is orthogonal to the Contact/Deal schema redesign).
 *
 * **When changing any value here, verify that the corresponding API route
 * uses the same constant** — the display copy on the auth pages tells
 * borrowers what to expect, and it must match the server-side enforcement.
 */

// Magic-link email token — the one delivered from /api/portal/auth/send-link
export const MAGIC_LINK_EXPIRY_MINUTES = 15;

// SMS verification code — /api/portal/auth/send-code
export const SMS_CODE_EXPIRY_MINUTES = 10;
export const SMS_OTP_LENGTH = 6;

// SMS code attempt enforcement — /api/portal/auth/verify-code
export const SMS_ATTEMPT_LIMIT = 3;
export const SMS_LOCKOUT_MINUTES = 15;
