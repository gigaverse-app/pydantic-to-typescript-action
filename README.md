# Pydantic to TypeScript Converter

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Pydantic%20to%20TypeScript%20Converter-blue?logo=github)](https://github.com/marketplace/actions/pydantic-to-typescript-converter)
[![Release](https://img.shields.io/github/v/release/gigaverse-app/pydantic-to-typescript-action)](https://github.com/gigaverse-app/pydantic-to-typescript-action/releases/latest)
[![License: MIT](https://img.shields.io/github/license/gigaverse-app/pydantic-to-typescript-action)](LICENSE)

**Keep your TypeScript types in sync with your Python Pydantic models on every pull request, without giving up the TypeScript you wrote by hand.**

If your API models live in Pydantic and your frontend types are TypeScript, this GitHub Action closes the gap. When a pull request changes a Pydantic model file, the action gives an LLM (Claude by default, or OpenAI) the old models, the new models, the diff and your current TypeScript file. The LLM edits the TypeScript to match. Commit the result to the same PR, or open a pull request in your frontend repository.

## Quick start

1. Add an `ANTHROPIC_API_KEY` secret to your repository.
2. Make sure the TypeScript file exists. For the first run, an empty file is enough.
3. Add this workflow as `.github/workflows/sync-types.yml`:

```yaml
name: Sync TypeScript types

on:
  pull_request:
    paths:
      - 'src/models/schema.py'

permissions:
  contents: write

jobs:
  sync-types:
    runs-on: ubuntu-latest
    steps:
      # The PR branch, so the updated types can be pushed back to it
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.head_ref }}

      # The base branch, to diff the models against
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.base_ref }}
          path: base

      - uses: gigaverse-app/pydantic-to-typescript-action@v3
        with:
          base-python-file: base/src/models/schema.py
          new-python-file: src/models/schema.py
          current-typescript-file: src/types/schema.ts
          output-typescript-file: src/types/schema.ts
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Commit the updated types
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/types/schema.ts
          git diff --cached --quiet || git commit -m "chore: sync TypeScript types with Pydantic models"
          git push
```

This setup works for pull requests from branches in the same repository. Pull requests from forks don't get your secrets or write access.

## Before and after

This is the real output of the action's release smoke test ([`release.yaml`](.github/workflows/release.yaml)) for v3.1.1, run with the default `claude-opus-5`.

A pull request changes the Pydantic models:

```diff
 from pydantic import BaseModel
-from typing import List, Optional, Dict
+from typing import List, Optional, Dict, Any

 class Address(BaseModel):
     street: str
     city: str
     zipcode: str
+    country: Optional[str] = None

 class User(BaseModel):
     id: int
     name: str
     email: str
     addresses: List[Address] = []
+    age: Optional[int] = None
+    metadata: Dict[str, Any] = {}
```

The action updates the existing TypeScript file in place:

```diff
 export interface Address {
   street: string;
   city: string;
   zipcode: string;
+  country?: string | null;
 }

 export interface User {
   id: number;
   name: string;
   email: string;
   addresses?: Address[];
+  age?: number | null;
+  metadata?: Record<string, any>;
 }
```

Only the new fields are added. The existing lines, including the hand-written `addresses?: Address[]`, stay as they were. The output comes from an LLM, so review it like any other change in the PR.

## Why use it

- **It edits your file instead of regenerating it.** The model gets the diff and your current TypeScript, and is told to keep your naming, patterns, comments and TypeScript-only additions. Your hand-tuned types don't get overwritten by a fresh dump.
- **You don't need a Python environment.** The action reads your models as plain text and never imports or runs them, so the workflow doesn't have to install your backend's dependencies.
- **It works across repositories.** A backend PR can open the matching frontend PR (see [the example below](#backend-pr-to-frontend-pr)).
- **You can steer it.** Add project-specific rules with `custom-prompt`, choose the model with `model-name`, or switch to OpenAI with `model-provider: openai`.
- **You can trace it.** Pass a LangSmith key to record each LLM call.

## Backend PR to frontend PR

When the Python models and the TypeScript types live in different repositories, run the action in the backend repository and open a pull request in the frontend one. `FRONTEND_REPO_PAT` is a token with write access to the frontend repository.

```yaml
name: Update frontend types from backend models

on:
  pull_request:
    paths:
      - 'src/models/schema.py'
  workflow_dispatch:

jobs:
  update-typescript:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout frontend repository
        uses: actions/checkout@v7
        with:
          repository: your-org/frontend-repo
          token: ${{ secrets.FRONTEND_REPO_PAT }}
          path: frontend-repo

      - name: Checkout backend repository (PR)
        uses: actions/checkout@v7
        with:
          path: backend-repo

      - name: Checkout backend repository (base)
        uses: actions/checkout@v7
        with:
          ref: ${{ github.base_ref || 'main' }}
          path: backend-base-repo

      - name: Convert Python to TypeScript
        uses: gigaverse-app/pydantic-to-typescript-action@v3
        with:
          base-python-file: backend-base-repo/src/models/schema.py
          new-python-file: backend-repo/src/models/schema.py
          current-typescript-file: frontend-repo/src/types/schema.ts
          output-typescript-file: frontend-repo/src/types/schema.ts
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Optional extra instruction for the model:
          # custom-prompt: "Add a JSDoc comment to every new field"
          # Optional LangSmith tracing:
          # langsmith-api-key: ${{ secrets.LANGSMITH_API_KEY }}
          # langsmith-project: my-project

      - name: Open a pull request in the frontend repository
        uses: peter-evans/create-pull-request@v8
        with:
          token: ${{ secrets.FRONTEND_REPO_PAT }}
          path: frontend-repo
          commit-message: "Update TypeScript types from Python model changes"
          title: "Update TypeScript types from Python model changes"
          body: |
            Generated from backend PR: ${{ github.event.pull_request.html_url || 'manual trigger' }}
          branch: update-ts-schema
          branch-suffix: timestamp
```

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `base-python-file` | Path to the Pydantic file before the change, usually from a checkout of the base branch | Yes | |
| `new-python-file` | Path to the Pydantic file after the change | Yes | |
| `current-typescript-file` | Path to the existing TypeScript file. It must exist; an empty file is fine. | Yes | |
| `output-typescript-file` | Where to write the updated TypeScript. It is usually the same path as `current-typescript-file`. | Yes | |
| `model-provider` | `anthropic` or `openai` | No | `anthropic` |
| `model-name` | Model to use. With `model-provider: openai`, set this to an OpenAI model, because the default is a Claude model. | No | `claude-opus-5` |
| `anthropic-api-key` | Anthropic API key. Required when `model-provider` is `anthropic`. | No | |
| `openai-api-key` | OpenAI API key. Required when `model-provider` is `openai`. | No | |
| `temperature` | Sampling temperature. It is sent only when you set it, because some newer models reject sampling parameters with a 400 error. | No | |
| `custom-prompt` | An extra instruction added to the prompt, e.g. "Completely regenerate the TypeScript file from the new Python file" | No | |
| `langsmith-api-key` | Turns on LangSmith tracing for the LLM call | No | |
| `langsmith-project` | LangSmith project to trace into | No | `pydantic-to-typescript-action` |

The action has no outputs. It writes the updated TypeScript to `output-typescript-file`.

## Good to know

- Each step converts one Python file into one TypeScript file. To sync more files, add more steps.
- Each run is limited to 10,000 output tokens, so very large model files can be cut short. Split them if you hit that limit.
- The TypeScript is written by an LLM. Review the change like any other PR.

## LangSmith tracing

When you pass `langsmith-api-key`, the action sets `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` before calling the model. If you don't set `langsmith-project`, `LANGSMITH_PROJECT` is `pydantic-to-typescript-action`.

## Development

Requires Node.js 22 or later, which the current LangChain and OpenAI dependencies need.

```bash
npm ci
npm run build   # bundles src/ into dist/ and copies the prompts
npm test
```

The prompts sent to the model are in [`prompts/`](prompts). See [CONTRIBUTING.md](CONTRIBUTING.md) for the release process.

## License

[MIT](LICENSE)
