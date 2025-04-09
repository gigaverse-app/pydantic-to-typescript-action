#!/bin/bash

# Set default version type to patch if no argument is provided
VERSION_TYPE=${1:-patch}

# Build the project first
echo "Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed! Aborting release."
  exit 1
fi

# Add the dist folder to git
echo "Adding dist folder to git..."
git add -f dist/

# Commit the dist folder
git commit -m "Build dist for release [skip ci]" || echo "No changes to commit"

# Create new version
echo "Creating new version (${VERSION_TYPE})..."
npm version $VERSION_TYPE

# Get the new version number
NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Created version v$NEW_VERSION"

# Push changes and tags
git push --follow-tags

# Wait a moment for the release workflow to start
echo "Waiting for GitHub to process the release..."
sleep 5

# Extract major version
MAJOR_VERSION=$(echo $NEW_VERSION | cut -d. -f1)

echo "Updating major version tag v$MAJOR_VERSION..."
echo "NOTE: If this fails, wait for the release to complete and run:"
echo "  git tag -f v$MAJOR_VERSION v$NEW_VERSION"
echo "  git push -f origin v$MAJOR_VERSION"

# Update the major version tag
git tag -f v$MAJOR_VERSION v$NEW_VERSION
git push -f origin v$MAJOR_VERSION

echo "Release v$NEW_VERSION complete!"
echo "Major version tag v$MAJOR_VERSION updated."
