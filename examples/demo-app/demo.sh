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

# Create a temporary change to the Button component
echo "Making a change to components/Button.tsx..."
sed -i.bak 's/bg-blue-500/bg-blue-600/g' components/Button.tsx
echo "✓ Changed button color from blue-500 to blue-600"
echo ""

echo "Step 2: Running route-impact analysis"
echo "---------------------------------------"
echo ""

# Run route-impact on working tree changes
node ../../dist/cli.js analyze \
  --working-tree \
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
  --working-tree \
  --format json \
  --output route-impact-report.json \
  --config route-impact.config.json

echo "✓ Analysis with dynamic route expansion complete!"
echo ""

echo "Affected routes (JSON):"
cat route-impact-report.json | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(JSON.stringify(data.affectedRoutes.map(r => r.route), null, 2));"
echo ""

# Restore the original file
mv components/Button.tsx.bak components/Button.tsx
echo "✓ Restored original Button.tsx"
echo ""

echo "============================================"
echo "Demo Complete!"
echo "============================================"
echo ""
echo "Summary:"
echo "- Modified shared component (Button.tsx)"
echo "- route-impact detected all affected routes"
echo "- Reports saved to route-impact-report.md and .json"
echo ""
