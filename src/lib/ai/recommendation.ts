export type Recommendation = {
  service: string;
  reason: string;
  action: 'find_facilities' | 'call_hotline' | 'book_now';
  urgency: 'routine' | 'urgent' | 'emergency';
  department?: string;
};

const EMERGENCY_PATTERNS = /emergency|ER\b|urgent|ambulance|heart attack|stroke|unconscious|severe bleeding|chest pain|difficulty breathing/i;
const URGENT_PATTERNS = /urgent|same day|immediate|quickly|as soon as possible/i;

const VALID_ACTIONS = new Set<string>(['find_facilities', 'call_hotline', 'book_now']);

const DEPARTMENT_KEYWORDS = [
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Neurology',
  'Psychiatry',
  'OB-GYN',
  'Ophthalmology',
  'ENT',
  'Internal Medicine',
  'General Medicine',
  'Surgery',
  'Radiology',
  'Laboratory',
  'Pharmacy',
  'Rehabilitation',
  'Dental',
];

function computeUrgency(text: string): 'routine' | 'urgent' | 'emergency' {
  if (EMERGENCY_PATTERNS.test(text)) return 'emergency';
  if (URGENT_PATTERNS.test(text)) return 'urgent';
  return 'routine';
}

function extractDepartment(service: string): string | undefined {
  const dashIndex = service.indexOf('—');
  const prefix = (dashIndex > 0 ? service.substring(0, dashIndex) : service).trim();

  for (const dept of DEPARTMENT_KEYWORDS) {
    if (prefix.toLowerCase().includes(dept.toLowerCase())) {
      return dept;
    }
  }
  return undefined;
}

function mapAction(raw: unknown): 'find_facilities' | 'call_hotline' | 'book_now' {
  const val = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return VALID_ACTIONS.has(val) ? (val as 'find_facilities' | 'call_hotline' | 'book_now') : 'find_facilities';
}

function normalizeOne(raw: unknown): Recommendation {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const service = typeof obj.service === 'string' ? obj.service : 'General Consultation';
    const reason =
      typeof obj.reason === 'string'
        ? obj.reason
        : 'Based on your description, this is a common next step.';
    const action = mapAction(obj.action);
    const textForUrgency = `${service} ${reason}`;
    const urgency = computeUrgency(textForUrgency);
    const department = extractDepartment(service);

    return { service, reason, action, urgency, department };
  }

  return {
    service: 'General Consultation',
    reason: 'Based on your description, this is a common next step. A doctor can evaluate your symptoms.',
    action: 'find_facilities',
    urgency: 'routine',
  };
}

export function normalizeRecommendations(raw: unknown): Recommendation[] {
  let items: unknown[];

  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'recommendations' in raw) {
    const recs = (raw as Record<string, unknown>).recommendations;
    items = Array.isArray(recs) ? recs : [];
  } else if (Array.isArray(raw)) {
    items = raw;
  } else {
    items = [raw];
  }

  const normalized = items.map(normalizeOne);

  const seen = new Set<string>();
  const deduped: Recommendation[] = [];

  for (const rec of normalized) {
    const key = rec.service.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rec);
    }
  }

  const urgencyOrder = { emergency: 0, urgent: 1, routine: 2 };
  deduped.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return deduped;
}
