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

## Tutor answer depth

- Ordinary and tool-enabled Tutor answers share `TUTOR_TEACHING_GUIDANCE` and output limits from `electron/tutor.ts`.
- History validation distinguishes brief user prompts from lengthy assistant lessons. Cap prior assistant context sent to the model, preserve bounded request validation, and continue redacting secrets.
- Longer explanations consume more tokens; do not interpret response length as evidence of source coverage.

### Additional visual lesson schemas

`studyrepo-steps` contains a bounded array of titled steps and descriptions; `studyrepo-memory` contains bounded named values and explanatory notes. Render them with predefined React controls and reject excessive or malformed data. The AI should select based on learning concept, not repository identity. No model-authored markup or executable code.

## AI Tutor reading layout

- The expanded reading mode is App-level state passed into `TutorPanel`, not a distinct chat route or another Tutor instance. Existing pending requests, chat persistence and challenge links must keep working while toggling.
- `src/style.css` expands the panel over the existing workspace, with an accessible return-to-code control. Never unmount Monaco or reset conversation history merely to change widths.

## Explanation-first tutoring and mixed activities

- A first general learning prompt goes through the normal Tutor action route with bounded, allowlisted source samples, not automatic `generateLesson`. Only explicit coding-challenge requests can call the challenge tool; multiple-choice requests must remain conversational.
- `LearningArchive.entries` stays the legacy coding-challenge store; `LearningArchive.activities` is an optional typed array of persisted `MultipleChoice` activities. Never break legacy archives or silently generate coding challenges for each prompt.
- `appendTutorReplyWithActivities` parses validated quiz blocks, attaches stable quiz IDs to the assistant message and records them atomically. `setQuizAnswer` persists choices independently of coding challenge evaluations.
- `LearningActivityHistory` combines both kinds chronologically and provides navigation. Keep chat links and in-flight conversation isolation intact; do not treat model-authored code or source as executable instructions.

## Tutor rendering and source quality

- `RichTutorMessage` inserts code toolbars inside React effects; remove existing toolbars and detach new toolbars in the effect cleanup. React StrictMode repeats effects, so rendering must not accumulate duplicate `cpp`/Copy rows.
- `sourceCandidates` excludes generated Unreal artifacts and build-output directories; C++ learning queries should prioritize `.cpp` and headers over Unreal `.Target.cs` / `.Build.cs` rules. Explicit named-file retrieval remains separately bounded and protected.

## Read-only agentic source retrieval

- `electron/tutor-retrieval.ts` exposes bounded search_code, find_symbol, and read_source model tools to Practice and Explorer. Tools use the scanner allowlist, `readRepositoryFile` security checks, secret redaction, a per-answer call/context budget, and source line references.
- Never expose arbitrary paths, writes, commands, or unfiltered file bytes. Keep model tool calls validated and replay results with `store: false`.
- Explicit challenge requests must continue to require the existing generate_challenge action, not source tools. Preserve conversation isolation, source warnings, and regression coverage in `tests/tutor-retrieval.test.ts`.

## Readable Tutor source and evidence

- Tutor fenced code tokenization must use locally controlled CSS classes, not Monaco inline colors from a mismatched editor theme. Preserve plain-text fallback and inert DOM assembly.
- Source retrieval can require an initial read-only investigation for codebase-oriented questions; discovery includes list_source_files, with bounded tool calls and source redaction.
- Only successful read_source operations are recorded in backend-generated source trace metadata. TutorPanel renders a verified file/line list linked to Explorer; existing conversation text and quiz blocks remain compatible.

## AI chat message copying

- Every user and assistant message in `TutorPanel` has an accessible Copy button. `CopyTutorMessageButton` copies original message Markdown/plain text, never rendered HTML; strip backend-only source trace metadata from copied assistant messages via `parseTutorSourceTrace`.
- Keep copy feedback local to the message, handle clipboard failures without modifying conversation history, and preserve the existing per-code-block copy controls.
