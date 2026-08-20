# Quiz d'art — mode d'emploi

Une application locale, sans installation, pour réviser des œuvres d'art à partir d'un fichier Excel.

## Lancer l'application

1. Ouvrez le fichier `index.html` dans votre navigateur (double-cliquez dessus).
2. Cliquez sur **Importer / remplacer un fichier**.
3. Sélectionnez votre fichier `.xlsx`, `.xls` ou `.csv`.

L'application lit le premier onglet du fichier. Une connexion Internet est nécessaire à l'ouverture afin de lire les fichiers Excel.

## Préparer le fichier Excel

La première ligne doit contenir ces cinq en-têtes (les majuscules et accents ne sont pas importants) :

| image | artiste | date de création | lieu de conservation | titre de l’œuvre |
|---|---|---|---|---|
| https://…/mon-image.jpg | Nom de l'artiste | 1889 | Nom du musée, ville | Titre de l'œuvre |

- La colonne **image** peut contenir une URL d'image publique ou le nom d'un fichier image (par exemple `01-delacroix.jpg`). Dans ce second cas, cliquez aussi sur **Importer le dossier d'images** et choisissez le dossier contenant ces fichiers. Les images simplement collées dans une cellule Excel ne peuvent pas être lues par un navigateur.
- Les réponses sont comparées sans tenir compte des majuscules, accents, espaces ou ponctuation. Pour une réponse exacte, renseignez la même information que dans le fichier.
- Le fichier `exemple-quiz.csv` sert de modèle : vous pouvez l'ouvrir avec Excel, le compléter et l'enregistrer au format `.xlsx`.

## Fonctionnalités

- import ou remplacement du fichier à tout moment ;
- affichage d'une œuvre à la fois ;
- correction par champ après validation ;
- conservation des réponses et navigation précédente/suivante ;
- score final sur quatre points par œuvre ;
- acceptation des réponses partielles significatives (par exemple « Monet » pour « Claude Monet » et « Orsay » pour « Musée d'Orsay, Paris »).
