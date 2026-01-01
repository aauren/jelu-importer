import { StoredOptions } from '../types/book';
import { createDebugLogger } from './logger';

const debug = createDebugLogger('autocomplete');

export interface AutocompleteResult {
  name: string;
  id?: string;
}

interface CachedResult {
  results: AutocompleteResult[];
  timestamp: number;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
}

interface AuthorDto {
  id: string;
  name: string;
}

interface TagDto {
  id: string;
  name: string;
}

interface SeriesDto {
  id: string;
  name: string;
}

export class AutocompleteService {
  private cache = new Map<string, CachedResult>();
  private debounceTimers = new Map<string, number>();
  private abortControllers = new Map<string, AbortController>();
  private readonly debounceMs = 300;
  private readonly maxResults = 5;

  constructor(private readonly options: StoredOptions) {}

  private buildAuthHeaders(): Record<string, string> {
    if (this.options.username && this.options.password) {
      const encoded = btoa(`${this.options.username}:${this.options.password}`);
      return { Authorization: `Basic ${encoded}` };
    }
    throw new Error('Authentication credentials not configured');
  }

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private getCacheKey(endpoint: string, params: Record<string, string>): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `${endpoint}:${paramString}`;
  }

  private getFromCache(cacheKey: string): AutocompleteResult[] | null {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.results;
    }
    return null;
  }

  private setCache(cacheKey: string, results: AutocompleteResult[]): void {
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    // Optional: Limit cache size to prevent memory issues
    if (this.cache.size > 250) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  private async fetchFromApi<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T[]> {
    if (!this.options.jeluUrl) {
      throw new Error('Jelu URL not configured');
    }

    const baseUrl = this.normalizeBaseUrl(this.options.jeluUrl);
    const queryString = new URLSearchParams(params).toString();
    const url = `${baseUrl}${endpoint}?${queryString}`;

    // Cancel any existing request for this endpoint
    const abortKey = endpoint;
    const existingController = this.abortControllers.get(abortKey);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    this.abortControllers.set(abortKey, controller);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.buildAuthHeaders(),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const data = (await response.json()) as PageResponse<T> | T[];

      // Handle both Page<T> and T[] responses
      if (Array.isArray(data)) {
        return data;
      } else if ('content' in data && Array.isArray(data.content)) {
        return data.content;
      }

      return [];
    } finally {
      this.abortControllers.delete(abortKey);
    }
  }

  private debouncedFetch(
    key: string,
    fetchFn: () => Promise<AutocompleteResult[]>,
  ): Promise<AutocompleteResult[]> {
    return new Promise((resolve) => {
      // Clear existing timer for this key
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(async () => {
        this.debounceTimers.delete(key);
        try {
          const results = await fetchFn();
          resolve(results);
        } catch (error) {
          // Silent failure - return empty array
          debug(this.options, 'Autocomplete fetch error:', error);
          resolve([]);
        }
      }, this.debounceMs);

      this.debounceTimers.set(key, timer);
    });
  }

  async fetchAuthors(
    query: string,
    role?: 'AUTHOR' | 'NARRATOR',
  ): Promise<AutocompleteResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    const params: Record<string, string> = {
      name: query,
      size: String(this.maxResults),
      sort: 'name,asc',
    };

    if (role) {
      params.role = role;
    }

    const cacheKey = this.getCacheKey('/api/v1/authors', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    return this.debouncedFetch(cacheKey, async () => {
      try {
        const authors = await this.fetchFromApi<AuthorDto>('/api/v1/authors', params);
        const results: AutocompleteResult[] = authors.map((author) => ({
          name: author.name,
          id: author.id,
        }));
        this.setCache(cacheKey, results);
        return results;
      } catch (error) {
        debug(this.options, 'Failed to fetch authors:', error);
        return [];
      }
    });
  }

  async fetchTags(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    const params: Record<string, string> = {
      name: query,
      size: String(this.maxResults),
      sort: 'name,asc',
    };

    const cacheKey = this.getCacheKey('/api/v1/tags', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    return this.debouncedFetch(cacheKey, async () => {
      try {
        const tags = await this.fetchFromApi<TagDto>('/api/v1/tags', params);
        const results: AutocompleteResult[] = tags.map((tag) => ({
          name: tag.name,
          id: tag.id,
        }));
        this.setCache(cacheKey, results);
        return results;
      } catch (error) {
        debug(this.options, 'Failed to fetch tags:', error);
        return [];
      }
    });
  }

  async fetchPublishers(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    const params: Record<string, string> = {
      name: query,
      size: String(this.maxResults),
      sort: 'name,asc',
    };

    const cacheKey = this.getCacheKey('/api/v1/books/publishers', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    return this.debouncedFetch(cacheKey, async () => {
      try {
        const publishers = await this.fetchFromApi<string>(
          '/api/v1/books/publishers',
          params,
        );
        const results: AutocompleteResult[] = publishers
          .filter((name) => name && name.trim().length > 0)
          .map((name) => ({
            name: name.trim(),
          }));
        this.setCache(cacheKey, results);
        return results;
      } catch (error) {
        debug(this.options, 'Failed to fetch publishers:', error);
        return [];
      }
    });
  }

  async fetchSeries(query: string): Promise<AutocompleteResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    const params: Record<string, string> = {
      name: query,
      size: String(this.maxResults),
      sort: 'name,asc',
    };

    const cacheKey = this.getCacheKey('/api/v1/series', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    return this.debouncedFetch(cacheKey, async () => {
      try {
        const series = await this.fetchFromApi<SeriesDto>('/api/v1/series', params);
        const results: AutocompleteResult[] = series.map((s) => ({
          name: s.name,
          id: s.id,
        }));
        this.setCache(cacheKey, results);
        return results;
      } catch (error) {
        debug(this.options, 'Failed to fetch series:', error);
        return [];
      }
    });
  }

  /**
   * Clean up any pending timers and abort controllers
   */
  destroy(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Abort all pending requests
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Clear cache
    this.cache.clear();
  }
}
