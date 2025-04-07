// src/__tests__/converter.integration.extended.test.ts
import { generateTypescript } from "../converter";
import { AIMessage } from "@langchain/core/messages";

// Mock the ChatAnthropic and ChatOpenAI classes
jest.mock("@langchain/anthropic", () => {
  return {
    ChatAnthropic: jest.fn().mockImplementation(() => ({
      pipe: jest.fn().mockReturnThis(),
      invoke: jest
        .fn()
        .mockResolvedValue(new AIMessage("Generated TypeScript")),
    })),
  };
});

jest.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => ({
      pipe: jest.fn().mockReturnThis(),
      invoke: jest
        .fn()
        .mockResolvedValue(new AIMessage("Generated TypeScript")),
    })),
  };
});

// Mock the ChatPromptTemplate class
jest.mock("@langchain/core/prompts", () => {
  return {
    ChatPromptTemplate: {
      fromTemplate: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          pipe: jest.fn().mockReturnValue({
            invoke: jest.fn().mockResolvedValue(
              `\`\`\`typescript
export interface User {
  id: number;
  name: string;
  email: string;
}
\`\`\``,
            ),
          }),
        }),
      }),
    },
  };
});

// Mock the StringOutputParser
jest.mock("@langchain/core/output_parsers", () => {
  return {
    StringOutputParser: jest.fn().mockImplementation(() => ({})),
  };
});

describe("generateTypescript integration test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should generate TypeScript from Python models (Anthropic)", async () => {
    const basePython = `
class User(BaseModel):
    id: int
    name: str
    email: str
`;
    const newPython = `
class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
`;
    const diff = `
@@ -3,4 +3,5 @@
 class User(BaseModel):
     id: int
     name: str
     email: str
+    age: Optional[int] = None
`;
    const currentTypescript = `
export interface User {
  id: number;
  name: string;
  email: string;
}
`;

    const result = await generateTypescript(
      basePython,
      newPython,
      diff,
      currentTypescript,
      {
        provider: "anthropic",
        model: "test-model",
        anthropicApiKey: "test-key",
        temperature: 0.5,
      },
    );

    expect(result).toContain("interface User");
  });

  it("should generate TypeScript from Python models (OpenAI)", async () => {
    const basePython = `
class User(BaseModel):
    id: int
    name: str
    email: str
`;
    const newPython = `
class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
`;
    const diff = `
@@ -3,4 +3,5 @@
 class User(BaseModel):
     id: int
     name: str
     email: str
+    age: Optional[int] = None
`;
    const currentTypescript = `
export interface User {
  id: number;
  name: string;
  email: string;
}
`;

    const result = await generateTypescript(
      basePython,
      newPython,
      diff,
      currentTypescript,
      {
        provider: "openai",
        model: "test-model",
        openaiApiKey: "test-key",
        temperature: 0.5,
      },
    );

    expect(result).toContain("interface User");
  });
});
