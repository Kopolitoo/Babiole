# Babiole

Logiciel de dessin 3D inspiré de Tinkercad, hors-ligne et multi-plateformes,
utilisable avec la voix ou la poursuite oculaire, pensé pour les personnes tétraplégiques.

Babiole est une application web qui fonctionne sans connexion une fois chargée
(application web progressive). Elle tourne dans n'importe quel navigateur récent
sous Windows, Linux ou macOS, et peut s'installer comme une application.

## Démarrer

Il faut [Node.js](https://nodejs.org/) 22.12 ou plus récent.

```bash
npm install
npm run dev       # serveur de développement sur http://localhost:5173
npm test          # tests unitaires
npm run build     # version finale dans dist/
npm run preview   # sert dist/ sur http://localhost:4173 (mode hors-ligne actif)
```

Le mode hors-ligne ne fonctionne qu'avec la version finale (`build` puis `preview`).
Après une première visite, la page se recharge même sans réseau. Dans Chrome ou Edge,
l'icône « Installer » de la barre d'adresse en fait une application à part entière.

## Piloter à la voix

Tout se fait depuis la barre de commande en bas de l'écran. Dictez une phrase :
avec l'**exécution automatique** cochée, une phrase comprise part toute seule après
une courte pause, sans avoir à dire « Entrée ». Une phrase incomprise reste affichée,
sélectionnée, prête à être redictée.

| Pour… | Dites |
| --- | --- |
| Créer | « cube 20 », « boîte 30 20 10 », « cylindre 10 30 » (diamètre puis hauteur), « sphère 15 » |
| Sélectionner | « sélectionner 2 », « sélectionner 1 et 3 », « tout sélectionner », « aucun » |
| Déplacer | « déplacer x 10 », « droite 5 », « avant 2 », « monter 3 », « descendre 1 » |
| Modifier | « supprimer », « annuler », « rétablir » |
| Voir | « vue dessus », « vue face », « vue droite », « vue iso », « zoom avant », « zoom arrière » |
| Enchaîner | « cube 20 puis monter 10 » |
| Aide | « aide » |

Les nombres peuvent être en chiffres ou en lettres (« vingt-deux », « deux virgule cinq »).
Les accents, majuscules et la ponctuation ajoutée par Dragon sont ignorés.

## Piloter au regard

- Chaque forme porte une grosse pastille numérotée : la viser la sélectionne.
- Tous les boutons font au moins 76 pixels et sont bien espacés.
- Chaque bouton envoie la même phrase qu'à la voix ; son infobulle l'affiche.
- Aucune action n'exige de glisser-déposer.

## Organisation du code

```
src/core/       modèle et logique, sans dépendance à Three.js (testé)
  document.ts   les formes de la scène (millimètres, axe Z vers le haut)
  history.ts    commandes et annuler / rétablir
  commands.ts   ajouter, supprimer, déplacer
  parser.ts     phrase dictée → actions
  editor.ts     point d'entrée unique : texte, boutons et clics passent par ici
src/view/       rendu 3D avec Three.js
src/ui/         barre de commande et barre d'outils
tests/          tests unitaires (Vitest)
```

## Feuille de route

1. **Fondations** : scène, sélection, annuler / rétablir, barre de commande vocale, hors-ligne.
2. Formes de base complètes, redimensionner, tourner, dupliquer, aligner.
3. Groupement et trous (manifold-3d), import et export STL / OBJ, sauvegarde des projets.
4. Confort : clic par fixation du regard, raccourcis vocaux, essais avec Dragon et Tobii.

## Licence

MIT
