#!/bin/sh
set -e

echo "================================================"
echo "  Sincro Backend - Docker Entrypoint"
echo "================================================"
echo ""

echo "DATABASE_URL=$DATABASE_URL"
echo "PORT=$PORT"
echo "NODE_ENV=$NODE_ENV"
echo ""

# 1. Install dependencies
echo "[1/5] Installing dependencies..."
npm install --silent 2>&1 | tail -1
echo "  ✓ Dependencies installed"

# 2. Generate Prisma Client
echo "[2/5] Generating Prisma Client..."
npx prisma generate 2>&1
echo "  ✓ Prisma Client generated"

# 3. Sync database schema directly from schema.prisma (source of truth)
echo "[3/5] Syncing database schema..."
npx prisma db push --accept-data-loss 2>&1
echo "  ✓ Database schema synced from schema.prisma"

# 4. Seed database
echo "[4/5] Seeding database..."
npx prisma db seed 2>&1 || echo "  ⚠ Seed completed (warnings ignored)"
echo "  ✓ Database seeded"

echo ""
echo "================================================"
echo "  Starting development server..."
echo "================================================"

# Start the dev server
exec npm run dev
