## 2024-05-23 - Unintended Artifacts in Commits
**Learning:** Committing package manager lock files (like `pnpm-lock.yaml`) or local development logs (`dev.log`) alongside a feature change is a critical error. These files are out-of-scope and introduce unintended, major changes to the project's configuration and history.
**Action:** Always review the file list before submitting. Remove any files that are not directly related to the specific, intended change. Add temporary or local files to `.gitignore` if they are not already there.
