import { parseJsonBody } from '@/lib/api-result';
import { normalizeRecommendations } from '@/lib/ai/recommendation';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!description) {
    return Response.json({ error: 'description is required' }, { status: 400 });
  }

  const accessCode = process.env.EGOV_AI_ACCESS_CODE;

  if (!accessCode) {
    const fallback = normalizeRecommendations({
      recommendations: [
        {
          service: 'General Consultation',
          reason: 'Based on your description, this is a common next step. A doctor can evaluate your symptoms.',
          action: 'find_facilities',
        },
        {
          service: 'Telemedicine',
          reason: 'You may be able to consult a doctor remotely for mild symptoms.',
          action: 'find_facilities',
        },
      ],
    });
    return Response.json({ recommendations: fallback });
  }

  let response: Response;
  try {
    response = await fetch('https://hackathon-ai.e.gov.ph/api/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-code': accessCode,
        'User-Agent': 'agapay-backend/1.0',
      },
      body: JSON.stringify({ description }),
    });
  } catch {
    return Response.json(
      { error: 'ai_service_unavailable', retryable: true },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return Response.json(
      { error: 'ai_recommendation_failed' },
      { status: 502 }
    );
  }

  const upstreamBody = await parseJsonBody(response);
  const normalized = normalizeRecommendations(upstreamBody);

  return Response.json({ recommendations: normalized });
}
