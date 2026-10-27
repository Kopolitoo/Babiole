import { describe, expect, it } from 'vitest';
import { normalize, parse, readNumber, type Action } from '../src/core/parser';

function actions(text: string): Action[] {
  const result = parse(text);
  if (!result.ok) throw new Error(result.error);
  return result.actions;
}

describe('normalize', () => {
  it('retire accents, majuscules et ponctuation ajoutée par Dragon', () => {
    expect(normalize('Sphère 20.')).toBe('sphere 20');
    expect(normalize('Déplacer X, 2,5 !')).toBe('deplacer x 2.5');
    expect(normalize("Tout sélectionner")).toBe('tout selectionner');
  });
});

describe('readNumber', () => {
  const read = (text: string) => readNumber(text.split(' '), 0)?.value;
  it('lit chiffres et lettres', () => {
    expect(read('20')).toBe(20);
    expect(read('-5')).toBe(-5);
    expect(read('moins cinq')).toBe(-5);
    expect(read('vingt deux')).toBe(22);
    expect(read('vingt et un')).toBe(21);
    expect(read('soixante dix sept')).toBe(77);
    expect(read('quatre vingt dix')).toBe(90);
    expect(read('cent vingt')).toBe(120);
    expect(read('deux cents')).toBe(200);
    expect(read('dix sept')).toBe(17);
    expect(read('deux virgule cinq')).toBe(2.5);
  });
  it('ne fusionne pas deux unités successives', () => {
    expect(readNumber(['deux', 'trois'], 0)).toEqual({ value: 2, next: 1 });
  });
});

describe('parse', () => {
  it('crée des formes', () => {
    expect(actions('cube 20')).toEqual([{ type: 'create', kind: 'boite', dims: [20] }]);
    expect(actions('ajoute un cylindre de 10 par 30')).toEqual([{ type: 'create', kind: 'cylindre', dims: [10, 30] }]);
    expect(actions('Boîte 30 x 20 x 10')).toEqual([{ type: 'create', kind: 'boite', dims: [30, 20, 10] }]);
    expect(actions('sphère vingt')).toEqual([{ type: 'create', kind: 'sphere', dims: [20] }]);
    expect(actions('cube vingt-deux')).toEqual([{ type: 'create', kind: 'boite', dims: [22] }]);
    expect(actions('cube dix-sept')).toEqual([{ type: 'create', kind: 'boite', dims: [17] }]);
    expect(actions('cube')).toEqual([{ type: 'create', kind: 'boite', dims: [] }]);
  });

  it('déplace selon un axe ou une direction', () => {
    expect(actions('déplacer x 10')).toEqual([{ type: 'move', axis: 'x', amount: 10 }]);
    expect(actions('déplacer y -5')).toEqual([{ type: 'move', axis: 'y', amount: -5 }]);
    expect(actions('déplace z moins 3')).toEqual([{ type: 'move', axis: 'z', amount: -3 }]);
    expect(actions('gauche 5')).toEqual([{ type: 'move', axis: 'x', amount: -5 }]);
    expect(actions('avant 2')).toEqual([{ type: 'move', axis: 'y', amount: -2 }]);
    expect(actions('monter 3')).toEqual([{ type: 'move', axis: 'z', amount: 3 }]);
    expect(actions('descendre')).toEqual([{ type: 'move', axis: 'z', amount: -1 }]);
    expect(actions('déplacer ix 4')).toEqual([{ type: 'move', axis: 'x', amount: 4 }]);
    expect(actions('déplacer i grec 4')).toEqual([{ type: 'move', axis: 'y', amount: 4 }]);
  });

  it('sélectionne', () => {
    expect(actions('sélectionner 2')).toEqual([{ type: 'select', ids: [2] }]);
    expect(actions('sélectionner 1 et 3')).toEqual([{ type: 'select', ids: [1, 3] }]);
    expect(actions('objet numéro deux')).toEqual([{ type: 'select', ids: [2] }]);
    expect(actions('tout sélectionner')).toEqual([{ type: 'selectAll' }]);
    expect(actions('sélectionner tout')).toEqual([{ type: 'selectAll' }]);
    expect(actions('aucun')).toEqual([{ type: 'deselect' }]);
  });

  it('gère les commandes simples', () => {
    expect(actions('Annuler.')).toEqual([{ type: 'undo' }]);
    expect(actions('rétablir')).toEqual([{ type: 'redo' }]);
    expect(actions('supprimer')).toEqual([{ type: 'delete' }]);
    expect(actions('vue de dessus')).toEqual([{ type: 'view', view: 'dessus' }]);
    expect(actions('zoom arrière')).toEqual([{ type: 'zoom', direction: 'out' }]);
    expect(actions('aide')).toEqual([{ type: 'help' }]);
  });

  it('enchaîne avec « puis »', () => {
    expect(actions('cube 20 puis monter 10')).toEqual([
      { type: 'create', kind: 'boite', dims: [20] },
      { type: 'move', axis: 'z', amount: 10 },
    ]);
  });

  it('refuse les phrases incomprises', () => {
    expect(parse('bonjour').ok).toBe(false);
    expect(parse('cube 20 banane').ok).toBe(false);
    expect(parse('cube -5').ok).toBe(false);
    expect(parse('sélectionner').ok).toBe(false);
    expect(parse('').ok).toBe(false);
  });
});
