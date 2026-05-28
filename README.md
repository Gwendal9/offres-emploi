# Offres Emploi

Interface de suivi des offres d'emploi collectées automatiquement via n8n.

🌐 **[Accéder à l'app](https://gwendal9.github.io/offres-emploi)**

## Stack
- **Collecte** : n8n (APEC API) → Google Sheets
- **Scoring** : GPT-4o-mini
- **Interface** : React + Vite → GitHub Pages

## Fonctionnement
1. n8n scrape APEC chaque matin à 8h (lun-ven)
2. Le LLM score et résume chaque nouvelle offre
3. L'app affiche les offres triées par score
4. Clic "Traité ✓" → met à jour le statut dans le sheet

## Infrastructure
- VPS Hetzner CX23 (n8n)
- Google Sheets (base de données)
- GitHub Pages (front)
