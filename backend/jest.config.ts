import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/test/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/config/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    '!src/modules/**/*.http.schemas.ts',
    '!src/modules/**/*.types.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/test/config/tsconfig.json',
    }],
  },
};

export default config;
