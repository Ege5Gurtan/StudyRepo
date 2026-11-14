# StudyRepo

**Understand the code you work with.**

StudyRepo is a local-first desktop application for learning by studying your own code. Explore a repository, build familiarity with its files, and practice code-reading fundamentals without an AI account.

> **Mission:** Make it easier to understand *why* a codebase works, not just *what* the code says.

## The idea

Developers often work with code they did not write themselves, including open-source projects, inherited systems, team contributions, and AI-generated implementations. StudyRepo aims to help them find a starting point, understand how a codebase fits together, and check their understanding before making changes.

StudyRepo is envisioned as a companion to your IDE, not a replacement for it. Its longer-term direction includes guided explanations, code exploration, and hands-on exercises grounded in the repository being studied.

## Features

- Import and reopen local folders, browse a collapsible tree, and view UTF-8 source in a read-only Monaco editor with tabs.
- See extension-based language counts, file counts, recently opened files, and file-based learning progress.
- Request a clearly labeled mock explanation for selected lines; no code is sent to an AI service.
- Use a unified repository-first navigation: Overview, Explorer, Learn, Practice, Progress, and Settings.
- In Practice, edit a sample Unreal C++ exercise in Monaco and run clearly labeled pattern checks (not a C++ compiler).
- Show or hide a shared mock Tutor panel in Explorer, Learn, and Practice. The tutor uses example responses and does not call an AI model.
- Complete a sample quiz in Learn and keep quiz attempts and studied files in a local SQLite database.
- Use a dark or light theme and resize the explorer panel.

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
- The AI provider is a placeholder, not a model. The quiz and sample Practice exercise are generic examples, not generated from the repository. Practice checks are text-pattern checks only; no code execution engine or C++ compiler is included.
- SQLite data is stored in Electron's user-data directory, outside imported repositories. There is currently no data export, repository removal, migration UI, or installer.

## Roadmap

Future work could add real provider integrations, repository-aware explanations and quizzes, architecture visualization, richer learning activities, and packaged releases. Priorities and implementation choices may change as the project evolves.

## Contributing

Contributions, feedback, ideas, and issue reports are welcome. Propose a focused change or feature, and open an issue or pull request describing its motivation and approach.

## License

A license has not yet been specified. An explicit license will be added before public reuse and redistribution are encouraged. Until then, standard copyright restrictions apply.

---

**StudyRepo — don't just generate code. Understand it.**
