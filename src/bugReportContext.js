const BUG_SURFACES = new Set([
  'auto',
  'api',
  'frontend',
  'backend',
  'mobile',
  'data',
  'integration',
  'unknown',
]);

const SURFACE_LABELS = {
  auto: 'Auto-detect',
  api: 'API',
  frontend: 'Frontend/UI',
  backend: 'Backend/service',
  mobile: 'Mobile app',
  data: 'Data/database',
  integration: 'Integration',
  unknown: 'Unknown',
};

const FIELD_LIMITS = {
  environment: 1000,
  endpoint: 700,
  steps: 5000,
  actualResult: 3000,
  expectedResult: 3000,
  testData: 2500,
  severityPriority: 700,
};

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+\n/g, '\n').slice(0, maxLength);
}

function normalizeSurface(value) {
  const surface = typeof value === 'string' ? value.trim().toLowerCase() : 'auto';

  return BUG_SURFACES.has(surface) ? surface : 'auto';
}

function addScore(scores, surface, amount, pattern, text) {
  if (pattern.test(text)) {
    scores[surface] += amount;
  }
}

function detectBugSurface(context) {
  const text = [
    context.issueDescription,
    context.additionalInfo,
    context.environment,
    context.endpoint,
    context.steps,
    context.actualResult,
    context.expectedResult,
    context.testData,
  ].filter(Boolean).join('\n').toLowerCase();

  if (!text) {
    return 'unknown';
  }

  const scores = {
    api: 0,
    frontend: 0,
    backend: 0,
    mobile: 0,
    data: 0,
    integration: 0,
  };

  addScore(scores, 'api', 5, /\bapi\b|\bendpoint\b|\bpayload\b|\brequest\b|\bresponse\b|\bstatus\s*code\b|\bhttp\b|\brest\b|\bgraphql\b|\bswagger\b|\bpostman\b|\bcurl\b/i, text);
  addScore(scores, 'api', 6, /\b(get|post|put|patch|delete)\s+\/[a-z0-9/_{}:.-]+|\/api\/[a-z0-9/_{}:.-]+/i, text);
  addScore(scores, 'frontend', 3, /\bfrontend\b|\bfront\s*end\b|\bfe\b|\bui\b|\bux\b|\bpage\b|\bscreen\b|\bmodal\b|\bbutton\b|\bclick\b|\bbrowser\b|\bwebsite\b|\bweb\s*app\b/i, text);
  addScore(scores, 'backend', 3, /\bbackend\b|\bback\s*end\b|\bservice\b|\bserver\b|\bworker\b|\bqueue\b|\bjob\b|\bcron\b|\blog\b|\bvalidation\b|\bbusiness\s*logic\b/i, text);
  addScore(scores, 'mobile', 4, /\bmobile\b|\bios\b|\bandroid\b|\btablet\b|\bdevice\b|\bapp\s+store\b|\bplay\s+store\b/i, text);
  addScore(scores, 'data', 3, /\bdatabase\b|\bdata\b|\brecord\b|\brow\b|\btable\b|\bquery\b|\bsql\b|\bduplicate\b|\bstate\b|\bstatus\b/i, text);
  addScore(scores, 'integration', 3, /\bintegration\b|\bwebhook\b|\bthird[-\s]?party\b|\bpayment\s*provider\b|\bprovider\b|\bexternal\b|\bsync\b|\bimport\b|\bexport\b/i, text);

  if (context.endpoint) {
    scores.api += 8;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [surface, score] = ranked[0];

  if (!score) {
    return 'unknown';
  }

  return surface;
}

export function getBugSurfaceLabel(surface) {
  return SURFACE_LABELS[surface] || SURFACE_LABELS.unknown;
}

export function normalizeBugContext(body = {}) {
  const context = {
    issueDescription: normalizeText(body.issueDescription, 8000),
    additionalInfo: normalizeText(body.clarificationAnswers || body.bugClarificationAnswers, 8000),
    selectedSurface: normalizeSurface(body.bugSurface),
    environment: normalizeText(body.bugEnvironment, FIELD_LIMITS.environment),
    endpoint: normalizeText(body.bugEndpoint, FIELD_LIMITS.endpoint),
    steps: normalizeText(body.bugSteps, FIELD_LIMITS.steps),
    actualResult: normalizeText(body.bugActualResult, FIELD_LIMITS.actualResult),
    expectedResult: normalizeText(body.bugExpectedResult, FIELD_LIMITS.expectedResult),
    testData: normalizeText(body.bugTestData, FIELD_LIMITS.testData),
    severityPriority: normalizeText(body.bugSeverityPriority, FIELD_LIMITS.severityPriority),
  };
  const detectedSurface = detectBugSurface(context);
  const effectiveSurface = context.selectedSurface === 'auto'
    ? detectedSurface
    : context.selectedSurface;

  return {
    ...context,
    detectedSurface,
    effectiveSurface,
    selectedSurfaceLabel: getBugSurfaceLabel(context.selectedSurface),
    detectedSurfaceLabel: getBugSurfaceLabel(detectedSurface),
    effectiveSurfaceLabel: getBugSurfaceLabel(effectiveSurface),
  };
}
