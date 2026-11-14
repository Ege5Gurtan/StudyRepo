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

## Adaptive AI learning sessions (experimental)

Import a repository and open **Practice**. Write your learning goal in the AI Tutor chat, such as "I want to learn JavaScript functions from this project. I am a beginner." StudyRepo selects a few relevant source snippets (up to three files), asks the configured OpenAI model to propose a small topic sequence, and creates a standalone challenge based on repository code. The explanation includes clickable references to verified source lines.

Write code in the editable scratchpad and select **Evaluate my solution** for an AI-only review (no compilation or runtime). After an AI review passes, choose a similar challenge or the next topic. The Tutor remains available for questions throughout the exercise.

**Limitations:** Lessons are generated dynamically and can be inaccurate. The repository retrieval is heuristic, not a complete semantic understanding of the codebase. This first version retains the learning session only while the app is open; it does not yet persist exercises or conversations. Imported repository files remain read-only. Learning requests transmit bounded snippets to OpenAI and may incur API charges. Source candidates are restricted to recognized code extensions and exclude common secret and credentials paths; review repository contents before using cloud AI with sensitive projects.

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
