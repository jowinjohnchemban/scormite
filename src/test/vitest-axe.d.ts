/**
 * Vitest 4 type augmentation for the vitest-axe `toHaveNoViolations` matcher.
 *
 * vitest-axe 0.1.0 ships its own `extend-expect.d.ts`, but it augments the
 * `global { namespace Vi { interface Assertion } }` shape that vitest removed
 * years ago, so the matcher never type-checks on `expect(...)`. vitest 4
 * exposes the assertion types through the `vitest` module itself (the same
 * pattern @testing-library/jest-dom uses), so we redeclare the interfaces
 * here. The `T = any` default must match the original declaration exactly or
 * the interface merge fails; `no-explicit-any` is disabled for `.d.ts` files
 * in eslint.config.js for this reason.
 */
import type { AxeMatchers } from 'vitest-axe/dist/matchers'

declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
