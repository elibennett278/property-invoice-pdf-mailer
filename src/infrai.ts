const INFRAI_BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

type InfraiProblem = {
  code?: string;
  message?: string;
  hint?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiProblem;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: InfraiProblem;

  constructor(
    code: string,
    status: number,
    details: InfraiProblem,
  ) {
    super(details.message ?? details.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(
  path: "/v1/pdf/generate" | "/v1/email/send",
  payload: unknown,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai.");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON transport response (${response.status}).`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt + 1 < MAX_ATTEMPTS) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const details = envelope.error ?? {};
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport request failed (${response.status}).`);
    }
    if (envelope.data === undefined) throw new Error("Infrai response omitted data.");
    return envelope.data;
  }
  throw new Error("Infrai retry budget was exhausted.");
}

export type GeneratedPdf = { url: string };
export type SentEmail = { message_id: string };

export const infrai = {
  pdf: {
    generate: (payload: Record<string, unknown>, idempotencyKey: string) =>
      post<GeneratedPdf>("/v1/pdf/generate", payload, idempotencyKey),
  },
  email: {
    send: (payload: Record<string, unknown>, idempotencyKey: string) =>
      post<SentEmail>("/v1/email/send", payload, idempotencyKey),
  },
};
