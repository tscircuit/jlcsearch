 Le format est standard pour les livrables professionnelles. L'utilisateur doit être capable de se connecter à la base de données et d'appliquer le script. Il doit avoir des outils d'administration (ex: SQL, Python, PostgreSQL) pour manipuler les données.

La solution doit être complète : il faut inclure :
- Le code SQL pour créer la colonne
- Une documentation claire pour le processus d'application
- Des exemples de sortie pour illustrer le fonctionnement du script

Le système de validation doit être intégré dans le code pour vérifier si les valeurs sont correctes (ex: ne pas ajouter des données avec `is_extended_promotional` = "true" si le filtre n'indique pas "true")

Pourquoi? parce que c'est la base pour les prix (ex: les prix sont basés sur la longueur du nom de l'entreprise et la durée du délai) et pour le système de gestion des ventes (ex: les prix sont basés sur le nombre d'unités et le délai)

Références: https://www.algora.com

L'utilisateur doit avoir accès à un logiciel de base de données de base (ex: PostgreSQL) pour exécuter le script

La solution doit être fonctionnelle : il ne faut pas avoir d'erreur ou de problèmes de syntaxe

---

**Livrable : "Add `is_extended_prom