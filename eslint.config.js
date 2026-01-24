import eslintjs from '@eslint/js';
import tseslint from 'typescript-eslint';
import {defineConfig} from 'eslint/config';

export default defineConfig([
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {
      eslint: eslintjs,
      typescript: tseslint
    },
    languageOptions: {
      parserOptions: {
        projectService: true
      },
      globals: {
        console: 'readonly'
      }
    },
    extends: [
      eslintjs.configs.recommended,
      tseslint.configs.strict
    ],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
]);
