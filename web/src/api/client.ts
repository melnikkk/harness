export const API_BASE = `http://${location.hostname}:8787/api`;

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server');
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;

    throw new Error(errorBody?.error ?? `Request failed (${response.status})`);
  }

  return (await response.json().catch(() => null)) as T;
}
