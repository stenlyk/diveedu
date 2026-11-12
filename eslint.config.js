import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules', 'src/content/generated', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // calc/ a deco/ jsou čisté výpočty: nesmí záviset na UI, prohlížeči ani na aplikaci.
    files: ['calc/**/*.ts', 'deco/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-*', 'dexie', 'zustand', '**/src/**', 'katex'], message: 'calc/ a deco/ nesmí záviset na UI ani aplikaci.' }] }],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage'],
    },
  },
  {
    // Skripty a konfigurace běží v Node.
    files: ['scripts/**/*.{ts,mjs}', '*.config.{ts,js}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
);
