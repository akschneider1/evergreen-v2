import { Langfuse } from 'langfuse';

export function isLangfuseConfigured(): boolean {
  return !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY);
}

export function getLangfuseBaseUrl(): string {
  return process.env.LANGFUSE_BASE_URL ?? 'https://us.cloud.langfuse.com';
}

export function makeLangfuseClient(): Langfuse {
  return new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    baseUrl: getLangfuseBaseUrl(),
    flushAt: 1,          // send immediately — eval jobs are long-lived, not batched
    requestTimeout: 10000,
  });
}

export function getTraceUrl(traceId: string): string {
  return `${getLangfuseBaseUrl()}/trace/${traceId}`;
}
