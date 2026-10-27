import { parse } from '../core/parser';
import type { Editor, Feedback } from '../core/editor';

const AUTO_RUN_KEY = 'babiole.autoRun';
const AUTO_RUN_DELAY_MS = 1200;

/**
 * Champ texte où Dragon dicte les commandes. Avec l'exécution automatique,
 * une phrase valide part toute seule après une courte pause : pas besoin
 * de dire « appuyer sur Entrée ».
 */
export class CommandBar {
  private readonly input: HTMLInputElement;
  private readonly output: HTMLElement;
  private readonly autoRun: HTMLInputElement;
  private readonly recent: string[] = [];
  private recentIndex = -1;
  private timer: number | undefined;

  constructor(
    root: HTMLElement,
    private readonly editor: Editor,
  ) {
    this.input = root.querySelector<HTMLInputElement>('#command-input')!;
    this.output = root.querySelector<HTMLElement>('#command-output')!;
    this.autoRun = root.querySelector<HTMLInputElement>('#auto-run')!;

    this.autoRun.checked = readSetting(AUTO_RUN_KEY) !== 'off';
    this.autoRun.addEventListener('change', () => {
      writeSetting(AUTO_RUN_KEY, this.autoRun.checked ? 'on' : 'off');
      this.focus();
    });

    root.querySelector('#command-run')!.addEventListener('click', () => this.submit());
    this.input.addEventListener('input', () => this.scheduleAutoRun());
    this.input.addEventListener('keydown', (e) => this.handleKey(e));
  }

  focus(): void {
    this.input.focus({ preventScroll: true });
  }

  get isEmpty(): boolean {
    return this.input.value.trim() === '';
  }

  /** Exécute une phrase venant d'un bouton, avec le même retour qu'une phrase dictée. */
  runPhrase(phrase: string): void {
    this.show(this.editor.runText(phrase), phrase);
    this.focus();
  }

  private submit(): void {
    window.clearTimeout(this.timer);
    const text = this.input.value.trim();
    if (!text) return this.focus();
    const feedback = this.editor.runText(text);
    this.show(feedback, text);
    if (feedback.ok) {
      this.remember(text);
      this.input.value = '';
    } else {
      this.input.select(); // facile à remplacer en redictant
    }
    this.focus();
  }

  private scheduleAutoRun(): void {
    window.clearTimeout(this.timer);
    if (!this.autoRun.checked) return;
    this.timer = window.setTimeout(() => {
      // On ne lance que les phrases comprises : une erreur attend une correction.
      if (!this.isEmpty && parse(this.input.value).ok) this.submit();
    }, AUTO_RUN_DELAY_MS);
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submit();
    } else if (event.key === 'Escape') {
      this.input.value = '';
      window.clearTimeout(this.timer);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (this.recent.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? 1 : -1;
      this.recentIndex = Math.min(Math.max(this.recentIndex + step, -1), this.recent.length - 1);
      this.input.value = this.recentIndex === -1 ? '' : this.recent[this.recentIndex];
    }
  }

  private remember(text: string): void {
    this.recent.unshift(text);
    this.recent.splice(50);
    this.recentIndex = -1;
  }

  private show(feedback: Feedback, phrase: string): void {
    this.output.classList.toggle('error', !feedback.ok);
    this.output.replaceChildren();
    const said = document.createElement('div');
    said.className = 'said';
    said.textContent = `« ${phrase} »`;
    const message = document.createElement('div');
    message.className = 'message';
    message.textContent = feedback.message;
    this.output.append(said, message);
  }
}

// Le stockage local peut être indisponible (navigation privée) : on s'en passe.
function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sans effet */
  }
}
