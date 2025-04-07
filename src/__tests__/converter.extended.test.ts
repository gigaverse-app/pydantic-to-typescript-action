import {
    createDiff,
    createLLMClient,
    generateTypescript,
    LLMConfig,
  } from "../converter";
  import { ChatAnthropic } from "@langchain/anthropic";
  import { ChatOpenAI } from "@langchain/openai";
  import { BaseChatModel } from "@langchain/core/language_models/chat_models";
  import { StringOutputParser } from "@langchain/core/output_parsers";
  import { ChatPromptTemplate } from "@langchain/core/prompts";
  
  // Mock external dependencies
  jest.mock("@langchain/anthropic");
  jest.mock("@langchain/openai");
  jest.mock("@langchain/core/prompts");
  jest.mock("@langchain/core/output_parsers");
  
  describe("converter.ts extended tests", () => {
    describe("createLLMClient", () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });
  
      it("should create an Anthropic client when provider is anthropic", () => {
        const config: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          anthropicApiKey: "test-key",
          temperature: 0.5,
        };
  
        const client = createLLMClient(config);
  
        expect(ChatAnthropic).toHaveBeenCalledWith({
          apiKey: "test-key",
          modelName: "test-model",
          temperature: 0.5,
        });
        expect(client).toBeInstanceOf(ChatAnthropic);
      });
  
      it("should create an OpenAI client when provider is openai", () => {
        const config: LLMConfig = {
          provider: "openai",
          model: "test-model",
          openaiApiKey: "test-key",
          temperature: 0.5,
        };
  
        const client = createLLMClient(config);
  
        expect(ChatOpenAI).toHaveBeenCalledWith({
          apiKey: "test-key",
          modelName: "test-model",
          temperature: 0.5,
        });
        expect(client).toBeInstanceOf(ChatOpenAI);
      });
  
      it("should throw an error when Anthropic API key is missing", () => {
        const config: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          temperature: 0.5,
        };
  
        expect(() => createLLMClient(config)).toThrow(
          "Anthropic API key is required when using Anthropic provider",
        );
      });
  
      it("should throw an error when OpenAI API key is missing", () => {
        const config: LLMConfig = {
          provider: "openai",
          model: "test-model",
          temperature: 0.5,
        };
  
        expect(() => createLLMClient(config)).toThrow(
          "OpenAI API key is required when using OpenAI provider",
        );
      });
  
      it("should throw an error for unsupported providers", () => {
        const config: LLMConfig = {
          provider: "unsupported-provider",
          model: "test-model",
          temperature: 0.5,
        };
  
        expect(() => createLLMClient(config)).toThrow(
          "Unsupported provider: unsupported-provider",
        );
      });
    });
  
    describe("generateTypescript", () => {
      // Mock implementation for ChatPromptTemplate and StringOutputParser
      const mockPipe = jest.fn();
      const mockInvoke = jest.fn();
  
      beforeEach(() => {
        jest.clearAllMocks();
  
        // Setup mock implementations
        (ChatPromptTemplate.fromTemplate as jest.Mock).mockReturnValue({
          pipe: mockPipe,
        });
  
        mockPipe.mockReturnValue({
          pipe: mockPipe,
          invoke: mockInvoke,
        });
  
        (StringOutputParser as jest.Mock).mockImplementation(() => "mockStringOutputParser");
  
        // Mock the model response
        mockInvoke.mockResolvedValue(`
  Here's the TypeScript code:
  
  \`\`\`typescript
  export interface User {
    id: number;
    name: string;
    email: string;
    age?: number;
  }
  \`\`\`
        `);
      });
  
      it("should generate TypeScript using the LLM", async () => {
        // Mock createLLMClient
        const mockLLM = {} as BaseChatModel;
        jest.spyOn(global, "createLLMClient" as any).mockReturnValue(mockLLM);
        
        const llmConfig: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          anthropicApiKey: "test-key",
          temperature: 0.5,
        };
  
        const result = await generateTypescript(
          "Base Python",
          "New Python",
          "Diff",
          "Current TypeScript",
          llmConfig,
        );
  
        // Verify prompt template was created
        expect(ChatPromptTemplate.fromTemplate).toHaveBeenCalled();
        
        // Verify pipe was called with the LLM
        expect(mockPipe).toHaveBeenCalledWith(mockLLM);
        expect(mockPipe).toHaveBeenCalledWith("mockStringOutputParser");
        
        // Verify invoke was called
        expect(mockInvoke).toHaveBeenCalledWith({});
        
        // Verify result
        expect(result).toContain("export interface User");
        expect(result).toContain("age?: number");
      });
  
      it("should extract TypeScript code from a response with typescript code block", async () => {
        // Mock a response with typescript code blocks
        mockInvoke.mockResolvedValue(`
  Here's the TypeScript:
  
  \`\`\`typescript
  export interface User {
    id: number;
  }
  \`\`\`
        `);
  
        // Mock createLLMClient
        jest.spyOn(global, "createLLMClient" as any).mockReturnValue({} as BaseChatModel);
  
        const llmConfig: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          anthropicApiKey: "test-key",
          temperature: 0.5,
        };
  
        const result = await generateTypescript(
          "Base Python",
          "New Python",
          "Diff",
          "Current TypeScript",
          llmConfig,
        );
  
        expect(result).toBe('export interface User {\n  id: number;\n}');
      });
  
      it("should extract TypeScript code from a response with ts code block", async () => {
        // Mock a response with ts code blocks
        mockInvoke.mockResolvedValue(`
  Here's the TypeScript:
  
  \`\`\`ts
  export interface User {
    id: number;
  }
  \`\`\`
        `);
  
        // Mock createLLMClient
        jest.spyOn(global, "createLLMClient" as any).mockReturnValue({} as BaseChatModel);
  
        const llmConfig: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          anthropicApiKey: "test-key",
          temperature: 0.5,
        };
  
        const result = await generateTypescript(
          "Base Python",
          "New Python",
          "Diff",
          "Current TypeScript",
          llmConfig,
        );
  
        expect(result).toBe('export interface User {\n  id: number;\n}');
      });
  
      it("should handle responses without code blocks", async () => {
        // Mock a response without code blocks
        mockInvoke.mockResolvedValue(`
  export interface User {
    id: number;
  }
        `);
  
        // Mock createLLMClient
        jest.spyOn(global, "createLLMClient" as any).mockReturnValue({} as BaseChatModel);
  
        const llmConfig: LLMConfig = {
          provider: "anthropic",
          model: "test-model",
          anthropicApiKey: "test-key",
          temperature: 0.5,
        };
  
        const result = await generateTypescript(
          "Base Python",
          "New Python",
          "Diff",
          "Current TypeScript",
          llmConfig,
        );
  
        expect(result).toBe('export interface User {\n  id: number;\n}');
      });
    });
  });
  