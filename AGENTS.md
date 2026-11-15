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

## Continuing lessons and chat-triggered practice

- A generated learning plan contains only a short set of topics, not the lifetime of a learning journey. On the final topic, `advanceLearning` starts `extend` mode to generate a fresh set of topics and the first challenge in that set.
- Direct requests such as "Give me another set of challenges" should create structured Practice challenges through `generateLesson` rather than a text-only list. The explicit chat intent helper lives in `src/study/chat-intent.ts`; keep ordinary tutoring questions conversational.
- Maintain both student and assistant turns in `TutorPanel` when resolving async responses. `src/study/chat-messages.ts` contains immutable operations; tests guard against lost user messages.
- Per-repository challenge history persists across batches; retain source protections, output validation and storage limits. Do not claim unlimited storage or runtime compilation.

## Conversation history and isolation

- `src/study/conversations.ts` stores per-repository conversations as distinct `LearningArchive` objects. A conversation owns its chat messages, generated challenges, code drafts and evaluations; never reuse another conversation's archive after navigation.
- `electron/database.ts` keeps the multi-conversation JSON store in `conversation_stores` with restricted `conversations:get/save` IPC; it automatically migrates the old `learning_archives` row to one conversation without deleting its original data.
- Switching chats changes the active ID and invalidates pending lesson/evaluation results. Scope asynchronous chat callbacks to a stable conversation ID, and keep active edits and stored messages isolated.
- **New chat** makes a separate empty conversation, rather than clearing the prior conversation. Renaming and deleting operate only on the selected conversation. Never delete repository source files.

## Structured chat-to-challenge orchestration

- `electron/tutor-actions.ts` requests the restricted OpenAI `generate_challenge` function in Practice. Model text remains a normal answer; validated tool calls are executed by application code, never by model-authored code.
- A call with `scope=single` uses focused learning mode to create one repository-derived exercise. `scope=set` creates the first exercise of another short learning set. Both use the existing conversation archive and stale-response guards.
- Tool calls must not permit arbitrary filesystem writes, execution, or unvalidated action names. Maintain regression tests for challenge actions and normal tutor replies.

## Rich Tutor Markdown

- `src/study/rich-text.ts` normalizes legacy escaped paragraph separators, parses GFM via `marked`, and supplies a limited native MathML implementation.
- `src/components/RichTutorMessage.tsx` sanitizes model-generated HTML using DOMPurify. Monaco syntax colorization applies only to inert fenced code blocks. Copy actions are user-initiated; never execute code from the model or navigate to untrusted links in Electron.
- Keep all assistant responses as their original text in the conversation archive; formatting is a display concern. Existing tool-calling and conversation/challenge history must remain unchanged.

## Persistent Tutor and named-file retrieval

- The app renders one persistent `TutorPanel` for its current repository/conversation outside page-conditional content. Hide it on Overview/Settings without unmounting it. Preserve in-flight replies when switching workspace tabs.
- `electron/tutor-source.ts` resolves explicitly requested source filenames against the imported repository tree, protects private paths, retrieves via `readRepositoryFile`, and provides bounded line-numbered excerpts. Truncated excerpts must be labeled, and line ranges can be requested in later messages. Never claim to have inspected omitted lines.
- Existing normal Tutor and structured-challenge action routes both receive named-file context. Avoid shipping the full repository to a provider; keep bounded, opt-in source retrieval.

## In-flight conversation isolation

- The app-level `sendConversationMessage` owns asynchronous Tutor requests, not a `TutorPanel` tied to a selected conversation. Use the initiating repository path and immutable conversation ID for every response and generated challenge.
- Keep pending state indexed by repository and conversation; switching chats must not cancel work or update a different conversation. `appendConversationMessage` updates only a matching saved ID and ignores replies to deleted conversations.
- Chat persistence remains the existing SQLite conversation archive, and rehydrated conversations need not retain transient Thinking states after application exit.

## Interactive Tutor learning blocks

- `src/study/lesson-blocks.ts` parses bounded, strongly validated `studyrepo-quiz` and `studyrepo-diagram` fenced JSON. Invalid blocks fall back to Markdown; do not interpret generated JSX, HTML, SVG, CSS or scripts.
- `src/components/TutorLessonContent.tsx` renders only predefined React quiz and generic node/edge diagram widgets and delegates ordinary Markdown to `RichTutorMessage` for sanitization and highlighting.
- `electron/tutor.ts` shares structured teaching guidance with the action route. Keep model tools for actual coding challenges separate from ungraded quiz widgets. Preserve chat persistence and source-file links.
