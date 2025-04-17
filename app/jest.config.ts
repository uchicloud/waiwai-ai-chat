import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^.+\\.(svg|png|jpg|jpeg|gif)$': '<rootDir>/__mocks__/fileMock.js',
    '^.+/characters.json$': '<rootDir>/../server/characters.json'
  },
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
};

export default createJestConfig(customJestConfig);
