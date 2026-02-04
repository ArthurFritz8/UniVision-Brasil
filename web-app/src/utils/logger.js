const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Default less noisy; opt-in to debug/trace via VITE_LOG_LEVEL
const defaultLevel = 'info';
const configuredLevel = (import.meta.env.VITE_LOG_LEVEL || defaultLevel).toLowerCase();
const currentLevel = LEVELS[configuredLevel] ?? LEVELS[defaultLevel];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && (value.constructor === Object || Object.getPrototypeOf(value) === null);

const redactString = (text) => {
  if (typeof text !== 'string') return text;

  let out = text;

  // Mask common query params
  out = out.replace(/([?&](?:password|pass|token|access_token|auth|authorization)=)([^&]+)/gi, '$1[REDACTED]');
  out = out.replace(/([?&]username=)([^&]+)/gi, '$1[USER]');

  // Mask Xtream-style URLs containing credentials
  out = out.replace(/\/((?:live|movie|series))\/([^/]+)\/([^/]+)\//gi, '/$1/[USER]/[PASS]/');

  // Mask basic-auth URLs
  out = out.replace(/(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, '$1[USER]:[PASS]@');

  return out;
};

export const redact = (value, seen = new WeakSet()) => {
  try {
    if (typeof value === 'string') return redactString(value);

    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactString(value.message),
        stack: value.stack,
      };
    }

    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) return value.map((v) => redact(v, seen));

    if (!isPlainObject(value)) {
      // Best-effort: stringify then redact
      return redactString(String(value));
    }

    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (/pass(word)?|token|authorization|refresh|secret/i.test(key)) {
        out[key] = '[REDACTED]';
      } else if (/url/i.test(key) && typeof v === 'string') {
        out[key] = redactString(v);
      } else {
        out[key] = redact(v, seen);
      }
    }
    return out;
  } catch {
    return '[Unserializable]';
  }
};

const shouldLog = (levelName) => {
  const lvl = LEVELS[levelName] ?? LEVELS.info;
  return lvl <= currentLevel;
};

const now = () => new Date().toISOString();

const emit = (levelName, message, meta, error) => {
  if (!shouldLog(levelName)) return;

  const payload = {
    ts: now(),
    level: levelName,
    msg: message,
    ...(meta !== undefined ? { meta: redact(meta) } : null),
    ...(error ? { error: redact(error) } : null),
  };

  // Keep browser console friendly; meta stays structured
  const fn =
    levelName === 'error'
      ? console.error
      : levelName === 'warn'
        ? console.warn
        : levelName === 'debug' || levelName === 'trace'
          ? console.debug
          : console.log;

  fn('[UniVision]', payload);
};

export const logger = {
  error: (message, meta, error) => emit('error', message, meta, error),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
  trace: (message, meta) => emit('trace', message, meta),
};
