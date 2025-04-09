# Developer Guide for Pydantic to TypeScript Action

This guide covers all aspects of developing, testing, and releasing the Pydantic to TypeScript Action.

## Table of Contents
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Versioning and Releasing](#versioning-and-releasing)
- [GitHub Marketplace Integration](#github-marketplace-integration)
- [Common Tasks](#common-tasks)

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pydantic-to-typescript-action.git
   cd pydantic-to-typescript-action
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Project Structure

Key files and directories:

- `src/` - TypeScript source code
  - `index.ts` - Action entry point
  - `converter.ts` - Core conversion logic
  - `__tests__/` - Test files
- `dist/` - Compiled JavaScript (built by `npm run build`)
- `action.yaml` - GitHub Action definition
- `.github/workflows/` - GitHub Actions workflows
  - `release.yaml` - Handles version releases
  - `update-dependencies.yaml` - Automatically updates dependencies

## Testing

The project uses Jest for testing. The tests cover core functionality and integration with LLM providers.

### Running tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Writing tests

Tests are located in the `src/__tests__/` directory. When writing tests:

1. Use descriptive test names
2. Mock external dependencies (API calls, file operations)
3. Add both unit tests and integration tests

Example:

```typescript
describe('converter', () => {
  describe('createDiff', () => {
    it('should create a diff between two files', () => {
      // Test implementation
    });
  });
});
```

## Versioning and Releasing

This project follows [Semantic Versioning](https://semver.org/).

### Creating a New Version

To create and publish a new version:

```bash
# For bug fixes (1.0.0 → 1.0.1)
npm version patch

# For new features (1.0.0 → 1.1.0)
npm version minor

# For breaking changes (1.0.0 → 2.0.0)
npm version major

# Push the changes and tags
git push --follow-tags
```

When you push a new tag, the release workflow automatically:
1. Builds the action code (including the `/dist` folder)
2. Creates a GitHub release
3. Makes the new version available in the GitHub Marketplace

### How Versioning Works

The versioning process leverages GitHub's tag-based release system:

1. The `npm version` command:
   - Updates the version in `package.json`
   - Creates a Git tag (e.g., `v1.0.1`)
   - Commits these changes

2. When you push with `--follow-tags`:
   - Both code changes and the new tag are pushed to GitHub
   - The tag triggers the release workflow

3. GitHub uses these tags to determine which version to use when someone references your action with `@v1` or `@v1.0.1`

## GitHub Marketplace Integration

### How Users Reference Your Action

Users typically reference your action in one of these ways:

```yaml
# Major version reference (most common)
uses: yourusername/pydantic-to-typescript-action@v1

# Specific version reference
uses: yourusername/pydantic-to-typescript-action@v1.0.2
```

### Important Notes on Marketplace Publishing

- **First-time publishing** requires manual submission through the GitHub UI. After a release is created, you'll see a "Publish this Action to the GitHub Marketplace" button.

- **Subsequent updates** within the same major version (v1.x.x) are automatically available to users:
  - No need to manually republish to the Marketplace
  - Users referencing `@v1` automatically get the latest v1.x.x version
  - The Marketplace listing automatically shows the latest version

- **Major version releases** (v2.0.0) appear as separate entries in the Marketplace

## Common Tasks

### Updating Dependencies

Dependencies are automatically updated by the `update-dependencies.yaml` workflow which runs weekly. If you want to update dependencies manually:

```bash
npm update
```

### Adding New Features

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Implement your changes
3. Add tests
4. Update documentation if necessary
5. Build the project:
   ```bash
   npm run build
   ```
6. Commit your changes
7. Create a pull request

### Troubleshooting Release Issues

If the automatic release doesn't work as expected:

1. Check the GitHub Actions logs
2. Make sure you've pushed the tag with `git push --follow-tags`
3. Verify that the version in `package.json` matches the tag
4. Ensure the workflow has correct permissions to create releases

### Local Testing of the Action

To test the action locally before releasing:

1. Build the project:
   ```bash
   npm run build
   ```

2. Create test Python files and TypeScript files
3. Run the script directly:
   ```bash
   # Set environment variables for API keys
   export ANTHROPIC_API_KEY=your_key_here
   
   node dist/index.js
   ```

Remember to always test thoroughly before releasing a new version!
