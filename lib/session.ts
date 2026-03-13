import crypto from "crypto";

export type Session = {
  workspaceId: string;
  email: string;
  createdAt: string;
  exp: number;
};

const SECRET = process.env.SESSION_SECRET || "unitech-dev-secret";

const base64urlEncode = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

const base64urlDecode = (value: string) =>
  Buffer.from(value, "base64url").toString("utf-8");

const sign = (payload: string) =>
  base64urlEncode(crypto.createHmac("sha256", SECRET).update(payload).digest());

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const createSessionToken = ({
  workspaceId,
  email,
  ttlDays = 7
}: {
  workspaceId: string;
  email: string;
  ttlDays?: number;
}) => {
  const createdAt = new Date().toISOString();
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const payload: Session = { workspaceId, email, createdAt, exp };
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

export const verifySessionToken = (token: string): Session | null => {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;
  const expected = sign(payloadEncoded);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(payloadEncoded)) as Session;
    if (!payload?.workspaceId || !payload?.email) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader: string) => {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((pair) => {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (!rawKey) return;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  });
  return cookies;
};

export const getSessionFromRequest = (request: Request) => {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["uc_session"];
  if (!token) return null;
  return verifySessionToken(token);
};
