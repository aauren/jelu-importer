import { AutocompleteResult } from '../common/autocomplete';

type FetchFunction = (query: string) => Promise<AutocompleteResult[]>;

interface TokenInfo {
  value: string;
  start: number;
  end: number;
}

export class AutocompleteController {
  private dropdown: HTMLDivElement | null = null;
  private highlightedIndex = -1;
  private currentResults: AutocompleteResult[] = [];
  private isAttached = false;

  private readonly minChars: number;
  private readonly inputHandler: () => void;
  private readonly keydownHandler: (e: KeyboardEvent) => void;
  private readonly blurHandler: () => void;
  private readonly focusHandler: () => void;

  constructor(
    private readonly inputElement: HTMLInputElement,
    private readonly fetchFn: FetchFunction,
    minChars: number = 3,
  ) {
    this.minChars = minChars;

    // Bind event handlers
    this.inputHandler = this.handleInput.bind(this);
    this.keydownHandler = this.handleKeyDown.bind(this);
    this.blurHandler = this.handleBlur.bind(this);
    this.focusHandler = this.handleFocus.bind(this);
  }

  attach(): void {
    if (this.isAttached) {
      return;
    }

    this.inputElement.addEventListener('input', this.inputHandler);
    this.inputElement.addEventListener('keydown', this.keydownHandler);
    this.inputElement.addEventListener('blur', this.blurHandler);
    this.inputElement.addEventListener('focus', this.focusHandler);
    this.inputElement.setAttribute('autocomplete', 'off');
    this.inputElement.setAttribute('aria-autocomplete', 'list');

    this.isAttached = true;
  }

  destroy(): void {
    if (!this.isAttached) {
      return;
    }

    this.inputElement.removeEventListener('input', this.inputHandler);
    this.inputElement.removeEventListener('keydown', this.keydownHandler);
    this.inputElement.removeEventListener('blur', this.blurHandler);
    this.inputElement.removeEventListener('focus', this.focusHandler);
    this.inputElement.removeAttribute('aria-autocomplete');

    this.hideSuggestions();
    this.isAttached = false;
  }

  private async handleInput(): Promise<void> {
    const token = this.getCurrentToken();

    if (token.value.length < this.minChars) {
      this.hideSuggestions();
      return;
    }

    try {
      const results = await this.fetchFn(token.value);
      this.currentResults = results;
      this.highlightedIndex = -1;

      if (results.length > 0) {
        this.showSuggestions(results);
      } else {
        // Show "Keep typing to refine search" message
        this.showEmptyState();
      }
    } catch {
      // Silent failure
      this.hideSuggestions();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dropdown || this.dropdown.classList.contains('hidden')) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightNext();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightPrevious();
        break;
      case 'Enter':
        if (
          this.highlightedIndex >= 0 &&
          this.highlightedIndex < this.currentResults.length
        ) {
          event.preventDefault();
          this.selectSuggestion(this.currentResults[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.hideSuggestions();
        break;
      case 'Tab':
        // Let tab work naturally, just hide dropdown
        this.hideSuggestions();
        break;
    }
  }

  private handleBlur(): void {
    // Delay hiding to allow click events on dropdown items
    setTimeout(() => {
      this.hideSuggestions();
    }, 200);
  }

  private handleFocus(): void {
    // If user focuses and there's already a query, show suggestions again
    const token = this.getCurrentToken();
    if (token.value.length >= this.minChars && this.currentResults.length > 0) {
      this.showSuggestions(this.currentResults);
    }
  }

  private showSuggestions(results: AutocompleteResult[]): void {
    if (!this.dropdown) {
      this.dropdown = this.createDropdown();
    }

    this.dropdown.innerHTML = '';
    this.dropdown.classList.remove('hidden');

    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = result.name;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.dataset.index = String(index);

      item.addEventListener('mouseenter', () => {
        this.highlightIndex(index);
      });

      item.addEventListener('mousedown', (e) => {
        // Prevent blur from firing before click
        e.preventDefault();
      });

      item.addEventListener('click', () => {
        this.selectSuggestion(result);
      });

      this.dropdown!.appendChild(item);
    });

    this.positionDropdown();
  }

  private showEmptyState(): void {
    if (!this.dropdown) {
      this.dropdown = this.createDropdown();
    }

    this.dropdown.innerHTML = '';
    this.dropdown.classList.remove('hidden');

    const emptyItem = document.createElement('div');
    emptyItem.className = 'autocomplete-empty';
    emptyItem.textContent = 'Keep typing to refine search';
    this.dropdown.appendChild(emptyItem);

    this.positionDropdown();
  }

  private hideSuggestions(): void {
    if (this.dropdown) {
      this.dropdown.classList.add('hidden');
      this.highlightedIndex = -1;
    }
  }

  private createDropdown(): HTMLDivElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown hidden';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Autocomplete suggestions');

    // Find the autocomplete container (parent of input) or use input's parent
    const container =
      this.inputElement.closest('.autocomplete-container') ||
      this.inputElement.parentElement;
    if (container) {
      container.appendChild(dropdown);
    }

    return dropdown;
  }

  private positionDropdown(): void {
    if (!this.dropdown) {
      return;
    }

    // Dropdown is positioned by CSS (absolute, top: 100%)
    // This method can be extended if dynamic positioning is needed
  }

  private highlightNext(): void {
    if (this.currentResults.length === 0) {
      return;
    }

    this.highlightedIndex = (this.highlightedIndex + 1) % this.currentResults.length;
    this.updateHighlight();
  }

  private highlightPrevious(): void {
    if (this.currentResults.length === 0) {
      return;
    }

    this.highlightedIndex =
      this.highlightedIndex <= 0
        ? this.currentResults.length - 1
        : this.highlightedIndex - 1;
    this.updateHighlight();
  }

  private highlightIndex(index: number): void {
    this.highlightedIndex = index;
    this.updateHighlight();
  }

  private updateHighlight(): void {
    if (!this.dropdown) {
      return;
    }

    const items = this.dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === this.highlightedIndex) {
        item.classList.add('highlighted');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.classList.remove('highlighted');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  private selectSuggestion(result: AutocompleteResult): void {
    this.replaceCurrentToken(result.name);
    this.hideSuggestions();
    this.inputElement.focus();
  }

  private getCurrentToken(): TokenInfo {
    const value = this.inputElement.value;
    const cursorPos = this.inputElement.selectionStart ?? value.length;

    // Split by commas to find tokens
    const tokens = value.split(',');
    let currentPos = 0;
    let tokenIndex = 0;

    for (let i = 0; i < tokens.length; i++) {
      const tokenLength = tokens[i].length;
      const tokenEnd = currentPos + tokenLength;

      if (cursorPos >= currentPos && cursorPos <= tokenEnd + 1) {
        // +1 to account for comma
        tokenIndex = i;
        break;
      }

      currentPos = tokenEnd + 1; // +1 for comma
    }

    const start = tokens.slice(0, tokenIndex).join(',').length + (tokenIndex > 0 ? 1 : 0);
    const token = tokens[tokenIndex] || '';
    const end = start + token.length;

    return {
      value: token.trim(),
      start,
      end,
    };
  }

  private replaceCurrentToken(newValue: string): void {
    const value = this.inputElement.value;
    const cursorPos = this.inputElement.selectionStart ?? value.length;

    // Split by commas
    const tokens = value.split(',').map((t) => t.trim());
    let tokenIndex = 0;

    // Find which token the cursor is in
    for (let i = 0; i < tokens.length; i++) {
      const tokenWithComma = tokens.slice(0, i + 1).join(', ');
      if (cursorPos <= tokenWithComma.length) {
        tokenIndex = i;
        break;
      }
    }

    // Replace the token
    tokens[tokenIndex] = newValue;

    // Rebuild the value
    const newFullValue = tokens.join(', ');
    this.inputElement.value = newFullValue;

    // Position cursor after the replaced token
    const newCursorPos = tokens.slice(0, tokenIndex + 1).join(', ').length;

    // Add comma and space if not the last token or if user was in the middle of typing
    if (tokenIndex < tokens.length - 1 || value.endsWith(',') || value.endsWith(', ')) {
      this.inputElement.setSelectionRange(newCursorPos, newCursorPos);
    } else {
      // Add comma and space at the end for easy continuation
      this.inputElement.value = newFullValue + ', ';
      this.inputElement.setSelectionRange(
        newFullValue.length + 2,
        newFullValue.length + 2,
      );
    }

    // Trigger input event so any listeners are notified
    this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
