# AGENTS.md

## Instructions

1. Before modifying a component or its implementation, consult the relevant documentation for the component, framework, or library. Base the implementation on the documented APIs, patterns, and constraints.
2. Build desktop-only interfaces unless the user explicitly requests mobile or responsive support. Do not add mobile-specific layouts, breakpoints, drawers, or interactions by default.
3. For any question or request related to generating PPTs, use the following mandatory workflow before writing or modifying code:
   - Read [`docs/PPT_MASTER_REFERENCE.md`](docs/PPT_MASTER_REFERENCE.md) first and use it as the local research cache. Do not inspect or compare the remote PPT Master repository unless the user explicitly requests it.
   - Compare the locally cached reference with this project's architecture and your own technical judgment. Summarize the transferable ideas, important differences, tradeoffs, and your recommended solution for the user.
   - Explicitly ask the user to confirm the recommended solution.
   - Do not write or modify implementation code until the user confirms. Read-only research and inspection are allowed before confirmation. If the confirmed scope changes materially, summarize the new direction and obtain confirmation again before continuing.
