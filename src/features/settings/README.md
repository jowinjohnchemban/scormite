# features/settings

Runtime profiles (Strict ADL, SCORM Cloud, Moodle, etc.), app settings, and theme.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`settings/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
