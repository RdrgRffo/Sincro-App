/**
 * Prisma Seed Entry Point
 * Delegates to the modular seed runner in src/scripts/seeds.run.ts
 *
 * All seeding logic has been refactored into modular, maintainable seeds.
 * See: backend/src/scripts/seeds/ for individual seed implementations.
 *
 * Original monolithic seed.ts has been archived as seed.ts.bak
 */

import { main } from '../src/scripts/seeds.run';

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});

