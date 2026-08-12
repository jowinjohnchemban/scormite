import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'test-results', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/*' },
        { type: 'feature', pattern: 'src/features/*', capture: ['featureName'] },
        { type: 'shared', pattern: 'src/shared/*' },
        { type: 'components', pattern: 'src/components/*' },
      ],
      'boundaries/files': [],
      'import/resolver': {
        typescript: { project: './tsconfig.app.json' },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // ---- Architectural boundary rules ----
      // 1. Only the runtime feature may import scorm-again. Every other
      //    feature must go through features/runtime's public surface.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'scorm-again',
              message:
                'Only src/features/runtime may import scorm-again directly. ' +
                'Import the adapter from "@/features/runtime" instead.',
            },
          ],
        },
      ],

      // 2. Feature-to-feature imports are only allowed for the same
      //    feature (its own internals) or via app/shared/components. This
      //    stops one feature from reaching into another's internals; the
      //    "only import a sibling feature's index.ts barrel" part of the
      //    rule (see each feature's README.md) is a reviewed convention
      //    rather than something this version of the plugin can express
      //    as a single declarative policy -- revisit if the plugin adds a
      //    barrel-only selector.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'feature' } },
              allow: { to: { element: { types: { anyOf: ['shared', 'components'] } } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: {
                  element: { type: 'feature', captured: { featureName: '{{ featureName }}' } },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { types: { anyOf: ['app', 'feature', 'shared', 'components'] } } } },
            },
            {
              from: { element: { type: 'components' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
          ],
        },
      ],
    },
  },
  {
    // The runtime feature is the sole exception to the scorm-again ban.
    files: ['src/features/runtime/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // shadcn/ui components conventionally co-export a `*Variants` cva
    // helper alongside the component itself, which react-refresh's
    // single-export-per-file rule flags. This is the accepted shadcn
    // pattern, not a bug -- silence it for this folder only.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Declaration files conventionally use `any` — e.g. `src/test/vitest-axe.d.ts`
    // must redeclare `Assertion<T = any>` with the exact type parameter list of
    // the interface it merges with, or the module augmentation fails to apply.
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Empty `interface X extends SingleType {}` is the idiomatic module
      // augmentation shape (jest-dom uses the same); the type parameter is
      // required to match the merged interface's parameter list even though
      // the body is empty.
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Vitest tests use the framework's globals (describe/it/expect/vi).
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },
  prettierConfig,
)
