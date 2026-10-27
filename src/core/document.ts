/**
 * Modèle de la scène : des données pures, sans Three.js.
 * Unités en millimètres. Axe Z vers le haut, comme dans Tinkercad.
 */

export type ShapeKind = 'boite' | 'cylindre' | 'sphere';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Shape {
  /** Numéro affiché à l'écran, utilisé pour sélectionner à la voix. Jamais réutilisé. */
  id: number;
  kind: ShapeKind;
  /** Encombrement : largeur (x), profondeur (y), hauteur (z). */
  size: Vec3;
  /** Centre de la face du bas. z = 0 signifie posé sur le plan de travail. */
  position: Vec3;
  color: string;
  /** Un trou sera soustrait des autres formes lors du groupement (étape 3). */
  hole: boolean;
}

export type ShapeInit = Omit<Shape, 'id'>;

type Listener = () => void;

export class SceneDocument {
  private shapes = new Map<number, Shape>();
  private nextId = 1;
  private listeners = new Set<Listener>();

  /** Réserve le prochain numéro. */
  allocateId(): number {
    return this.nextId++;
  }

  /** Ajoute une forme dont le numéro a déjà été réservé (ou est restauré par « annuler »). */
  insert(shape: Shape): void {
    if (this.shapes.has(shape.id)) throw new Error(`La forme ${shape.id} existe déjà`);
    this.shapes.set(shape.id, cloneShape(shape));
    this.nextId = Math.max(this.nextId, shape.id + 1);
    this.emit();
  }

  remove(id: number): Shape {
    const shape = this.shapes.get(id);
    if (!shape) throw new Error(`Pas de forme numéro ${id}`);
    this.shapes.delete(id);
    this.emit();
    return shape;
  }

  update(id: number, patch: Partial<ShapeInit>): void {
    const shape = this.shapes.get(id);
    if (!shape) throw new Error(`Pas de forme numéro ${id}`);
    this.shapes.set(id, cloneShape({ ...shape, ...patch, id }));
    this.emit();
  }

  get(id: number): Shape | undefined {
    const shape = this.shapes.get(id);
    return shape && cloneShape(shape);
  }

  has(id: number): boolean {
    return this.shapes.has(id);
  }

  all(): Shape[] {
    return [...this.shapes.values()].map(cloneShape);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function cloneShape(shape: Shape): Shape {
  return { ...shape, size: { ...shape.size }, position: { ...shape.position } };
}
