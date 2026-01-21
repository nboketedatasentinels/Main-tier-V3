# QA Automated Test Suite

This document defines the automated checks required for Sprint 6 QA validation.

## Goals

- Ensure type safety, lint compliance, and build stability before release.
- Provide a single command to run the full automated suite locally or in CI.

## Command

Run the full suite with:

```bash
npm run qa
```

## What It Runs

1. **Linting**: `npm run lint`
2. **Type checking**: `npm run typecheck`
3. **Production build**: `npm run build`

## Expected Outcomes

- Lint passes with zero warnings.
- Typecheck completes with no errors.
- Build succeeds for production bundling.

## Troubleshooting

- If lint fails, address unused variables or formatting inconsistencies.
- If typecheck fails, validate TypeScript types and imports.
- If build fails, confirm environment variables and static assets are available.
