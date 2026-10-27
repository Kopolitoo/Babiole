import type { SceneDocument } from './document';

/**
 * Toute modification du document passe par une commande,
 * ce qui donne « annuler » et « rétablir » pour tout.
 */
export interface Command {
  /** Texte lu à l'utilisateur, par exemple « Ajout d'une boîte ». */
  readonly label: string;
  apply(doc: SceneDocument): void;
  revert(doc: SceneDocument): void;
}

export class History {
  private done: Command[] = [];
  private undone: Command[] = [];

  constructor(
    private readonly doc: SceneDocument,
    private readonly limit = 500,
  ) {}

  run(command: Command): void {
    command.apply(this.doc);
    this.done.push(command);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }

  /** Renvoie la commande annulée, ou null s'il n'y a rien à annuler. */
  undo(): Command | null {
    const command = this.done.pop();
    if (!command) return null;
    command.revert(this.doc);
    this.undone.push(command);
    return command;
  }

  redo(): Command | null {
    const command = this.undone.pop();
    if (!command) return null;
    command.apply(this.doc);
    this.done.push(command);
    return command;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }
}
