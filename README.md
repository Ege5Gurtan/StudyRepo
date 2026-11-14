# StudyRepo

StudyRepo is a local-first desktop application for learning by studying your own code. Explore a repository, build familiarity with its files, and practice code-reading fundamentals without an AI account.

## Features

- Import and reopen local folders, browse a collapsible tree, and view UTF-8 source in a read-only Monaco editor with tabs.
- See extension-based language counts, file counts, recently opened files, and file-based learning progress.
- Request a clearly labeled mock explanation for selected lines; no code is sent to an AI service.
- Complete a sample quiz and keep quiz attempts and studied files in a local SQLite database.
- Use a dark or light theme and resize the explorer panel.

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
- The AI provider is a placeholder, not a model. The quiz and learning module are generic examples, not generated from the repository. No code execution engine is included.
- SQLite data is stored in Electron's user-data directory, outside imported repositories. There is currently no data export, repository removal, migration UI, or installer.

## Roadmap

Future work could add real provider integrations, repository-aware explanations and quizzes, architecture visualization, richer learning activities, and packaged releases.
