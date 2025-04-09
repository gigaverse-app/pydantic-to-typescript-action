/**
 * Real Integration Test for the TypeScript Generator
 *
 * This test performs an actual end-to-end test of the TypeScript generation functionality.
 * It uses a real LLM call (if API keys are available) to verify the actual behavior.
 *
 * To run this test, you need to:
 * 1. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variables
 * 2. Or provide them in jest setup
 *
 * This test will be skipped if no API keys are available.
 */

import { generateTypescript } from "../converter";

// Helper to check if we have API keys for testing
const hasAnthropicKey = process.env.ANTHROPIC_API_KEY ? true : false;
const hasOpenAIKey = process.env.OPENAI_API_KEY ? true : false;

describe("Pydantic to TypeScript Converter - Real Integration Tests", () => {
  // Sample Python models
  const basePython = `
from pydantic import BaseModel
from typing import List, Optional

class User(BaseModel):
    id: int
    name: str
    email: str
  `;

  const newPython = `
from pydantic import BaseModel
from typing import List, Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
  `;

  // Create a diff
  const diff = `
diff --git a/models.py b/models.py
--- a/models.py
+++ b/models.py
@@ -5,4 +5,5 @@ class User(BaseModel):
     id: int
     name: str
     email: str
+    age: Optional[int] = None
`;

  // Sample TypeScript
  const currentTypescript = `
export interface User {
  id: number;
  name: string;
  email: string;
}
`;

  // Skip all tests if no API keys are available
  beforeAll(() => {
    if (!hasAnthropicKey && !hasOpenAIKey) {
      console.warn(
        "Skipping integration tests: No API keys available for LLM testing",
      );
    }
  });

  // Test with Anthropic if an API key is available
  (hasAnthropicKey ? it : it.skip)(
    "should generate TypeScript from Python using Anthropic",
    async () => {
      // Set a reasonable timeout for API call
      jest.setTimeout(30000);

      const result = await generateTypescript(
        basePython,
        newPython,
        diff,
        currentTypescript,
        {
          provider: "anthropic",
          model: "claude-3-haiku-20240307",
          anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
          temperature: 0.1,
        },
      );

      // Verify the result contains expected TypeScript
      expect(result).toContain("interface User");
      expect(result).toContain("id: number");
      expect(result).toContain("email: string");

      // Verify it added the new field from the diff
      expect(result).toContain("age?:");
    },
    30000,
  );

  // Test with OpenAI if an API key is available
  (hasOpenAIKey ? it : it.skip)(
    "should generate TypeScript from Python using OpenAI",
    async () => {
      // Set a reasonable timeout for API call
      jest.setTimeout(30000);

      const result = await generateTypescript(
        basePython,
        newPython,
        diff,
        currentTypescript,
        {
          provider: "openai",
          model: "gpt-3.5-turbo",
          openaiApiKey: process.env.OPENAI_API_KEY || "",
          temperature: 0.1,
        },
      );

      // Verify the result contains expected TypeScript
      expect(result).toContain("interface User");
      expect(result).toContain("id: number");
      expect(result).toContain("email: string");

      // Verify it added the new field from the diff
      expect(result).toContain("age?:");
    },
    30000,
  );
});
