import { StoredOptions } from '../types/book';

export function createDebugLogger(namespace: string) {
  return (options: StoredOptions | undefined, ...args: unknown[]) => {
    if (options?.enableLogging) {
      console.debug(`[${namespace}]`, ...args);
    }
  };
}
