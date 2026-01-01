import browser from 'webextension-polyfill';
import { BookImportPayload } from '../types/book';
import { RuntimeMessage } from '../types/messages';
import { getOptions } from '../common/storage';
import { JeluClient } from '../common/jeluClient';

async function notify(title: string, message: string) {
  if (!browser.notifications) {
    console.log(`${title}: ${message}`);
    return;
  }

  await browser.notifications.create({
    type: 'basic',
    title,
    message,
    iconUrl: browser.runtime.getURL('assets/icon-96.png'),
  });
}

async function handleImport(payload: BookImportPayload): Promise<void> {
  const options = await getOptions();
  if (!options.jeluUrl) {
    throw new Error('Configure your Jelu server URL before importing.');
  }

  const client = new JeluClient(options);
  await client.importBook(payload);
}

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as RuntimeMessage;
  if (msg?.type === 'IMPORT_BOOK') {
    const payload = msg.payload;
    return handleImport(payload)
      .then(() => notify('Jelu Importer', 'Book imported successfully.'))
      .catch((error: Error) => {
        console.error('Import failed', error);
        notify('Jelu Import failed', error.message);
        throw error;
      });
  }
  return undefined;
});
