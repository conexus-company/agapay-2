import { parseJsonBody, type ApiResult } from '@/lib/api-result';
import { SPECIALTIES, type Specialty, type TriageResult } from '@/lib/health-navigation-types';

const USER_AGENT = 'agapay-backend/1.0';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const FALLBACK_RESULT: TriageResult = {
  specialty: 'General Practice',
  explanation: 'Unable to determine — please consult a general practitioner for initial assessment.',
  confidence: 0,
  is_emergency: false,
};

// Locked down: this is the only instruction the model receives about its job.
// The user's free-text concern is sent as a separate `user` message and must
// never be concatenated into this string, so it can't override these rules.
const SYSTEM_PROMPT = `You are a medical triage assistant for a citizen-facing healthcare navigation app.
Your ONLY job: given a person's described symptom/concern, recommend the single most
appropriate medical specialty/service from this fixed list:
[${SPECIALTIES.join(', ')}]

Rules:
- You do NOT know about specific hospitals, clinics, addresses, or their availability.
  Never mention a facility name — that is handled by a separate system.
- You do NOT provide medical diagnosis, treatment advice, or medication guidance.
- If the concern describes a medical emergency (chest pain, difficulty breathing,
  severe bleeding, loss of consciousness, stroke symptoms), respond with
  "Emergency/Urgent Care" and confidence 100, and flag is_emergency: true.
- Output ONLY valid JSON, no preamble, no markdown fences, matching this exact schema:

{
  "specialty": "<one value from the fixed list>",
  "explanation": "<1-2 sentence plain-language reason, matches UI card copy style>",
  "confidence": <integer 0-100>,
  "is_emergency": <boolean>
}

- Confidence reflects how clearly the symptom maps to that specialty, not medical certainty.
  Vague input (e.g. "check-up") → lower confidence (50-70).
  Specific input (e.g. "3 year old with fever") → higher confidence (85-95).`;

const JSON_ONLY_REMINDER = 'Return valid JSON only, matching the exact schema. No markdown fences, no preamble.';

type GroqConfig = {
  apiKey: string;
  model: string;
};

export function getGroqConfig(): GroqConfig | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  return { apiKey, model };
}

function isSpecialty(value: unknown): value is Specialty {
  return typeof value === 'string' && (SPECIALTIES as readonly string[]).includes(value);
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTriageContent(content: string): TriageResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (!isSpecialty(obj.specialty)) return null;
  if (typeof obj.explanation !== 'string' || obj.explanation.length === 0) return null;
  const confidence = clampConfidence(obj.confidence);
  if (confidence === null) return null;
  if (typeof obj.is_emergency !== 'boolean') return null;

  return {
    specialty: obj.specialty,
    explanation: obj.explanation,
    confidence,
    is_emergency: obj.is_emergency,
  };
}

async function callGroq(
  config: GroqConfig,
  messages: { role: string; content: string }[],
): Promise<ApiResult<string>> {
  let response: Response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        messages,
      }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const content =
    body && typeof body === 'object' && 'choices' in body
      ? (body as { choices?: unknown }).choices
      : undefined;

  const firstChoice = Array.isArray(content) ? content[0] : undefined;
  const message =
    firstChoice && typeof firstChoice === 'object' && 'message' in firstChoice
      ? (firstChoice as { message?: unknown }).message
      : undefined;

  const messageContent =
    message && typeof message === 'object' && 'content' in message
      ? (message as { content?: unknown }).content
      : undefined;

  if (typeof messageContent !== 'string' || messageContent.length === 0) {
    return { ok: false, kind: 'invalid_response', message: 'Groq response did not include message content' };
  }

  return { ok: true, data: messageContent };
}

/**
 * Stage 1 only: maps a free-text concern to a specialty. Knows nothing about
 * facilities, locations, or availability — that's Stage 2 (findFacilities).
 */
export async function triageConcern(userInput: string): Promise<TriageResult> {
  const config = getGroqConfig();
  if (!config) {
    console.error('triageConcern called with missing GROQ_API_KEY');
    return FALLBACK_RESULT;
  }

  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userInput },
  ];

  const firstAttempt = await callGroq(config, baseMessages);
  if (firstAttempt.ok) {
    const parsed = parseTriageContent(firstAttempt.data);
    if (parsed) return parsed;
  }

  const retryAttempt = await callGroq(config, [
    ...baseMessages,
    { role: 'user', content: JSON_ONLY_REMINDER },
  ]);
  if (retryAttempt.ok) {
    const parsed = parseTriageContent(retryAttempt.data);
    if (parsed) return parsed;
  }

  return FALLBACK_RESULT;
}
