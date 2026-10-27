# Babiole : consignes pour les contributions

- L'utilisateur principal est tétraplégique et pilote par Dragon (voix) et une Tobii (regard).
  Toute nouvelle fonction doit être utilisable par une phrase dans la barre de commande
  (`src/core/parser.ts`) et par un bouton d'au moins 76 px, sans glisser-déposer.
- Interface, messages et commentaires en français.
- Toute modification de la scène passe par une `Command` (`src/core/history.ts`) pour
  qu'« annuler » fonctionne.
- `src/core/` ne dépend pas de Three.js et est couvert par des tests Vitest.
- Avant de proposer un changement : `npm test` et `npm run build`.
