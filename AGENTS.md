# AGENTS.md

## Instructions

1. Before modifying a component or its implementation, consult the relevant documentation for the component, framework, or library. Base the implementation on the documented APIs, patterns, and constraints.
2. Build desktop-only interfaces unless the user explicitly requests mobile or responsive support. Do not add mobile-specific layouts, breakpoints, drawers, or interactions by default.
3. For any question or request related to generating PPTs, use the following mandatory workflow before writing or modifying code:
   - Read [`docs/PPT_MASTER_REFERENCE.md`](docs/PPT_MASTER_REFERENCE.md) first. Use its recorded commit and refresh rules as the local research cache: when the remote `main` HEAD matches the recorded commit, do not download or reread the same PPT Master files; when it differs, inspect only relevant changes and update the reference document.
   - Inspect the current `main` branch of [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master/tree/main). Read the repository files relevant to the specific problem, including its Skill instructions, documentation, examples, or implementation when applicable; do not rely on the README alone.
   - Compare PPT Master's approach with this project's architecture and your own technical judgment. Summarize the reference approach, transferable ideas, important differences, tradeoffs, and your recommended solution for the user.
   - Explicitly ask the user to confirm the recommended solution.
   - Do not write or modify implementation code until the user confirms. Read-only research and inspection are allowed before confirmation. If the confirmed scope changes materially, summarize the new direction and obtain confirmation again before continuing.
