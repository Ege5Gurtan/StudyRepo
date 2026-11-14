# Contributor and agent guide

## Architecture

- `electron/main.ts` owns the desktop window and IPC handlers; `electron/preload.ts` exposes only the typed operations in `src/shared/types.ts`. Keep context isolation and sandboxing enabled and Node integration disabled in the renderer.
- `electron/repository.ts` scans and reads repositories without writing to them. Validate paths and continue excluding generated files and symbolic links.
- `electron/database.ts` stores local repositories and learning activity in SQLite under Electron's user-data directory.
- `src/` contains the React interface, mock AI provider, and shared quiz logic. Provider implementations should conform to `src/ai/provider.ts`; quiz answers must be validated in the main process before saving.
- `tests/` covers repository boundaries, study scoring, persistence, and UI components.

## Conventions

Use TypeScript, small modules, and explicit typed interfaces across process boundaries. Keep imported repositories read-only and never expose generic filesystem or IPC access to the renderer. Avoid requiring credentials, network access, or native modules for the basic experience. Document new limitations and architectural changes in the README and this guide.

## Verification

For changes, run the relevant tests and `npm run lint`, `npm run typecheck`, and `npm run build`. Add focused tests for new behavior and security boundaries. Do not commit generated output, dependencies, secrets, or local user data.

## Unified desktop UI

- The Electron renderer under `src/` is the sole application shell. `prototypes/practice/` remains historical reference material, not a second navigation or production entry point.
- `src/components/PracticeWorkspace.tsx` contains the clearly labeled demo-only Monaco exercise and pattern checks; `src/components/TutorPanel.tsx` is a real OpenAI-backed tutor used in Explorer and Practice.
- Navigation is repository-first: Overview, Explorer, Practice, Settings. Keep imported source read-only, and distinguish generic sample activities from repository-generated learning.

## Repository intelligence v1

- `electron/intelligence.ts` extracts TypeScript/JavaScript symbols using the existing TypeScript parser and conservative C++ declarations/includes using explicit pattern checks. Treat C++ results as incomplete, not a semantic AST.
- `electron/main.ts` validates repository roots before the restricted `index:*` IPC handlers. Never permit arbitrary paths or unbounded queries through preload.
- `electron/database.ts` saves each successful index in one transaction; symbol records and source hashes live in SQLite. `src/components/SymbolExplorer.tsx` provides search and source navigation in the Explorer file panel.
- Indexing is explicitly initiated by the user. Respect scanner symlink/exclusion rules and keep indexed files read-only. Limits: 1500 files, 256 KiB per file, 20000 symbols.
- Keep new index tests in `tests/intelligence.test.ts` and persistence tests in `tests/database.test.ts`.

## Practice-first AI and safe removal

- `electron/tutor.ts` performs OpenAI Responses requests only in the Electron main process; access API keys from environment only. Validate and bound all context and history arriving through `tutor:ask`. Use `store: false` and do not include arbitrary files from the imported repository.
- `src/components/TutorPanel.tsx` shows genuine responses and error states; never claim C++ pattern checks are compiler results. AI context is current code plus recent conversation, not the whole repository.
- `repositories:remove` removes only application SQLite records in one transaction after the user confirms; it never deletes repository files. Keep existing records of other repositories intact.
- Preserve the pre-existing database tables for backward compatibility even though the Progress and Learn screens are removed.

## Adaptive learning v1

- `electron/learning.ts` owns bounded repository snippet selection and structured Responses API calls for lessons and code reviews. Use `readRepositoryFile` to enforce path boundaries. Only known source extensions qualify; exclude sensitive filenames and directories.
- The Electron main process validates imported repository roots for `learning:generate` and `learning:evaluate`. Keep model API keys server-side and `store: false`.
- `LearningWorkspace.tsx` renders the planned topics, verified source links, Monaco scratchpad, and AI evaluation. The chat in `TutorPanel.tsx` starts a learning session from the student's first prompt and remains available during a challenge.
- Session state is currently in React memory, not persisted. Never treat AI review as real compilation. Keep tests for retrieval, references, input bounds and structured API results in `tests/learning.test.ts`.

## Saved challenge history

- `src/study/history.ts` owns pure immutable history operations: append, select, change draft, record reviewed submissions, and mark skipped challenges. A separate history is saved per imported repository.
- `electron/database.ts` uses the `learning_archives` SQLite table for stored history; the only renderer access is restricted `learning:history:get/save` IPC, guarded by imported-repository validation and archive size/shape limits. Repository removal deletes its archive, never source files.
- In Practice, navigating backwards/forwards must restore code and review feedback for the selected challenge. Keep previous attempts immutable; allow users to restore an earlier attempt into the scratchpad without silently overwriting history.
- Do not make AI approval a requirement for moving on: users may skip to the next topic. Older challenges remain accessible, and new learning goals do not wipe saved history.
