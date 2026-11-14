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
- `src/components/PracticeWorkspace.tsx` contains the clearly labeled demo-only Monaco exercise and pattern checks; `src/components/TutorPanel.tsx` is the shared mock tutor across Explorer, Learn, and Practice.
- Navigation is repository-first: Overview, Explorer, Learn, Practice, Progress, Settings. Keep imported source read-only, and distinguish generic sample activities from repository-generated learning.

## Repository intelligence v1

- `electron/intelligence.ts` extracts TypeScript/JavaScript symbols using the existing TypeScript parser and conservative C++ declarations/includes using explicit pattern checks. Treat C++ results as incomplete, not a semantic AST.
- `electron/main.ts` validates repository roots before the restricted `index:*` IPC handlers. Never permit arbitrary paths or unbounded queries through preload.
- `electron/database.ts` saves each successful index in one transaction; symbol records and source hashes live in SQLite. `src/components/SymbolExplorer.tsx` provides search and source navigation in the Explorer file panel.
- Indexing is explicitly initiated by the user. Respect scanner symlink/exclusion rules and keep indexed files read-only. Limits: 1500 files, 256 KiB per file, 20000 symbols.
- Keep new index tests in `tests/intelligence.test.ts` and persistence tests in `tests/database.test.ts`.
