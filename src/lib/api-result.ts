export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'upstream_error'; status: number; body: unknown }
  | { ok: false; kind: 'network_error' }
  | { ok: false; kind: 'invalid_response'; message: string };

export async function parseJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
