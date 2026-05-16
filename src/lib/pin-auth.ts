const storageKey = (sessionId: string) => `pokerbook_auth_${sessionId}`;

export function getStoredPin(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(storageKey(sessionId));
  } catch {
    return null;
  }
}

export function storePin(sessionId: string, pin: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(sessionId), pin);
  } catch {
    // localStorage not available
  }
}
