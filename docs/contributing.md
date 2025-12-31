# Contributing to Parawork

Thank you for your interest in contributing to Parawork! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+ (`npm install -g pnpm`)
- Git

### Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/yourusername/parawork.git
   cd parawork
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Build all packages**

   ```bash
   pnpm build
   ```

5. **Start development servers**

   ```bash
   # Terminal 1: Backend
   cd packages/backend
   pnpm dev

   # Terminal 2: Frontend
   cd packages/frontend
   pnpm dev
   ```

## Project Structure

```
parawork/
├── packages/
│   ├── backend/     # Node.js + TypeScript server
│   ├── frontend/    # React + TypeScript web UI
│   └── shared/      # Shared types between packages
├── docs/            # Documentation
└── package.json     # Root monorepo config
```

## Development Workflow

### Branching Strategy

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. Make your changes with clear, focused commits

3. Push to your fork and open a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add workspace filtering
fix: resolve WebSocket reconnection issue
docs: update API documentation
refactor: simplify database queries
test: add workspace creation tests
```

### Type Checking

Run type checks before committing:

```bash
pnpm typecheck
```

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Pull Request Process

1. **Before submitting:**
   - Ensure all type checks pass: `pnpm typecheck`
   - Test your changes manually
   - Update documentation if needed

2. **PR Description:**
   - Describe what the PR does
   - Link related issues
   - Include screenshots for UI changes

3. **Review Process:**
   - PRs require at least one approval
   - Address review feedback promptly
   - Keep PRs focused and reasonably sized

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` for beginner-friendly tasks.

### Priority Areas

- **Testing**: Unit and integration tests
- **Documentation**: API docs, examples, tutorials
- **Performance**: Optimization opportunities
- **Accessibility**: Making the UI more accessible
- **Bug fixes**: Check open issues

### Feature Development

For larger features:

1. Open an issue first to discuss the approach
2. Wait for feedback before starting work
3. Break large changes into smaller PRs

## Package-Specific Guidelines

### Backend (`packages/backend`)

- Use Express.js patterns consistently
- Add validation for all API inputs
- Handle errors gracefully with proper HTTP status codes
- Use prepared statements for database queries

### Frontend (`packages/frontend`)

- Use React hooks and functional components
- Keep components focused and composable
- Use Zustand for global state
- Follow Tailwind CSS conventions

### Shared (`packages/shared`)

- Keep types minimal and focused
- Use Zod for runtime validation schemas
- Export types and schemas from `index.ts`

## Security

- Never commit secrets or API keys
- Validate all user inputs
- Follow the existing authentication patterns
- Report security vulnerabilities privately

## Questions?

- Open an issue for questions
- Join discussions on GitHub

Thank you for contributing to Parawork!
