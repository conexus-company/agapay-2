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

const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRY_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 750;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with a hard timeout and a couple of short retries. The sandbox
 * upstream APIs occasionally either drop the connection outright (fetch()
 * throws) or hang with no response at all — without a timeout, the second
 * case shows up as the UI spinning forever with no error and no log line.
 */
export async function resilientFetch(url: string, init: RequestInit = {}, label: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if (attempt > 0) {
        console.log(`[${label}] succeeded on retry ${attempt}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const reason = controller.signal.aborted ? `timed out after ${FETCH_TIMEOUT_MS}ms` : String(error);
      console.warn(`[${label}] attempt ${attempt + 1}/${FETCH_RETRY_ATTEMPTS + 1} failed: ${reason}`);
      if (attempt < FETCH_RETRY_ATTEMPTS) {
        await delay(FETCH_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}
