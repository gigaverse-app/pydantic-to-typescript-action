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
   git clone https://github.com/gigaverse-app/pydantic-to-typescript-action.git
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

### Simple Development Workflow

1. **Regular Development:**
   ```bash
   # Make your changes
   git add .
   git commit -m "Your commit message"
   git push
   ```
   The GitHub Actions workflow will build your code and run tests to verify your changes.

2. **Releasing a New Version:**
   ```bash
   # Create and push a new release (defaults to patch)
   ./release.sh
   
   # For minor or major releases
   ./release.sh minor
   ./release.sh major
   ```
   
   This script will:
   - Update the version in package.json
   - Create the appropriate git tags
   - Push changes and tags
   - Update the major version tag (e.g., v1, v2) to point to your latest release

Users referencing your action with `@v2` will automatically get the latest v2.x.x release.

### About the Release Script

The release script handles all the complexities of GitHub Action versioning for you:

1. It creates a specific version tag (e.g., v2.1.0) with `npm version`
2. It updates the major version tag (e.g., v2) to point to the latest release
3. It pushes all necessary tags to GitHub

This ensures your action works correctly with all types of version references.

## GitHub Marketplace Integration

### How Users Reference Your Action

Users typically reference your action in one of these ways:

```yaml
# Major version reference (most common)
uses: gigaverse-app/pydantic-to-typescript-action@v2

# Specific version reference
uses: gigaverse-app/pydantic-to-typescript-action@v2.0.2
```

### Important Notes on Marketplace Publishing

- **First-time publishing** requires manual submission through the GitHub UI. After a release is created, you'll see a "Publish this Action to the GitHub Marketplace" button.

- **Subsequent updates** within the same major version (v2.x.x) are automatically available to users without republishing to the Marketplace.

- **Action.yaml requirements**: Make sure your action.yaml includes a name, description, and all required inputs.

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
2. Ensure the release workflow completed successfully
3. If the major version tag (e.g., v2) wasn't updated, run:
   ```bash
   # Replace X.Y.Z with your current version
   git tag -f vX vX.Y.Z
   git push -f origin vX
   ```

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