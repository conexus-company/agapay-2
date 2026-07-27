export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'upstream_error'; status: number; body: unknown }
  | { ok: false; kind: 'network_error' }
  | { ok: false; kind: 'invalid_response'; message: string };

export async function parseJsonBody(source: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await source.json();
  } catch {
    return null;
  }
}
