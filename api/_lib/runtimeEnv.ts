// Runtime environment bridge shared by local Node/Vite and Cloudflare Workers.
// The worker injects bindings per request; local development falls back to process.env.

let runtimeEnv: Record<string, unknown> = {};

export function setRuntimeEnv(env: Record<string, unknown>): void {
  runtimeEnv = env;
}

export function readEnv(name: string): string | undefined {
  const runtimeValue = runtimeEnv[name];
  if (typeof runtimeValue === 'string' && runtimeValue.length > 0) return runtimeValue;

  if (typeof process !== 'undefined') {
    const nodeValue = process.env?.[name];
    if (nodeValue) return nodeValue;
  }

  return undefined;
}
