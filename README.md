# StudyRepo

**Understand the code you work with.**

StudyRepo is a local-first desktop application for learning by studying your own code. Explore a repository, build familiarity with its files, and practice code-reading fundamentals without an AI account.

> **Mission:** Make it easier to understand *why* a codebase works, not just *what* the code says.

## The idea

Developers often work with code they did not write themselves, including open-source projects, inherited systems, team contributions, and AI-generated implementations. StudyRepo aims to help them find a starting point, understand how a codebase fits together, and check their understanding before making changes.

StudyRepo is envisioned as a companion to your IDE, not a replacement for it. Its longer-term direction includes guided explanations, code exploration, and hands-on exercises grounded in the repository being studied.

## Features

- Import and reopen local repositories, browse a read-only source tree, and inspect symbols.
- **Remove a repository from StudyRepo** with the × control beside its name. This removes the application's local metadata, study records, and symbol index; **it never deletes files from disk**.
- **Practice-first UI:** Overview, Explorer, Practice, Settings. Selecting a repository opens Practice directly.
- Practice supports repository-grounded adaptive lessons, standalone AI-generated coding challenges, and AI-only solution review (no actual compiler).
- **Real AI Tutor:** The right-hand chat panel in Practice and Explorer sends the current code, recent conversation, and optional diagnostics to the OpenAI Responses API.
- Model configurable by environment variable. No API key is exposed to the browser renderer, committed to source, or stored in SQLite.
- Dark/light themes; source indexing remains available in Explorer.

## Enable AI Tutor

Create an API key in your OpenAI API account. The key must be available as an environment variable **before** starting StudyRepo. **Do not paste it into the app, the repository, or GitHub issues.**

Windows PowerShell (replace the placeholder locally):

```powershell
$env:OPENAI_API_KEY = "your-api-key"
$env:OPENAI_MODEL = "gpt-6-luna"  # optional
npm run dev
```

macOS / Linux:

```sh
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="gpt-6-luna"  # optional
npm run dev
```

Restart the Electron app after changing environment variables. If the key is missing, the tutor shows a configuration error when you send a message. Requests are sent directly from the main process to OpenAI; responses are not stored remotely by this integration (`store: false`) or saved as chat history locally. Current code snippets and recent chat messages **leave your computer** when you ask the tutor a question. API usage is billed separately by OpenAI.

## Recent learning conversations

Each imported repository has a **Recent Conversations** sidebar and **New chat** action. A conversation has its own AI Tutor messages and generated challenge history, including code drafts, attempts and AI evaluations. Switching chats restores the conversation's corresponding Monaco challenge and transcript; other chats stay unchanged. Chats can be renamed or deleted after confirmation.

All conversations are saved locally in SQLite and restored when you reopen the repository or restart StudyRepo. Existing users' single archived learning history is automatically migrated into one conversation on first access, without deleting the old history. Removing an imported repository also deletes its local conversations, but never touches source files.

## Saved challenge history

StudyRepo keeps an independent local history for each imported repository. Practice shows a compact challenge timeline with **Previous** and **Next** navigation. Revisiting an earlier exercise restores its latest editable draft and its AI evaluations. Expand **Submitted solutions** to view earlier submitted code snapshots and feedback, or restore a submitted version into the editor.

A student can **Skip to next topic** without passing the current challenge, including the last topic in a plan. At the end of a plan StudyRepo generates a fresh topic set. Completed, skipped, and draft challenges are marked in the timeline. **New learning goal** begins another learning sequence while retaining past challenges; previous challenges remain accessible. Session data (including Tutor conversation snippets) is saved in Electron's local SQLite database, never written into the imported repository. History continues across successive topic sets. A storage-size safeguard remains; very large archives may eventually need pruning.

## Adaptive AI learning sessions (experimental)

Import a repository and open **Practice**. Write your learning goal in the AI Tutor chat, such as "I want to learn JavaScript functions from this project. I am a beginner." StudyRepo samples a few relevant, allowlisted source files and explains useful code and concepts first. You can ask follow-up questions, request a multiple-choice check, or explicitly start a coding challenge. Source sampling is partial; the Tutor does not claim to have read the whole repository.

Write code in the editable scratchpad and select **Evaluate my solution** for an AI-only review (no compilation or runtime). After an AI review passes, choose a similar challenge or the next topic. The Tutor remains available for questions throughout the exercise. Messages such as **"Give me another set of challenges"** (or the **Generate challenges** quick action) create a new short learning plan and place its first challenge in Monaco instead of merely listing challenges in chat. Each subsequent challenge is generated when reached; ordinary questions remain conversational. Student and tutor messages are both displayed.

**Limitations:** Lessons are generated dynamically and can be inaccurate. The repository retrieval is heuristic, not a complete semantic understanding of the codebase. Learning goals, challenges, drafts, AI reviews, and recent tutor conversation are now saved locally across app restarts. Imported repository files remain read-only. Learning requests transmit bounded snippets to OpenAI and may incur API charges. Source candidates are restricted to recognized code extensions and exclude common secret and credentials paths; review repository contents before using cloud AI with sensitive projects.

## Repository intelligence v1

Open an imported repository, choose **Explorer**, and press **Analyze source** in the **Symbols** section below the file tree. Search by symbol name or source path, then select a result to open its file at the indexed line. Use **Reindex source** to refresh after repository changes. Source file hashes, symbol records, and index metadata live in the application's SQLite database, not in the repository.

## Planned capabilities

The following describe the product vision, not features already implemented.

| Area | What StudyRepo aims to offer |
| --- | --- |
| Repository explorer | Navigate source files and understand project structure. |
| Integrated code viewer | Read code with syntax highlighting and contextual explanations. |
| AI code tutor | Ask questions about functions, classes, files, and design decisions. |
| Codebase map | Visualize relationships between modules, files, and important components. |
| Learning paths | Follow a suggested sequence from foundational concepts to advanced ones. |
| Language and framework lessons | Learn syntax and concepts using examples from the selected repository. |
| Interactive exercises | Write or modify small pieces of code and receive feedback. |
| Quizzes and review | Test comprehension and revisit difficult concepts. |
| Learning progress | Track which parts of a repository and which concepts you have studied. |

## Design principles

1. **Codebase-first learning.** Teach concepts using real code from the project being studied.
2. **Learn by doing.** Prefer active practice and comprehension checks over passive explanations alone.
3. **Explain progressively.** Start with approachable concepts and reveal complexity as needed.
4. **Keep the developer in control.** Help users reason about code rather than blindly accept generated changes.
5. **Desktop-first experience.** Prioritize a comfortable workspace for extended code reading and study.
6. **Open source.** Build in public and make it possible for others to contribute.

## Technology

Electron, React, TypeScript, Vite, Tailwind CSS, Monaco Editor, and SQLite (via Node's built-in `node:sqlite`). Repository access and the database live in the Electron main process; the renderer communicates through a restricted preload API.

## Requirements and installation

- Node.js 22.12 or later (22 LTS recommended) and npm.
- Windows, macOS, or Linux with a graphical desktop. Linux also needs the system libraries required by Electron.

```sh
npm ci
```

## Development

```sh
npm run dev
```

The command builds the Electron processes, starts Vite on `127.0.0.1:5173`, and opens the desktop window. Restart it after changing main-process or preload code.

```sh
npm run lint
npm run typecheck
npm test
```

## Production build

```sh
npm run build
npm start
```

This produces local application assets in `dist/` and `dist-electron/`; it does not yet create installers or distributable packages.

## Current limitations

- Local repositories only; no GitHub integration or account is required.
- Repository analysis is read-only and ignores common generated directories and symbolic links. Files must be UTF-8 text and no larger than 2 MB. Unreadable files and directories are reported or skipped.
- Language detection is based on file extensions. File progress means a file was opened, not that its contents were mastered; deleted files can remain in history.
- AI lessons and reviews can be inaccurate and are not a substitute for compilation or tests. No code execution engine or C++ compiler is included.
- Repository intelligence v1 indexes TypeScript/JavaScript with the TypeScript syntax parser and supports **limited, heuristic C++** declarations and `#include` statements. It does not yet resolve full dependency graphs, references, overloads, macros, or semantic call relationships.
- Indexing is manual (Explorer → Analyze source / Reindex source). Index entries are snapshots; reindex after edits. It reads up to 1,500 supported source files (maximum 256 KiB each, 20,000 extracted symbols). Files skipped for size, encoding, or accessibility are counted. Repository files are never modified.
- SQLite data is stored in Electron's user-data directory, outside imported repositories. Removing an imported repository clears its local records, without touching source files. There is no data export, migration UI, or installer.

## Roadmap

Future work could add real provider integrations, repository-aware explanations and quizzes, architecture visualization, richer learning activities, and packaged releases. Priorities and implementation choices may change as the project evolves.

## Contributing

Contributions, feedback, ideas, and issue reports are welcome. Propose a focused change or feature, and open an issue or pull request describing its motivation and approach.

## License

A license has not yet been specified. An explicit license will be added before public reuse and redistribution are encouraged. Until then, standard copyright restrictions apply.

---

**StudyRepo — don't just generate code. Understand it.**

## Structured chat actions

In Practice, requests such as "create a challenge about tile mechanics" are routed through an OpenAI function call rather than answered as a plain text exercise. A single focused challenge is opened in Monaco and saved in the active conversation's history. Requests for a series start a new learning set. Ordinary questions still receive explanatory chat responses. StudyRepo validates generated actions and never allows the model to execute repository code.

## Rich AI Tutor formatting

Assistant responses in the Tutor panel now support GitHub-flavored Markdown (headings, lists, emphasis, tables, links, blockquotes), Monaco-highlighted fenced code with Copy actions, and basic mathematical notation rendered with native MathML. Unsupported TeX commands are displayed literally. Existing saved assistant messages are rendered with the new formatter, including normalization of legacy escaped paragraph breaks.

AI-generated HTML is sanitized with DOMPurify, and links are copied rather than navigating Electron to untrusted URLs. Arbitrary scripts, iframes, model-generated styles and code execution are not permitted. Interactive quizzes and sandboxed mini-apps are planned for separate milestones.

## Source-aware Tutor and navigation continuity

Ask the Tutor about a specific source file, such as `WorldManager.cpp`, to request an up-to-date, line-numbered excerpt from that actual imported file rather than relying solely on a shortened lesson summary. Bounded excerpts explicitly state when a file has more lines, and you can request a later span (for example, `Explain WorldManager.cpp lines 250-350`). Files with ambiguous names require a relative path. Files remain read-only; sensitive and excluded paths are not retrieved.

The same Tutor instance remains mounted when switching between Practice, Explorer, Overview and Settings. In-flight requests continue, and replies are stored under the current conversation, so leaving Practice does not silently discard a pending AI reply. Switching conversations or repositories remains a separate context change.

## Chat requests across conversations

LLM requests belong to the repository conversation that submitted them, even while another conversation is selected. Switching A → B during **Thinking…** leaves A's request running; when it completes, the response and any generated challenge are saved to A's history, not B's. Returning to A shows the completed response. Per-conversation pending indicators prevent duplicate sends to the same conversation while permitting activity in another. Deleting a conversation before a response arrives discards its late response. Requests still depend on the running StudyRepo desktop process: exiting the app during a request does not provide background delivery.

## Security and responsible AI use

StudyRepo blocks common credential and private-key paths in its file explorer and AI source retrieval. It also redacts recognizable API tokens, credential assignments, bearer tokens, and private-key blocks **before** sending learning or tutor requests to OpenAI. This is heuristic defense in depth, **not** a guarantee that arbitrary secrets or proprietary code cannot be transmitted. Review your repository and selected code before enabling cloud AI, and do not open repositories containing confidential material unless you are authorized to share it with your AI provider.

The OpenAI API key is read only from the Electron main-process environment; do not embed it in a source file or commit it. Local credential files are excluded by `.gitignore`, and a GitHub Actions security workflow checks Git history with Gitleaks and audits runtime dependencies with npm. You can run a local history scan with `gitleaks git --redact .` and a dependency audit with `npm audit --omit=dev --audit-level=high`.

If a credential is found in a commit, **revoke or rotate it immediately**. Deleting the file in a new commit does not remove older Git objects; coordinate history cleanup with collaborators separately. Please report newly discovered exposures privately to the maintainers instead of posting credential values in public issues.

## Interactive Tutor lessons

The Tutor can optionally embed repository-agnostic **knowledge-check quizzes** and **concept/flow diagrams** within Markdown. Validated `studyrepo-quiz` and `studyrepo-diagram` JSON blocks render through predefined React components. Diagrams model a small set of labelled nodes and relationships, suitable for explanations across many languages and repositories; the AI must ground every relationship in supplied source context. Invalid blocks fall back to inert code. There is no model-authored executable SVG, HTML, JavaScript, or arbitrary component code. These are not general image generation or code execution. Quizzes are ungraded comprehension checks separate from coding challenges.

## More detailed tutoring responses

Tutor Q&A now uses a larger response budget (3,600 output tokens) and up to 60 seconds for replies. Follow-ups accept prior longer assistant answers while bounding historical content sent to the model. Structured lesson generation also allows longer explanations. Token usage and latency may increase; generation remains constrained by available source excerpts and model behavior.

### More diagram types

Lessons can now also include validated `studyrepo-steps` (clickable execution walkthroughs) and `studyrepo-memory` (selectable values/references illustration) blocks. These work across languages and frameworks; they are conceptual educational visuals and are not live execution, actual stack/heap inspection, or image generation.

## AI Tutor reading mode

Use **Expand** in the AI Tutor header to switch from the compact code-side panel to a wider reading overlay with larger typography and more room for examples, code blocks, quizzes and diagrams. **Back to code** restores the narrow panel without discarding drafts or conversations. The code editor remains mounted behind the expanded panel; reading mode intentionally covers some of the workspace. The preference is kept in memory while the app is open.

## Explanation-first learning and activity history

StudyRepo no longer creates a coding challenge automatically when someone starts a conversation with a general learning goal. The Tutor first answers using a bounded selection of safe source excerpts, with optional knowledge-check questions. Users can explicitly ask for a coding challenge, choose the **Coding challenge** quick action, or request **Multiple choice** instead.

Comprehension quizzes are stored separately from coding challenges in the same local conversation archive. **Activities** history distinguishes `Challenge` and `MultipleChoice`, shows answer status, and supports revisiting a saved quiz. Existing challenge records and code drafts remain compatible. This first version records quiz selections; it does not grade coding ability, award points, or execute repository code.

### Source readability fixes

Code snippets now show a single language/Copy toolbar even after repeated rendering. Initial C++ teaching searches prefer handwritten C++ sources over C# build configuration and ignore generated Unreal build outputs; this does not change repository files or how explicit named-file requests work.

### Read-only repository investigation

The Practice and Explorer AI tutors can now request additional verified source context with bounded `search_code`, `find_symbol`, and `read_source` tools. Tools only search allowlisted local source files, use safe read-only file access, and return relevant source excerpts with paths and line numbers. Search is heuristic and capped per answer (four retrieval rounds, eight source tool calls); it is not a complete compiler call graph or a guarantee of full repository coverage. Code excerpts are sent to the model when requested and must be treated as potentially sensitive.

### Tutor code readability and verified source reads

Fenced source code in AI responses now uses accessible Tutor-controlled syntax colors rather than inline Monaco theme colors. For codebase exploration questions, the assistant can be required to call a read-only source-discovery tool before answering. It can list source paths, search code, and read bounded line ranges. When the assistant actually reads source ranges, a **Files inspected** expander appears below its reply with clickable file/line references. If no source was read, no such list is shown; generated explanations remain subject to model limitations.
