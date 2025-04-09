/**
 * Comprehensive Integration Tests
 *
 * These tests use real API calls to test the converter functionality.
 * Tests will be skipped if API keys aren't available.
 */

import {
  generateTypescript,
  createDiff,
  extractTypescriptCode,
} from "../converter";

// Check for API keys
const hasAnthropicKey = process.env.ANTHROPIC_API_KEY ? true : false;
const hasOpenAIKey = process.env.OPENAI_API_KEY ? true : false;

// Test data
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

const currentTypescript = `
export interface User {
  id: number;
  name: string;
  email: string;
}
`;

// Create a diff
const diff = createDiff("models.py", basePython, "models.py", newPython);

describe("Python to TypeScript Converter - Integration Tests", () => {
  // Long timeout for API calls
  jest.setTimeout(30000);

  describe("extractTypescriptCode", () => {
    it("should extract TypeScript code from code blocks", () => {
      const input = `Here's the TypeScript:
\`\`\`typescript
export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}
\`\`\`
`;
      const result = extractTypescriptCode(input);
      expect(result).toContain("export interface User");
      expect(result).toContain("age?: number");
    });

    it("should extract TypeScript from ts code blocks", () => {
      const input = `
\`\`\`ts
export interface User {
  id: number;
  name: string;
}
\`\`\`
`;
      const result = extractTypescriptCode(input);
      expect(result).toContain("export interface User");
    });

    it("should handle responses without code blocks", () => {
      const input = `export interface User {
  id: number;
  name: string;
}`;
      const result = extractTypescriptCode(input);
      expect(result).toBe(input);
    });
  });

  describe("createDiff", () => {
    it("should create a diff with added lines", () => {
      const result = createDiff(
        "models.py",
        basePython,
        "models.py",
        newPython,
      );
      expect(result).toContain("diff --git");
      expect(result).toContain("+    age: Optional[int] = None");
    });

    it("should handle different file paths", () => {
      const result = createDiff(
        "old/models.py",
        basePython,
        "new/models.py",
        newPython,
      );
      expect(result).toContain("diff --git a/old/models.py b/new/models.py");
    });
  });

  // Tests with Anthropic
  describe("Anthropic Integration", () => {
    // Skip if no API key
    (hasAnthropicKey ? it : it.skip)(
      "should generate TypeScript with Anthropic",
      async () => {
        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: "anthropic",
            model: "claude-3-haiku-20240307",
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            temperature: 0.1,
          },
        );

        expect(result).toContain("export interface User");
        expect(result).toContain("age?:");
      },
    );

    (hasAnthropicKey ? it : it.skip)(
      "should apply custom prompts with Anthropic",
      async () => {
        const customPrompt = "Add detailed comments to document the interface";

        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: "anthropic",
            model: "claude-3-haiku-20240307",
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            temperature: 0.1,
          },
          customPrompt,
        );

        expect(result).toContain("export interface User");
        // We expect some form of comments with the custom prompt
        expect(result).toMatch(/\/\/|\/\*|\*/);
      },
    );

    (hasAnthropicKey ? it : it.skip)(
      "should respect maxTokens parameter with Anthropic",
      async () => {
        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: "anthropic",
            model: "claude-3-haiku-20240307",
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            temperature: 0.1,
            maxTokens: 2000, // Set explicit max tokens
          },
        );

        expect(result).toContain("export interface User");
      },
    );
  });

  // Tests with OpenAI
  describe("OpenAI Integration", () => {
    // Skip if no API key
    (hasOpenAIKey ? it : it.skip)(
      "should generate TypeScript with OpenAI",
      async () => {
        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: "openai",
            model: "gpt-3.5-turbo",
            openaiApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
          },
        );

        expect(result).toContain("export interface User");
        expect(result).toContain("age?:");
      },
    );

    (hasOpenAIKey ? it : it.skip)(
      "should apply custom prompts with OpenAI",
      async () => {
        const customPrompt = "Add detailed comments to document the interface";

        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: "openai",
            model: "gpt-3.5-turbo",
            openaiApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
          },
          customPrompt,
        );

        expect(result).toContain("export interface User");
        expect(result).toMatch(/\/\/|\/\*|\*/);
      },
    );
  });

  // Error cases
  describe("Error handling", () => {
    it("should throw error for missing Anthropic API key", async () => {
      await expect(
        generateTypescript(basePython, newPython, diff, currentTypescript, {
          provider: "anthropic",
          model: "claude-3-haiku-20240307",
          temperature: 0.1,
        }),
      ).rejects.toThrow("Anthropic API key is required");
    });

    it("should throw error for missing OpenAI API key", async () => {
      await expect(
        generateTypescript(basePython, newPython, diff, currentTypescript, {
          provider: "openai",
          model: "gpt-3.5-turbo",
          temperature: 0.1,
        }),
      ).rejects.toThrow("OpenAI API key is required");
    });

    it("should throw error for unsupported provider", async () => {
      await expect(
        generateTypescript(basePython, newPython, diff, currentTypescript, {
          provider: "unknown-provider",
          model: "test-model",
          temperature: 0.1,
        }),
      ).rejects.toThrow("Unsupported provider");
    });
  });

  // Complex model tests - only run if we have at least one API key
  (hasAnthropicKey || hasOpenAIKey ? describe : describe.skip)(
    "Complex models",
    () => {
      // Choose the available provider
      const provider = hasAnthropicKey ? "anthropic" : "openai";
      const model = hasAnthropicKey
        ? "claude-3-haiku-20240307"
        : "gpt-3.5-turbo";

      it("should handle complex Python models with nested structures", async () => {
        const complexBasePython = `
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class Address(BaseModel):
    street: str
    city: str
    country: str

class User(BaseModel):
    id: int
    name: str
    role: UserRole = UserRole.USER
    address: Optional[Address] = None
    metadata: Dict[str, Any] = {}
`;

        const complexNewPython = `
from pydantic import BaseModel
from typing import List, Dict, Optional, Any, Union
from enum import Enum
from datetime import datetime

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"  # Added value

class Address(BaseModel):
    street: str
    city: str
    country: str
    postal_code: Optional[str] = None  # Added field

class PaymentMethod(BaseModel):  # Added model
    type: str
    provider: str

class User(BaseModel):
    id: int
    name: str
    role: UserRole = UserRole.USER
    address: Optional[Address] = None
    payment_methods: List[PaymentMethod] = []  # Added field
    metadata: Dict[str, Any] = {}
    created_at: datetime = datetime.now()  # Added field
`;

        const complexCurrentTypescript = `
export enum UserRole {
  ADMIN = "admin",
  USER = "user"
}

export interface Address {
  street: string;
  city: string;
  country: string;
}

export interface User {
  id: number;
  name: string;
  role?: UserRole;
  address?: Address;
  metadata?: Record<string, any>;
}
`;

        const complexDiff = createDiff(
          "complex_models.py",
          complexBasePython,
          "complex_models.py",
          complexNewPython,
        );

        const config = {
          provider,
          model,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          openaiApiKey: process.env.OPENAI_API_KEY,
          temperature: 0.1,
          maxTokens: 4000,
        };

        const result = await generateTypescript(
          complexBasePython,
          complexNewPython,
          complexDiff,
          complexCurrentTypescript,
          config,
        );

        // Check for new enum value
        expect(result).toContain('GUEST = "guest"');

        // Check for new model
        expect(result).toContain("export interface PaymentMethod");

        // Check for modified fields
        expect(result).toContain("postal_code?:");
        expect(result).toContain("payment_methods?:");
        expect(result).toContain("created_at?:");
      });
    },
  );
});
