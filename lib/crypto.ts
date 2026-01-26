import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, salt?: string) {
  const s = salt || randomUUID().replace(/-/g, "").slice(0, 16);
  const h = scryptSync(password, s, 64);
  return { salt: s, hash: h.toString("base64") };
}

export function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): boolean {
  const h = scryptSync(password, salt, 64);
  try {
    return timingSafeEqual(Buffer.from(storedHash, "base64"), h);
  } catch {
    return false;
  }
}
