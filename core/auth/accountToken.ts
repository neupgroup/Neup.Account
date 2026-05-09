/**
 * Account token signing and verification.
 *
 * Each account entry in auth_acc is a signed JWT (RS256).
 *
 * Private key (app.private.key) — signs tokens on write (server-side only).
 * Public key  (app.public.key)  — verifies tokens on read (Node.js + Edge).
 *
 * Keys are loaded from the filesystem at:
 *   {project_root}/app.private.key
 *   {project_root}/app.public.key
 *
 * Falls back to unsigned base64url JSON if keys cannot be loaded
 * (e.g. Edge runtime without filesystem access — use env vars there).
 */

export type AccountTokenPayload = {
  aid: string;
  sid: string;
  skey: string;
  nid: string;
  def?: 1;      // only present on the active account
  guest?: 1;    // only present on guest accounts (nid === '')
};

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

let _privateKey: string | null = null;
let _publicKey: string | null = null;

async function loadPrivateKey(): Promise<string | null> {
  if (_privateKey !== null) return _privateKey;
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    _privateKey = readFileSync(join(process.cwd(), 'app.private.key'), 'utf8');
    return _privateKey;
  } catch {
    return null;
  }
}

async function loadPublicKey(): Promise<string | null> {
  if (_publicKey !== null) return _publicKey;
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    _publicKey = readFileSync(join(process.cwd(), 'app.public.key'), 'utf8');
    return _publicKey;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const padded2 = pad ? padded + '='.repeat(4 - pad) : padded;
  return Buffer.from(padded2, 'base64').toString('utf8');
}

// ---------------------------------------------------------------------------
// Sign — uses app.private.key
// ---------------------------------------------------------------------------

/**
 * Signs an account payload as a JWT using RS256 with app.private.key.
 * Falls back to unsigned base64url JSON if the key file is not available.
 */
export async function signAccountToken(payload: AccountTokenPayload): Promise<string> {
  const privateKey = await loadPrivateKey();

  if (!privateKey) {
    // Fallback: plain base64url JSON (dev without key files)
    return `unsigned.${base64urlEncode(JSON.stringify(payload))}.nosig`;
  }

  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Verify — uses app.public.key
// ---------------------------------------------------------------------------

/**
 * Verifies and decodes an account JWT using app.public.key.
 * Returns the payload if valid, null if invalid or tampered.
 */
export async function verifyAccountToken(token: string): Promise<AccountTokenPayload | null> {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  // Fallback unsigned token
  if (header === 'unsigned' && signature === 'nosig') {
    try {
      return JSON.parse(base64urlDecode(body)) as AccountTokenPayload;
    } catch {
      return null;
    }
  }

  const publicKey = await loadPublicKey();

  if (!publicKey) {
    // No public key — decode without verification (dev fallback)
    try {
      return JSON.parse(base64urlDecode(body)) as AccountTokenPayload;
    } catch {
      return null;
    }
  }

  try {
    const { createVerify } = await import('crypto');
    const signingInput = `${header}.${body}`;
    const verify = createVerify('RSA-SHA256');
    verify.update(signingInput);
    verify.end();
    const sigBuffer = Buffer.from(
      signature.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    );
    const valid = verify.verify(publicKey, sigBuffer);
    if (!valid) return null;

    return JSON.parse(base64urlDecode(body)) as AccountTokenPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie serialization
// ---------------------------------------------------------------------------

/**
 * Serializes an array of account tokens into the auth_acc cookie value.
 * Format: JSON array of JWT strings — ["jwt1", "jwt2", ...]
 */
export function serializeAccountTokens(tokens: string[]): string {
  return JSON.stringify(tokens);
}

/**
 * Deserializes the auth_acc cookie value into an array of JWT strings.
 */
export function deserializeAccountTokens(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(t => typeof t === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
