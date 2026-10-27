import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { Editor } from './core/editor';
import { CommandBar } from './ui/commandBar';
import { buildToolbar } from './ui/toolbar';
import { Viewport } from './view/viewport';

const editor = new Editor();
const commandBar = new CommandBar(document.querySelector<HTMLElement>('#command-bar')!, editor);

// Un clic sur une forme passe par la même phrase qu'à la voix, avec le même retour.
new Viewport(document.querySelector<HTMLElement>('#viewport')!, editor, (id, additive) => {
  if (id === null) return commandBar.runPhrase('aucun');
  if (!additive) return commandBar.runPhrase(`sélectionner ${id}`);
  editor.toggleSelection(id);
  commandBar.focus();
});
buildToolbar(document.querySelector<HTMLElement>('#toolbar')!, commandBar);

// Raccourcis clavier, actifs quand le champ de commande est vide.
window.addEventListener('keydown', (event) => {
  if (!commandBar.isEmpty) return;
  const ctrl = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  let phrase: string | null = null;
  if (ctrl && key === 'z' && !event.shiftKey) phrase = 'annuler';
  else if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) phrase = 'rétablir';
  else if (event.key === 'Delete') phrase = 'supprimer';
  if (phrase) {
    event.preventDefault();
    commandBar.runPhrase(phrase);
  }
});

commandBar.focus();

// Met l'appli en cache pour qu'elle marche sans connexion.
registerSW({ immediate: true });
