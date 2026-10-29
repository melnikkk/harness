import * as vm from 'node:vm';
import type { SandboxApi, SandboxResult } from './types';

export async function runInSandbox(
  code: string,
  api: SandboxApi,
  options?: { timeoutMs?: number },
): Promise<SandboxResult> {
  const timeoutMis = options?.timeoutMs ?? 2000;
  const logs: Array<string> = [];

  const context = vm.createContext({
    tools: api,
    console: {
      log: (...args: Array<unknown>) => logs.push(args.map(String).join(' ')),
    },
  });

  const wrapperCode = `(async () => {${code}})()`;

  try {
    const pendingResult = vm.runInContext(wrapperCode, context, { timeout: timeoutMis });
    const result = await withTimeout(pendingResult, timeoutMis);

    return { ok: true, result, logs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      logs,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`execution timed out after ${ms}ms`)), ms),
    ),
  ]);
}
