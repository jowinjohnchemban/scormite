# Domain Model

Canonical reference for the core entities. Implementations live under each
owning feature's `types/` folder — this file is the cross-feature index so
you don't have to hunt through 12 folders to remember the shape of
`ApiCallRecord`.

| Entity | Owning feature | Notes |
|---|---|---|
| `Package` | `package-loader` | Loaded ZIP/folder, detected SCORM version, resources |
| `Manifest` | `manifest` | Parsed `imsmanifest.xml` tree |
| `Session` | `session` | One play-through: snapshots, calls, events, breakpoints |
| `ApiCallRecord` | `runtime` | One scorm-again API call, recorded by middleware |
| `CmiSnapshot` | `session` | Full CMI tree at a point in time, for diff/replay |
| `TimelineEvent` | `timeline` | Lifecycle/CMI-change/navigation/sequencing/error event |
| `ValidationIssue` | `validation` | Static or runtime validation finding |
| `Breakpoint` | `session` | Pause condition (API call / CMI set / score / objective) |
| `RuntimeProfile` | `settings` | Named scorm-again + middleware configuration preset |
| `ScormitePlugin` | `plugins` | `{ manifest, activate(api) }` — the registration unit (module not wired into the app) |
| `PluginPanelContribution` | `plugins` | A dockable panel contributed by a plugin |
| `PluginCommandContribution` | `plugins` | A toolbar-menu command contributed by a plugin |
| `PluginValidatorContribution` | `plugins` | A runtime validation rule contributed by a plugin |
| `FileTreeNode` | `package-loader` | Package file-tree node (path, name, children, isLaunchFile) |
| `NetworkEntry` | `player` | One SW `FETCH_EVENT` (path, cache hit/miss, status, duration ms) |
| `StorageEntry` / `StorageReport` | `storage` | Cache bucket or localStorage item + full storage scan (panel not wired into the app) |
| `PerformanceMetrics` | `logging` | Aggregated API-call timings (total, avg, P95, top-5, per-method) |
| `LaunchableItem` | `manifest` (type in `shared/types/manifest.ts`) | Organization item with a launchable resource: identifier, title, depth, launch path (parameters applied), launch data |
| `ManifestItemLaunchData` | `manifest` (type in `shared/types/manifest.ts`) | Per-item data an LMS seeds into the runtime (launch data, mastery score, time limit, completion threshold, passing score) |
| `AttemptRecord` | `runtime` | scorm-again's terminate-commit payload for one SCO attempt; restored on relaunch |
| `NavigationRequestEvent` | `runtime` | A SCORM 2004 `adl.nav.request` raised at Terminate (request + optional target) |
| `CmiSummary` | `app/course` | Completion, success, score, location, time — normalized across SCORM 1.2 and 2004 |
| `LaunchRequest` / course state | `app/state/courseStore` | Items, current item, per-item progress, pending launch |

See `milestones/01-architecture-and-design.md` §4 for the full field-level shape of each
entity. As these get implemented in `types/` files, prefer linking to the
actual `.ts` file over duplicating the shape here — this table is for
"which feature owns this" lookups, not a second source of truth for fields.

## Ownership rule

Only the owning feature may construct or mutate an entity's canonical
instance. Other features read it through the owning feature's public
`index.ts` (types are fine to import broadly; the *services* that create/
mutate are not).
