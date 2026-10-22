# features/package-loader

ZIP ingestion (including packages zipped one folder deep), drag and drop,
SCORM version / manifest detection, and the Files panel (`PackageExplorerPanel`).

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`package-loader/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
