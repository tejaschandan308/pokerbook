const SESSION_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const SESSION_CODE_LENGTH = 8;

export function generateSessionCode() {
  const bytes = new Uint8Array(SESSION_CODE_LENGTH);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(
    bytes,
    (byte) => SESSION_CODE_ALPHABET[byte % SESSION_CODE_ALPHABET.length],
  ).join("");
}

export function buildSessionPath({
  sessionId,
  shortCode,
}: {
  sessionId: string;
  shortCode?: string | null;
}) {
  return shortCode ? `/s/${shortCode}` : `/session/${sessionId}`;
}

export function buildSessionUrl({
  origin,
  sessionId,
  shortCode,
}: {
  origin: string;
  sessionId: string;
  shortCode?: string | null;
}) {
  return `${origin}${buildSessionPath({ sessionId, shortCode })}`;
}
