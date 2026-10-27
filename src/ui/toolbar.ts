import type { CommandBar } from './commandBar';

/**
 * Chaque bouton envoie la même phrase que l'on dirait à voix haute.
 * L'infobulle montre cette phrase, ce qui aide à apprendre les commandes.
 * Les boutons ont un texte visible : Dragon peut les viser par leur nom.
 */
interface ButtonSpec {
  text: string;
  phrase: string | ((step: number) => string);
  icon?: string;
}

interface Section {
  title: string;
  buttons: ButtonSpec[];
}

const SECTIONS: Section[] = [
  {
    title: 'Formes',
    buttons: [
      { text: 'Cube', phrase: 'cube 20', icon: '■' },
      { text: 'Cylindre', phrase: 'cylindre 20 20', icon: '▮' },
      { text: 'Sphère', phrase: 'sphère 20', icon: '●' },
    ],
  },
  {
    title: 'Déplacer',
    buttons: [
      { text: 'Gauche', phrase: (s) => `gauche ${s}`, icon: '←' },
      { text: 'Droite', phrase: (s) => `droite ${s}`, icon: '→' },
      { text: 'Arrière', phrase: (s) => `arrière ${s}`, icon: '↑' },
      { text: 'Avant', phrase: (s) => `avant ${s}`, icon: '↓' },
      { text: 'Monter', phrase: (s) => `monter ${s}`, icon: '⤒' },
      { text: 'Descendre', phrase: (s) => `descendre ${s}`, icon: '⤓' },
    ],
  },
  {
    title: 'Modifier',
    buttons: [
      { text: 'Annuler', phrase: 'annuler', icon: '↶' },
      { text: 'Rétablir', phrase: 'rétablir', icon: '↷' },
      { text: 'Supprimer', phrase: 'supprimer', icon: '✕' },
      { text: 'Tout', phrase: 'tout sélectionner', icon: '▣' },
      { text: 'Aucun', phrase: 'aucun', icon: '□' },
    ],
  },
  {
    title: 'Vue',
    buttons: [
      { text: 'Perspective', phrase: 'vue iso', icon: '◇' },
      { text: 'Dessus', phrase: 'vue dessus', icon: '⊙' },
      { text: 'Face', phrase: 'vue face', icon: '▭' },
      { text: 'Côté', phrase: 'vue droite', icon: '▯' },
      { text: 'Zoom +', phrase: 'zoom avant', icon: '+' },
      { text: 'Zoom −', phrase: 'zoom arrière', icon: '−' },
    ],
  },
];

const STEPS = [1, 5, 10];

export function buildToolbar(root: HTMLElement, commandBar: CommandBar): void {
  let step = 5;

  for (const section of SECTIONS) {
    const box = document.createElement('section');
    box.className = 'tool-section';
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    box.append(heading);

    if (section.title === 'Déplacer') box.append(buildStepPicker());

    const grid = document.createElement('div');
    grid.className = 'tool-grid';
    for (const spec of section.buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool';
      button.innerHTML = `<span class="icon" aria-hidden="true">${spec.icon ?? ''}</span><span class="text"></span>`;
      button.querySelector('.text')!.textContent = spec.text;
      const phraseFor = () => (typeof spec.phrase === 'function' ? spec.phrase(step) : spec.phrase);
      const refreshTitle = () => (button.title = `Dire : « ${phraseFor()} »`);
      refreshTitle();
      button.addEventListener('pointerenter', refreshTitle);
      button.addEventListener('click', () => commandBar.runPhrase(phraseFor()));
      grid.append(button);
    }
    box.append(grid);
    root.append(box);
  }

  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'tool tool-wide';
  help.innerHTML = '<span class="icon" aria-hidden="true">?</span><span class="text">Aide</span>';
  help.addEventListener('click', () => commandBar.runPhrase('aide'));
  root.append(help);

  function buildStepPicker(): HTMLElement {
    const picker = document.createElement('div');
    picker.className = 'step-picker';
    picker.setAttribute('role', 'radiogroup');
    picker.setAttribute('aria-label', 'Pas de déplacement');
    for (const value of STEPS) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'step';
      option.textContent = `${value} mm`;
      option.setAttribute('role', 'radio');
      const sync = () => option.setAttribute('aria-checked', String(value === step));
      sync();
      option.addEventListener('click', () => {
        step = value;
        picker.querySelectorAll<HTMLButtonElement>('.step').forEach((b) => b.setAttribute('aria-checked', String(b === option)));
        commandBar.focus();
      });
      picker.append(option);
    }
    return picker;
  }
}
