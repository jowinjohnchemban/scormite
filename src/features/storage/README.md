# features/storage

Inspection of the browser storage that Scormite actually uses: Cache Storage
(package files served by the service worker) and localStorage (dock layout,
settings).

Scormite never touches IndexedDB — the "IndexedDB contents" from the
Milestone 14 exit criteria maps to the Cache Storage buckets
(`scormite-pkg-{sessionId}`) where package data really lives, plus the
localStorage keys, plus `navigator.storage.estimate()` for the global
usage/quota figures.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`storage/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
