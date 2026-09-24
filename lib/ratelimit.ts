/**
 * Batas chat per pengguna per hari.
 * - Kalau UPSTASH_REDIS_REST_URL & TOKEN diisi: disimpan di Upstash Redis (permanen, gratis).
 * - Kalau tidak: disimpan di memori server (bisa ter-reset saat Vercel restart).
 */
const memory = new Map<string, number>();

export async function consumeChatQuota(
  userKey: string
): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = Number(process.env.CHAT_DAILY_LIMIT || 30);
  const day = new Date().toISOString().slice(0, 10);
  const key = `chat:${userKey}:${day}`;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  let used: number;
  if (url && token) {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, 60 * 60 * 26],
      ]),
      cache: "no-store",
    });
    const data = await res.json();
    used = Number(data?.[0]?.result ?? 0);
  } else {
    used = (memory.get(key) || 0) + 1;
    memory.set(key, used);
    if (memory.size > 5000) memory.clear();
  }
  return { ok: used <= limit, used, limit };
}
