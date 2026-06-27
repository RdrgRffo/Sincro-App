import { mockReset } from 'jest-mock-extended';
import { prismaMock } from './singleton';

beforeEach(() => {
  mockReset(prismaMock);
});
