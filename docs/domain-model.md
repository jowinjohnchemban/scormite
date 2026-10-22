# Domain model

The core entities and which part of the code owns each. Entities used by
more than one feature are typed in `src/shared/types/` (one file per
entity group, re-exported from its `index.ts`); the rest are typed inside
their owner. This table answers "who owns this?" — the `.ts` file is the
source of truth for fields.

| Entity                         | Owning feature                                  | Notes                                                                                                                     |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Package`                      | `package-loader`                                | Loaded ZIP, detected SCORM version and edition, manifest                                                                  |
| `Manifest`                     | `manifest`                                      | Parsed `imsmanifest.xml` tree                                                                                             |
| `ApiCallRecord`                | `runtime`                                       | One scorm-again API call, recorded by middleware                                                                          |
| `CmiSnapshot`                  | `timeline`                                      | Full CMI tree at a point in time, for the CMI History panel and the report                                                |
| `ValidationIssue`              | `validation`                                    | Static or runtime validation finding                                                                                      |
| `Breakpoint`                   | `session`                                       | Hold condition on a SetValue / Commit (API method, element, value, score threshold, objective update)                     |
| `FileTreeNode`                 | `package-loader`                                | Package file-tree node (path, name, children, isLaunchFile)                                                               |
| `NetworkEntry`                 | `player`                                        | One SW `FETCH_EVENT` (path, cache hit/miss, status, duration ms)                                                          |
| `LaunchableItem`               | `manifest` (type in `shared/types/manifest.ts`) | Organization item with a launchable resource: identifier, title, depth, launch path (parameters applied), launch data     |
| `ManifestItemLaunchData`       | `manifest` (type in `shared/types/manifest.ts`) | Per-item data an LMS seeds into the runtime (launch data, mastery score, time limit, completion threshold, passing score) |
| `AttemptRecord`                | `runtime`                                       | scorm-again's terminate-commit payload for one SCO attempt; restored on relaunch                                          |
| `NavigationRequestEvent`       | `runtime`                                       | A SCORM 2004 `adl.nav.request` raised at Terminate (request + optional target)                                            |
| `SessionSnapshot`              | `app/course`                                    | Saved progress of one package: attempts, progress, current item, sequencing state                                         |
| `LearnerInfo`                  | `learner` (type in `shared/types/learner.ts`)   | Learner ID and name reported to courses                                                                                   |
| `CmiSummary`                   | `app/course`                                    | Completion, success, score, location, time — normalized across SCORM 1.2 and 2004                                         |
| `LaunchRequest` / course state | `app/state/courseStore`                         | Items, current item, per-item progress, pending launch                                                                    |

## Ownership rule

Only the owner constructs or mutates an entity. Features never import each
other (see [Development](development.md#rules-the-build-enforces)): other
features share the entity's _type_ from `src/shared/types/`, and the app
layer (`src/app/`) passes instances between features and populates each
feature's store.
