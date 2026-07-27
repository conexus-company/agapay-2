import { parseJsonBody, resilientFetch, type ApiResult } from '@/lib/api-result';

type EmessageConfig = {
  baseUrl: string;
  apiToken: string;
};

export function getEmessageConfig(): EmessageConfig | null {
  const baseUrl = process.env.EMESSAGE_BASE_URL;
  const apiToken = process.env.EMESSAGE_ACCESS_TOKEN;

  if (!baseUrl || !apiToken) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiToken };
}

export async function sendSms(config: EmessageConfig, number: string, message: string): Promise<ApiResult<unknown>> {
  console.log('[emessage] sending SMS');

  let response: Response;
  try {
    response = await resilientFetch(
      `${config.baseUrl}/messaging/v1/sms/push`,
      {
        method: 'POST',
        headers: { 'X-EMESSAGE-Auth': config.apiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message }),
      },
      'emessage:sms'
    );
  } catch (error) {
    console.error('[emessage] sms network failure:', error);
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);
  console.log('[emessage] sms response:', response.status);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: body };
}
