import { AddShape, KIND_NAMES, MoveShapes, RemoveShapes, defaultShape } from './commands';
import { SceneDocument, type ShapeKind, type Vec3 } from './document';
import { History } from './history';
import { HELP_TEXT, parse, type Action, type ViewName } from './parser';

/** Ce que l'éditeur demande à la vue 3D, sans dépendre de Three.js. */
export interface CameraControl {
  setView(view: ViewName): void;
  zoom(direction: 'in' | 'out'): void;
}

export interface Feedback {
  ok: boolean;
  message: string;
}

const DEFAULT_SIZE = 20;

/**
 * Point d'entrée unique pour toutes les actions : barre de commande,
 * boutons et raccourcis passent tous par ici.
 */
export class Editor {
  readonly doc = new SceneDocument();
  readonly history = new History(this.doc);
  private selection = new Set<number>();
  private selectionListeners = new Set<() => void>();
  camera: CameraControl | null = null;

  /** Exécute une phrase. Si une partie est incomprise, rien n'est exécuté. */
  runText(text: string): Feedback {
    const parsed = parse(text);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const messages: string[] = [];
    for (const action of parsed.actions) {
      const feedback = this.run(action);
      messages.push(feedback.message);
      if (!feedback.ok) return { ok: false, message: messages.join(' · ') };
    }
    return { ok: true, message: messages.join(' · ') };
  }

  run(action: Action): Feedback {
    switch (action.type) {
      case 'create':
        return this.create(action.kind, action.dims);
      case 'move':
        return this.move(action.axis, action.amount);
      case 'select': {
        const missing = action.ids.filter((id) => !this.doc.has(id));
        if (missing.length > 0) return { ok: false, message: `Pas de forme numéro ${missing.join(', ')}` };
        this.setSelection(action.ids);
        return { ok: true, message: `Sélection : ${action.ids.join(', ')}` };
      }
      case 'selectAll': {
        const ids = this.doc.all().map((s) => s.id);
        this.setSelection(ids);
        return { ok: true, message: ids.length ? `${ids.length} formes sélectionnées` : 'La scène est vide' };
      }
      case 'deselect':
        this.setSelection([]);
        return { ok: true, message: 'Plus rien de sélectionné' };
      case 'delete': {
        const ids = this.selectedIds();
        if (ids.length === 0) return { ok: false, message: 'Rien à supprimer : sélectionnez une forme' };
        const command = new RemoveShapes(ids);
        this.history.run(command);
        this.setSelection([]);
        return { ok: true, message: command.label };
      }
      case 'undo': {
        const command = this.history.undo();
        this.pruneSelection();
        return command ? { ok: true, message: `Annulé : ${command.label}` } : { ok: false, message: 'Rien à annuler' };
      }
      case 'redo': {
        const command = this.history.redo();
        this.pruneSelection();
        return command ? { ok: true, message: `Rétabli : ${command.label}` } : { ok: false, message: 'Rien à rétablir' };
      }
      case 'view':
        this.camera?.setView(action.view);
        return { ok: true, message: `Vue ${action.view === 'iso' ? 'en perspective' : action.view}` };
      case 'zoom':
        this.camera?.zoom(action.direction);
        return { ok: true, message: action.direction === 'in' ? 'Zoom avant' : 'Zoom arrière' };
      case 'help':
        return { ok: true, message: HELP_TEXT.join('\n') };
    }
  }

  create(kind: ShapeKind, dims: number[]): Feedback {
    const size = sizeFor(kind, dims);
    if (!size) return { ok: false, message: `Trop de dimensions pour : ${KIND_NAMES[kind]}` };
    const command = new AddShape(defaultShape(kind, size, this.freeSpot(size)));
    this.history.run(command);
    this.setSelection([command.shapeId]);
    return { ok: true, message: `Forme ${command.shapeId} ajoutée (${KIND_NAMES[kind]})` };
  }

  move(axis: 'x' | 'y' | 'z', amount: number): Feedback {
    const ids = this.selectedIds();
    if (ids.length === 0) return { ok: false, message: 'Rien à déplacer : sélectionnez une forme' };
    const delta: Vec3 = { x: 0, y: 0, z: 0 };
    delta[axis] = amount;
    this.history.run(new MoveShapes(ids, delta));
    return { ok: true, message: `Déplacé de ${amount} mm sur ${axis.toUpperCase()}` };
  }

  selectedIds(): number[] {
    return [...this.selection].sort((a, b) => a - b);
  }

  isSelected(id: number): boolean {
    return this.selection.has(id);
  }

  setSelection(ids: Iterable<number>): void {
    this.selection = new Set([...ids].filter((id) => this.doc.has(id)));
    for (const listener of this.selectionListeners) listener();
  }

  toggleSelection(id: number): void {
    const next = new Set(this.selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.setSelection(next);
  }

  onSelectionChange(listener: () => void): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  /** Après un « annuler », une forme sélectionnée peut avoir disparu. */
  private pruneSelection(): void {
    this.setSelection(this.selection);
  }

  /**
   * Place une nouvelle forme à droite des autres pour qu'elles ne se
   * superposent pas : plus simple à viser au regard et à sélectionner.
   */
  private freeSpot(size: Vec3): Vec3 {
    const shapes = this.doc.all();
    if (shapes.length === 0) return { x: 0, y: 0, z: 0 };
    const maxX = Math.max(...shapes.map((s) => s.position.x + s.size.x / 2));
    return { x: Math.round(maxX + 10 + size.x / 2), y: 0, z: 0 };
  }
}

function sizeFor(kind: ShapeKind, dims: number[]): Vec3 | null {
  const [a = DEFAULT_SIZE, b, c] = dims;
  switch (kind) {
    case 'boite':
      if (dims.length > 3) return null;
      // « cube 20 » : trois côtés égaux. « boîte 30 20 » : hauteur = 20 par défaut.
      return dims.length <= 1 ? { x: a, y: a, z: a } : { x: a, y: b ?? a, z: c ?? DEFAULT_SIZE };
    case 'cylindre':
      // « cylindre 10 30 » : diamètre puis hauteur.
      if (dims.length > 2) return null;
      return { x: a, y: a, z: b ?? a };
    case 'sphere':
      if (dims.length > 1) return null;
      return { x: a, y: a, z: a };
  }
}
