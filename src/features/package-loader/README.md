# features/package-loader

ZIP ingestion (including packages zipped one folder deep), drag and drop,
SCORM version / manifest detection, and the Files panel (`PackageExplorerPanel`).

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
