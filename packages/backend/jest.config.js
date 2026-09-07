/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // The workspace-linked @hotel-comparator/shared package resolves through
  // node_modules (npm workspaces symlink it there); Jest's default
  // transformIgnorePatterns would skip transforming it since it's raw
  // TypeScript with no build step. Carve out an exception for it.
  transformIgnorePatterns: ['/node_modules/(?!@hotel-comparator)'],
  testTimeout: 30000,
};
