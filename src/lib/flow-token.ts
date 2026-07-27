const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type FlowPayload = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string;
  livenessToken: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64url: string): Uint8Array {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey | null> {
  const secret = process.env.FLOW_TOKEN_SECRET;
  if (!secret) {
    return null;
  }
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function encodeFlowToken(payload: FlowPayload): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) {
    return null;
  }

  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const signatureB64 = toBase64Url(new Uint8Array(signature));

  return `${payloadB64}.${signatureB64}`;
}

export async function decodeFlowToken(token: string): Promise<FlowPayload | null> {
  const key = await getSigningKey();
  if (!key) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64, signatureB64] = parts;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64Url(signatureB64);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes as BufferSource, encoder.encode(payloadB64));
  if (!valid) {
    return null;
  }

  try {
    const json = decoder.decode(fromBase64Url(payloadB64));
    return JSON.parse(json) as FlowPayload;
  } catch {
    return null;
  }
}
