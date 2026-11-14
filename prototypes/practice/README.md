# StudyRepo — Practice Interface Prototype

A standalone React + TypeScript + Monaco Editor implementation of the initial StudyRepo programming exercise interface.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite (usually http://localhost:5173).

To check a production build:

```bash
npm run build
```

## Included

- Problem pane with example, hints, concepts, and tests tab.
- Editable Monaco C++ editor with a starter exercise.
- Demo pattern checks for loop variable declaration, `Loaded.Contains`, and `Missing.Add`.
- Static interactive tutor chat with hint/concept responses.
- Dark responsive three-panel layout.

## Explicit limitations

The 'Compiler / Tests' component is **not a C++ compiler**, and passing the pattern checks does not establish correctness. The tutor is **not connected to an AI model**. The demo function uses Unreal Engine types and cannot compile without a suitable Unreal build environment. For a future real implementation, run trusted exercise cases in an isolated, restricted runner rather than executing arbitrary repository code in the Electron main process.

This is a *standalone prototype*, not yet merged into the existing StudyRepo Electron application.