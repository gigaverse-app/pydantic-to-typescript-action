import { createDiff, createLLMClient, LLMConfig } from "../converter";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

// Mock external dependencies
jest.mock("@langchain/anthropic");
jest.mock("@langchain/openai");

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

  // Add more tests for createDiff to increase coverage
  describe("createDiff", () => {
    it("should create a diff with the expected format", () => {
      const file1Path = "path/to/file1.py";
      const file2Path = "path/to/file2.py";
      const file1Content = "line1\nline2\nline3";
      const file2Content = "line1\nline2 modified\nline3\nline4";

      const diff = createDiff(file1Path, file1Content, file2Path, file2Content);

      // Check correct format
      expect(diff).toContain(`diff --git a/${file1Path} b/${file2Path}`);
      expect(diff).toContain(`--- a/${file1Path}`);
      expect(diff).toContain(`+++ b/${file2Path}`);
      expect(diff).toContain("-line2");
      expect(diff).toContain("+line2 modified");
      expect(diff).toContain("+line4");
    });

    it("should handle empty files", () => {
      const file1Path = "empty1.py";
      const file2Path = "empty2.py";
      const file1Content = "";
      const file2Content = "";

      const diff = createDiff(file1Path, file1Content, file2Path, file2Content);

      expect(diff).toContain(`diff --git a/${file1Path} b/${file2Path}`);
      expect(diff).toContain(`--- a/${file1Path}`);
      expect(diff).toContain(`+++ b/${file2Path}`);
    });

    it("should handle completely different files", () => {
      const file1Path = "old.py";
      const file2Path = "new.py";
      const file1Content = "completely different\ncontent\nhere";
      const file2Content = "new file\nwith new\ncontent";

      const diff = createDiff(file1Path, file1Content, file2Path, file2Content);

      expect(diff).toContain(`diff --git a/${file1Path} b/${file2Path}`);
      expect(diff).toContain("-completely different");
      expect(diff).toContain("-content");
      expect(diff).toContain("-here");
      expect(diff).toContain("+new file");
      expect(diff).toContain("+with new");
      expect(diff).toContain("+content");
    });
  });
});
