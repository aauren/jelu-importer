import browser from 'webextension-polyfill';
import { StoredOptions, defaultOptions } from '../types/book';

export async function getOptions(): Promise<StoredOptions> {
  const raw = await browser.storage.local.get('options');
  return { ...defaultOptions, ...(raw.options as StoredOptions | undefined) };
}

export async function saveOptions(options: StoredOptions): Promise<void> {
  await browser.storage.local.set({ options });
}
