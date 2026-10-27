import { type SceneDocument, type Shape, type ShapeInit, type ShapeKind, type Vec3 } from './document';
import type { Command } from './history';

export const KIND_NAMES: Record<ShapeKind, string> = {
  boite: 'boîte',
  cylindre: 'cylindre',
  sphere: 'sphère',
};

const DEFAULT_COLORS: Record<ShapeKind, string> = {
  boite: '#e8553e',
  cylindre: '#f2a33a',
  sphere: '#3f8fe0',
};

export function defaultShape(kind: ShapeKind, size: Vec3, position: Vec3 = { x: 0, y: 0, z: 0 }): ShapeInit {
  return { kind, size, position, color: DEFAULT_COLORS[kind], hole: false };
}

export class AddShape implements Command {
  readonly label: string;
  private id: number | null = null;

  constructor(private readonly init: ShapeInit) {
    this.label = `Ajout : ${KIND_NAMES[init.kind]}`;
  }

  /** Numéro de la forme créée, connu après le premier apply. */
  get shapeId(): number {
    if (this.id === null) throw new Error("La commande n'a pas encore été exécutée");
    return this.id;
  }

  apply(doc: SceneDocument): void {
    // Au « rétablir », on garde le même numéro pour ne pas dérouter l'utilisateur.
    this.id ??= doc.allocateId();
    doc.insert({ ...this.init, id: this.id });
  }

  revert(doc: SceneDocument): void {
    doc.remove(this.shapeId);
  }
}

export class RemoveShapes implements Command {
  readonly label: string;
  private removed: Shape[] = [];

  constructor(private readonly ids: readonly number[]) {
    this.label = ids.length === 1 ? `Suppression de la forme ${ids[0]}` : `Suppression de ${ids.length} formes`;
  }

  apply(doc: SceneDocument): void {
    this.removed = this.ids.map((id) => doc.remove(id));
  }

  revert(doc: SceneDocument): void {
    for (const shape of this.removed) doc.insert(shape);
  }
}

export class MoveShapes implements Command {
  readonly label: string;

  constructor(
    private readonly ids: readonly number[],
    private readonly delta: Vec3,
  ) {
    this.label = `Déplacement de ${ids.length === 1 ? `la forme ${ids[0]}` : `${ids.length} formes`}`;
  }

  apply(doc: SceneDocument): void {
    this.shift(doc, 1);
  }

  revert(doc: SceneDocument): void {
    this.shift(doc, -1);
  }

  private shift(doc: SceneDocument, sign: 1 | -1): void {
    for (const id of this.ids) {
      const shape = doc.get(id);
      if (!shape) continue;
      const p = shape.position;
      doc.update(id, {
        position: {
          x: round(p.x + sign * this.delta.x),
          y: round(p.y + sign * this.delta.y),
          z: round(p.z + sign * this.delta.z),
        },
      });
    }
  }
}

/** Évite les 9.999999 dus aux flottants : précision au millième de millimètre. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
