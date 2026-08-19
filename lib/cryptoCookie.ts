import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY || 'multichat_secure_encryption_key_32bytes!!';
const IV_LENGTH = 16;

// Set to false during testing phase as requested by user
const DISABLE_ENCRYPTION_FOR_TESTING = true;

/**
 * Encrypts sensitive cookie string using AES-256-CBC before saving to Supabase.
 */
export function encryptCookie(text?: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;

  // Plain text during testing phase
  if (DISABLE_ENCRYPTION_FOR_TESTING) {
    return text;
  }

  // If already encrypted in iv:encrypted format, return as is
  if (text.includes(':') && text.length > 64 && !text.includes('=')) return text;

  try {
    const keyBuffer = Buffer.alloc(32, 0);
    keyBuffer.write(ENCRYPTION_KEY, 'utf-8');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[CryptoCookie] Encryption error:', err);
    return text;
  }
}

/**
 * Decrypts encrypted cookie string retrieved from Supabase.
 */
export function decryptCookie(text?: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;
  // If it's a plain HTTP cookie string (contains '='), return as-is immediately!
  if (text.includes('=') || !text.includes(':') || DISABLE_ENCRYPTION_FOR_TESTING) return text;

  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    // Ensure parts[0] is a valid 32-character hex IV (16 bytes)
    if (parts[0].length !== 32 || /[^a-f0-9]/i.test(parts[0])) return text;

    const keyBuffer = Buffer.alloc(32, 0);
    keyBuffer.write(ENCRYPTION_KEY, 'utf-8');

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[CryptoCookie] Decryption error:', err);
    return text;
  }
}
