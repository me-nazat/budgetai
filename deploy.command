#!/bin/bash
cd "/Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  " || exit

echo "Deploying updates to budgetai repository..."

git add .
git commit -m "feat: complete Tour Budget Manager overhaul

- Fix modal layout collisions and center alignments
- Fix SWR optimistic update causing Balances component glitch
- Implement Edit Tour Details feature with participant validation
- Implement Dynamic Join Tour System with code ingestion and inline profile selection"

git push origin main

echo ""
echo "✅ Deployment complete! You can close this window."
