// Native XOR and Base64URL encoder/decoder matching AkkiStudyX Web Shield v4
const SHIELD_KEY = 'ns-v4-shield-9f2a';
const KEY_BYTES = new TextEncoder().encode(SHIELD_KEY);

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function base64Encode(input: string): string {
  let str = input;
  let output = '';
  for (
    let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    }
    block = (block << 8) | charCode;
  }
  return output;
}

export function base64Decode(input: string): string {
  let str = (input || '').replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

export function encodePayload(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    const encoded = new TextEncoder().encode(jsonStr);
    const xorBytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) {
      xorBytes[i] = encoded[i] ^ KEY_BYTES[i % KEY_BYTES.length];
    }
    let binary = '';
    for (let i = 0; i < xorBytes.length; i++) {
      binary += String.fromCharCode(xorBytes[i]);
    }
    const b64 = typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : base64Encode(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    console.error('encodePayload error:', err);
    return '';
  }
}

export function decodePayload(input: any): any {
  if (!input) return null;

  // Unpack payload property if response is wrapped in an object { payload: "..." }
  let payloadStr: string = '';
  if (typeof input === 'string') {
    payloadStr = input;
  } else if (typeof input === 'object') {
    if (typeof input.payload === 'string' && input.payload.length > 0) {
      payloadStr = input.payload;
    } else if (typeof input.data === 'string' && input.data.length > 0) {
      payloadStr = input.data;
    } else {
      // Already plain JSON object or array
      return input;
    }
  } else {
    return null;
  }

  try {
    let b64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const binary = typeof globalThis.atob === 'function' ? globalThis.atob(b64) : base64Decode(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 1. First attempt: Direct UTF-8 decode
    try {
      const direct = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(direct);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}

    // 2. Second attempt: XOR shield decode
    const xorBytes = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      xorBytes[i] = bytes[i] ^ KEY_BYTES[i % KEY_BYTES.length];
    }
    const xorText = new TextDecoder().decode(xorBytes);
    return JSON.parse(xorText);
  } catch (e) {
    console.error('decodePayload error:', e);
    return null;
  }
}
