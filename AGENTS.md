# Repository Guidelines

## Project Structure & Module Organization
Parawork is a pnpm-workspace monorepo. Core packages live under `packages/`:
- `packages/backend/`: Node.js + TypeScript server (Express + WebSocket). Key areas: `src/api/`, `src/agents/`, `src/db/`, `src/config/`, `src/middleware/`, `src/utils/`.
- `packages/frontend/`: React + TypeScript UI (Vite + Tailwind). Key areas: `src/components/`, `src/hooks/`, `src/stores/`, `src/contexts/`, `src/lib/`, and static assets in `public/`.
- `packages/shared/`: Shared TS types and Zod schemas in `src/`.
Docs live in `docs/`. The backend stores SQLite data in `packages/backend/data/` (gitignored).

## Build, Test, and Development Commands
Use Node.js 18+ and pnpm (required).
- `pnpm install`: install dependencies.
- `pnpm dev`: run all packages in dev mode (parallel).
- `pnpm build`: build all packages.
- `pnpm typecheck`: typecheck all packages.
- `pnpm lint`: lint (frontend only).
- `pnpm clean`: remove build artifacts.

Package-specific examples:
- `pnpm --filter @parawork/backend dev` (backend on `http://localhost:3000`)
- `pnpm --filter @parawork/frontend dev` (frontend on `http://localhost:5173`)
- `pnpm --filter @parawork/backend test` / `pnpm --filter @parawork/frontend test`

## Coding Style & Naming Conventions
TypeScript is ESM (`"type": "module"`). Follow existing code style:
- Indentation: 2 spaces in TS/TSX files.
- Components use `PascalCase` filenames (e.g., `WorkspaceView.tsx`).
- Hooks use `useX` naming (e.g., `useWebSocket.ts`).
- Backend utilities and modules use `camelCase` filenames.
Linting is via ESLint in the frontend; use `pnpm lint` before pushing.

## Testing Guidelines
Tests use Vitest in both backend and frontend; backend also uses `fast-check` for property tests.
- Co-locate tests with source using `*.test.ts` or `*.test.tsx`.
- Run tests with `pnpm --filter @parawork/backend test` and `pnpm --filter @parawork/frontend test`.
No explicit coverage threshold is defined; keep tests focused on behavior and edge cases.

## Commit & Pull Request Guidelines
Commit messages follow Conventional Commit-style prefixes (e.g., `feat:`, `fix:`, `docs:`).
PRs should include:
- A short summary of the change and motivation.
- Testing notes (commands run, results).
- Screenshots or clips for UI changes.
- Linked issues when applicable.

## Configuration & Agent Notes
On first run, the backend creates `packages/backend/config.json`; keep secrets out of version control.
For agent-specific workflows and architecture details, see `CLAUDE.md` and `IFLOW.md`.
