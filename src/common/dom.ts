export function textFrom(element: Element | null): string | undefined {
  if (!element) {
    return undefined;
  }
  const value = element.textContent?.trim();
  return value || undefined;
}

export function metaContent(doc: Document, selector: string): string | undefined {
  const content = doc.querySelector(selector)?.getAttribute('content');
  return content?.trim() || undefined;
}

export function splitList(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function cleanText(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/\s+/g, ' ').trim() || undefined;
}
