export const AI_API_BASE_URL =
  (import.meta.env.VITE_AI_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

export function aiUrl(path: string) {
  return `${AI_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function postJSON<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(aiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}