import { triageConcern } from '@/lib/groq-triage';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const concern = body.concern;

  if (typeof concern !== 'string' || concern.trim().length === 0) {
    return Response.json({ error: 'Missing required field: concern' }, { status: 400 });
  }

  const result = await triageConcern(concern.trim());
  return Response.json(result);
}
