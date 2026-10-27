/**
 * Transforme une phrase dictée ou tapée (« cube 20 », « déplacer x 10 »)
 * en actions. Pensé pour Dragon : insensible aux accents, à la casse,
 * à la ponctuation ajoutée, et accepte les nombres écrits en lettres.
 */
import type { ShapeKind } from './document';

export type Axis = 'x' | 'y' | 'z';
export type ViewName = 'dessus' | 'dessous' | 'face' | 'arriere' | 'gauche' | 'droite' | 'iso';

export type Action =
  | { type: 'create'; kind: ShapeKind; dims: number[] }
  | { type: 'move'; axis: Axis; amount: number }
  | { type: 'select'; ids: number[] }
  | { type: 'selectAll' }
  | { type: 'deselect' }
  | { type: 'delete' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'view'; view: ViewName }
  | { type: 'zoom'; direction: 'in' | 'out' }
  | { type: 'help' };

export type ParseResult = { ok: true; actions: Action[] } | { ok: false; error: string };

const SHAPE_WORDS: Record<string, ShapeKind> = {
  cube: 'boite',
  boite: 'boite',
  pave: 'boite',
  bloc: 'boite',
  cylindre: 'cylindre',
  tube: 'cylindre',
  sphere: 'sphere',
  boule: 'sphere',
  balle: 'sphere',
};

const CREATE_VERBS = new Set(['ajouter', 'ajoute', 'creer', 'cree', 'nouveau', 'nouvelle', 'un', 'une', 'insere', 'inserer']);

const MOVE_VERBS = new Set(['deplacer', 'deplace', 'bouger', 'bouge', 'decaler', 'decale', 'pousser', 'pousse']);

/** Directions parlées → axe et signe. « avant » rapproche de l'utilisateur (y négatif). */
const DIRECTIONS: Record<string, { axis: Axis; sign: 1 | -1 }> = {
  x: { axis: 'x', sign: 1 },
  y: { axis: 'y', sign: 1 },
  z: { axis: 'z', sign: 1 },
  droite: { axis: 'x', sign: 1 },
  gauche: { axis: 'x', sign: -1 },
  arriere: { axis: 'y', sign: 1 },
  fond: { axis: 'y', sign: 1 },
  avant: { axis: 'y', sign: -1 },
  haut: { axis: 'z', sign: 1 },
  monter: { axis: 'z', sign: 1 },
  monte: { axis: 'z', sign: 1 },
  bas: { axis: 'z', sign: -1 },
  descendre: { axis: 'z', sign: -1 },
  descends: { axis: 'z', sign: -1 },
  descend: { axis: 'z', sign: -1 },
};

/** Dragon peut écrire « ix », « i grec », « zed » pour les lettres. */
const AXIS_ALIASES: Record<string, string> = { ix: 'x', igrec: 'y', zed: 'z', zede: 'z' };

const VIEWS: Record<string, ViewName> = {
  dessus: 'dessus',
  haut: 'dessus',
  dessous: 'dessous',
  face: 'face',
  devant: 'face',
  avant: 'face',
  arriere: 'arriere',
  derriere: 'arriere',
  gauche: 'gauche',
  droite: 'droite',
  iso: 'iso',
  isometrique: 'iso',
  perspective: 'iso',
  normale: 'iso',
};

const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};
const TENS: Record<string, number> = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

const FILLER = new Set(['de', 'du', 'le', 'la', 'les', 'l', 'sur', 'en', 'mm', 'millimetre', 'millimetres', 'par', 'et', 'a', 'vers', 'objet', 'forme', 'numero', 'no', 'n']);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2') // 2,5 → 2.5
    .replace(/i grec/g, 'igrec')
    .replace(/-(?=\d)/g, ' -') // « x-10 » → « x -10 »
    .replace(/[^a-z0-9.\- ]+/g, ' ') // ponctuation de Dragon, apostrophes, traits d'union entre mots
    .replace(/-(?!\d)/g, ' ') // « vingt-deux » → « vingt deux »
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lit un nombre à partir de tokens[start]. Gère « 20 », « -5 », « 2.5 »,
 * « moins cinq », « vingt deux », « soixante dix », « quatre vingt », « cent vingt ».
 */
export function readNumber(tokens: string[], start: number): { value: number; next: number } | null {
  let i = start;
  let sign = 1;
  if (tokens[i] === 'moins') {
    sign = -1;
    i++;
  }
  const token = tokens[i];
  if (token === undefined) return null;
  if (/^-?\d+(\.\d+)?$/.test(token)) return { value: sign * Number(token), next: i + 1 };

  // « deux trois » donne deux nombres, pas 5 : une unité ne suit jamais une unité.
  let total = 0;
  let current = 0;
  let last: 'none' | 'unit' | 'ten' | 'hundred' = 'none';
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'cent' || t === 'cents') {
      if (last === 'hundred') break;
      current = (current || 1) * 100;
      last = 'hundred';
    } else if (t === 'mille') {
      total += (current || 1) * 1000;
      current = 0;
      last = 'hundred';
    } else if (t === 'quatre' && (tokens[i + 1] === 'vingt' || tokens[i + 1] === 'vingts') && last !== 'unit' && last !== 'ten') {
      current += 80;
      last = 'ten';
      i++;
    } else if (t in TENS) {
      if (last === 'unit' || last === 'ten') break;
      current += TENS[t];
      last = 'ten';
    } else if (t === 'et' && last === 'ten' && (tokens[i + 1] === 'un' || tokens[i + 1] === 'onze')) {
      // « vingt et un », « soixante et onze »
    } else if (t in UNITS) {
      const afterDix = tokens[i - 1] === 'dix' && ['sept', 'huit', 'neuf'].includes(t); // dix-sept
      if (last === 'unit' && !afterDix) break;
      current += UNITS[t];
      last = 'unit';
    } else if (t === 'virgule' && last !== 'none') {
      const decimal = tokens[i + 1];
      const digits = decimal && /^\d+$/.test(decimal) ? decimal : decimal && decimal in UNITS ? String(UNITS[decimal]) : null;
      if (digits === null) break;
      return { value: sign * (total + current + Number(`0.${digits}`)), next: i + 2 };
    } else {
      break;
    }
    i++;
  }
  const found = last !== 'none';
  if (!found) return null;
  return { value: sign * (total + current), next: i };
}

function readNumbers(tokens: string[], start: number): { values: number[]; next: number } {
  const values: number[] = [];
  let i = start;
  while (i < tokens.length) {
    if (tokens[i] === 'par' || tokens[i] === 'x' || tokens[i] === 'fois' || FILLER.has(tokens[i])) {
      i++;
      continue;
    }
    const n = readNumber(tokens, i);
    if (!n) break;
    values.push(n.value);
    i = n.next;
  }
  return { values, next: i };
}

function parseOne(phrase: string): Action | string {
  let tokens = phrase.split(' ').filter(Boolean).map((t) => AXIS_ALIASES[t] ?? t);
  if (tokens.length === 0) return 'Phrase vide';

  const first = tokens[0];
  const rest = tokens.slice(1).join(' ');

  // Annuler / rétablir
  if (['annuler', 'annule', 'defaire', 'defais', 'retour'].includes(first)) return { type: 'undo' };
  if (['retablir', 'retablis', 'refaire', 'refais'].includes(first)) return { type: 'redo' };
  if (['aide', 'aider', 'commandes'].includes(first)) return { type: 'help' };

  // Suppression
  if (['supprimer', 'supprime', 'effacer', 'efface', 'enlever', 'enleve', 'detruire', 'detruis'].includes(first)) {
    return { type: 'delete' };
  }

  // Sélection
  if ((first === 'tout' && (tokens.length === 1 || rest.startsWith('selection'))) || phrase === 'selectionner tout' || phrase === 'selectionne tout') {
    return { type: 'selectAll' };
  }
  if (['aucun', 'deselectionner', 'deselectionne', 'rien'].includes(first)) return { type: 'deselect' };
  if (['selectionner', 'selectionne', 'choisir', 'choisis', 'prendre', 'prends', 'objet', 'forme', 'numero'].includes(first)) {
    const { values } = readNumbers(tokens, 1);
    if (values.length === 0) return 'Dites le numéro de la forme, par exemple « sélectionner 2 »';
    return { type: 'select', ids: values.map(Math.round) };
  }

  // Vues et zoom
  if (first === 'vue' || first === 'voir' || first === 'camera') {
    const word = tokens.slice(1).find((t) => !FILLER.has(t) && t !== 'de');
    const view = word && VIEWS[word];
    if (!view) return 'Vue inconnue. Essayez « vue dessus », « vue face », « vue droite » ou « vue iso »';
    return { type: 'view', view };
  }
  if (first === 'zoom' || first === 'zoomer') {
    const out = tokens.some((t) => ['arriere', 'moins', 'out', 'eloigner', 'dezoomer'].includes(t));
    return { type: 'zoom', direction: out ? 'out' : 'in' };
  }
  if (['rapprocher', 'rapproche', 'agrandir'].includes(first)) return { type: 'zoom', direction: 'in' };
  if (['eloigner', 'eloigne', 'dezoomer', 'dezoome', 'reculer', 'recule'].includes(first)) return { type: 'zoom', direction: 'out' };

  // Création : « cube 20 », « ajoute un cylindre 10 30 »
  let i = 0;
  while (i < tokens.length && CREATE_VERBS.has(tokens[i]) && !(tokens[i] in SHAPE_WORDS)) i++;
  if (tokens[i] in SHAPE_WORDS) {
    const kind = SHAPE_WORDS[tokens[i]];
    const { values, next } = readNumbers(tokens, i + 1);
    if (next < tokens.length) return `Je n'ai pas compris « ${tokens.slice(next).join(' ')} »`;
    if (values.some((v) => v <= 0)) return 'Les dimensions doivent être positives';
    return { type: 'create', kind, dims: values };
  }

  // Déplacement : « déplacer x 10 », « droite 5 », « monter 3 », « déplacer gauche »
  tokens = MOVE_VERBS.has(first) ? tokens.slice(1) : tokens;
  const dirIndex = tokens.findIndex((t) => t in DIRECTIONS);
  if (dirIndex !== -1 && (MOVE_VERBS.has(first) || dirIndex === 0)) {
    const { axis, sign } = DIRECTIONS[tokens[dirIndex]];
    const others = tokens.filter((_, k) => k !== dirIndex);
    const { values, next } = readNumbers(others, 0);
    if (next < others.length) return `Je n'ai pas compris « ${others.slice(next).join(' ')} »`;
    const amount = values.length > 0 ? values[0] : 1;
    return { type: 'move', axis, amount: sign * amount };
  }
  if (MOVE_VERBS.has(first)) return 'Précisez la direction : x, y, z, gauche, droite, avant, arrière, haut ou bas';

  return `Commande inconnue : « ${phrase} ». Dites « aide » pour la liste`;
}

/** Plusieurs commandes peuvent s'enchaîner avec « puis » ou « ensuite ». */
export function parse(text: string): ParseResult {
  const normalized = normalize(text);
  if (!normalized) return { ok: false, error: 'Phrase vide' };
  const phrases = normalized.split(/\b(?:puis|ensuite|et puis)\b/).map((p) => p.trim()).filter(Boolean);
  const actions: Action[] = [];
  for (const phrase of phrases) {
    const result = parseOne(phrase);
    if (typeof result === 'string') return { ok: false, error: result };
    actions.push(result);
  }
  return { ok: true, actions };
}

export const HELP_TEXT = [
  'Créer : « cube 20 », « boîte 30 20 10 », « cylindre 10 30 » (diamètre puis hauteur), « sphère 15 »',
  'Sélectionner : « sélectionner 2 », « sélectionner 1 et 3 », « tout sélectionner », « aucun »',
  'Déplacer : « déplacer x 10 », « droite 5 », « avant 2 », « monter 3 », « descendre 1 »',
  'Modifier : « supprimer », « annuler », « rétablir »',
  'Vue : « vue dessus », « vue face », « vue droite », « vue iso », « zoom avant », « zoom arrière »',
  'Enchaîner : « cube 20 puis monter 10 »',
];
