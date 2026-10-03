#!/usr/bin/env bash
set -e

echo "============================================"
echo "Route Impact Demo"
echo "============================================"
echo ""

# Initialize git if not already done
if [ ! -d ".git" ]; then
  git init
  git add .
  git commit -m "Initial commit"
  echo "✓ Git repository initialized"
  echo ""
fi

# Make sure route-impact is built and available
if [ ! -f "../../dist/cli.js" ]; then
  echo "Building route-impact..."
  cd ../..
  npm run build
  cd examples/demo-app
  echo "✓ route-impact built"
  echo ""
fi

echo "Step 1: Showing current routes"
echo "--------------------------------"
echo ""

# Create a feature branch
git checkout -b feature/update-pages

# Create changes to multiple pages
echo "Making changes to pages..."
echo "// Updated on $(date)" >> app/page.tsx
echo "// Updated on $(date)" >> app/blog/page.tsx
echo "// Updated on $(date)" >> app/blog/[slug]/page.tsx
echo "✓ Updated home page, blog index, and blog post pages"
echo ""

# Commit the changes
git add app/
git commit -m "Update pages with timestamp comments"
echo "✓ Committed changes"
echo ""

echo "Step 2: Running route-impact analysis"
echo "---------------------------------------"
echo ""

# Run route-impact comparing master to feature branch
node ../../dist/cli.js analyze \
  --base master \
  --head feature/update-pages \
  --format markdown \
  --output route-impact-report.md

echo ""
echo "✓ Analysis complete!"
echo ""

echo "Step 3: Viewing the report"
echo "---------------------------"
echo ""
cat route-impact-report.md
echo ""

echo "Step 4: Expanding dynamic routes"
echo "----------------------------------"
echo ""

node ../../dist/cli.js analyze \
  --base master \
  --head feature/update-pages \
  --format json \
  --output route-impact-report.json \
  --config route-impact.config.json

echo "✓ Analysis with dynamic route expansion complete!"
echo ""

echo "Affected routes (JSON):"
cat route-impact-report.json | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(JSON.stringify(data.affectedRoutes.map(r => r.route), null, 2));"
echo ""

# Clean up
git checkout master
git branch -D feature/update-pages
echo "✓ Cleaned up feature branch"
echo ""

echo "============================================"
echo "Demo Complete!"
echo "============================================"
echo ""
echo "Summary:"
echo "- Modified multiple page files"
echo "- route-impact detected all affected routes"
echo "- Reports saved to route-impact-report.md and .json"
echo ""
