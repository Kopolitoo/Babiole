import { describe, expect, it } from 'vitest';
import { Editor } from '../src/core/editor';

describe('Editor', () => {
  it('crée une forme, la sélectionne et lui donne un numéro', () => {
    const editor = new Editor();
    expect(editor.runText('cube 20').ok).toBe(true);
    const [shape] = editor.doc.all();
    expect(shape).toMatchObject({ id: 1, kind: 'boite', size: { x: 20, y: 20, z: 20 }, position: { x: 0, y: 0, z: 0 } });
    expect(editor.selectedIds()).toEqual([1]);
  });

  it('place les nouvelles formes côte à côte', () => {
    const editor = new Editor();
    editor.runText('cube 20');
    editor.runText('cylindre 10 30');
    const cylinder = editor.doc.get(2)!;
    expect(cylinder.size).toEqual({ x: 10, y: 10, z: 30 });
    expect(cylinder.position.x).toBe(25); // 10 (bord du cube) + 10 d'écart + 5 (rayon)
  });

  it('déplace la sélection puis annule et rétablit', () => {
    const editor = new Editor();
    editor.runText('cube 20 puis déplacer x 10 puis monter 5');
    expect(editor.doc.get(1)!.position).toEqual({ x: 10, y: 0, z: 5 });
    editor.runText('annuler');
    expect(editor.doc.get(1)!.position).toEqual({ x: 10, y: 0, z: 0 });
    editor.runText('annuler');
    editor.runText('annuler');
    expect(editor.doc.all()).toHaveLength(0);
    expect(editor.selectedIds()).toEqual([]);
    editor.runText('rétablir');
    expect(editor.doc.get(1)).toBeDefined(); // même numéro après rétablir
    expect(editor.runText('rétablir puis rétablir').ok).toBe(true);
    expect(editor.doc.get(1)!.position).toEqual({ x: 10, y: 0, z: 5 });
    expect(editor.runText('rétablir').ok).toBe(false);
  });

  it('supprime et restaure', () => {
    const editor = new Editor();
    editor.runText('cube puis sphère puis tout sélectionner puis supprimer');
    expect(editor.doc.all()).toHaveLength(0);
    editor.runText('annuler');
    expect(editor.doc.all().map((s) => s.id)).toEqual([1, 2]);
  });

  it('ne réutilise jamais un numéro', () => {
    const editor = new Editor();
    editor.runText('cube puis supprimer puis cube');
    expect(editor.doc.all().map((s) => s.id)).toEqual([2]);
  });

  it('explique les erreurs', () => {
    const editor = new Editor();
    expect(editor.runText('déplacer x 10')).toEqual({ ok: false, message: 'Rien à déplacer : sélectionnez une forme' });
    expect(editor.runText('sélectionner 7')).toEqual({ ok: false, message: 'Pas de forme numéro 7' });
    expect(editor.runText('sphère 10 20').ok).toBe(false);
    expect(editor.runText('annuler')).toEqual({ ok: false, message: 'Rien à annuler' });
  });
});
