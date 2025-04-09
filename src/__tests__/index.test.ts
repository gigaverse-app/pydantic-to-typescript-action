import * as core from "@actions/core";
import * as fs from "fs/promises";
import * as converter from "../converter";
import path from "path";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("fs/promises");
jest.mock("path");
jest.mock("../converter");

// Import the module under test after mocking dependencies
import { run } from "../index";

describe("index.ts", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    (core.getInput as jest.Mock).mockImplementation((name) => {
      switch (name) {
        case "base-python-file":
          return "base.py";
        case "new-python-file":
          return "new.py";
        case "current-typescript-file":
          return "current.ts";
        case "output-typescript-file":
          return "output.ts";
        case "model-provider":
          return "anthropic";
        case "model-name":
          return "test-model";
        case "temperature":
          return "0.1";
        case "anthropic-api-key":
          return "test-key";
        default:
          return "";
      }
    });

    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockImplementation((filePath) => {
      switch (filePath) {
        case "base.py":
          return Promise.resolve("Base Python content");
        case "new.py":
          return Promise.resolve("New Python content");
        case "current.ts":
          return Promise.resolve("Current TypeScript content");
        default:
          return Promise.resolve("");
      }
    });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    (converter.createDiff as jest.Mock).mockReturnValue("Mock diff");
    (converter.generateTypescript as jest.Mock).mockResolvedValue(
      "Generated TypeScript",
    );

    (path.dirname as jest.Mock).mockReturnValue("output-dir");
  });

  it("should process files and generate TypeScript", async () => {
    // Run the function
    await run();

    // Verify inputs were read
    expect(core.getInput).toHaveBeenCalledWith("base-python-file", {
      required: true,
    });
    expect(core.getInput).toHaveBeenCalledWith("new-python-file", {
      required: true,
    });

    // Verify paths were validated
    expect(fs.access).toHaveBeenCalledWith("base.py");
    expect(fs.access).toHaveBeenCalledWith("new.py");
    expect(fs.access).toHaveBeenCalledWith("current.ts");

    // Verify output directory was created
    expect(path.dirname).toHaveBeenCalledWith("output.ts");
    expect(fs.mkdir).toHaveBeenCalledWith("output-dir", { recursive: true });

    // Verify files were read
    expect(fs.readFile).toHaveBeenCalledWith("base.py", "utf8");
    expect(fs.readFile).toHaveBeenCalledWith("new.py", "utf8");
    expect(fs.readFile).toHaveBeenCalledWith("current.ts", "utf8");

    // Verify diff was created
    expect(converter.createDiff).toHaveBeenCalledWith(
      "base.py",
      "Base Python content",
      "new.py",
      "New Python content",
    );

    // Verify TypeScript was generated with proper config
    expect(converter.generateTypescript).toHaveBeenCalledWith(
      "Base Python content",
      "New Python content",
      "Mock diff",
      "Current TypeScript content",
      {
        provider: "anthropic",
        model: "test-model",
        anthropicApiKey: "test-key",
        openaiApiKey: "",
        temperature: 0.1,
      },
      "",
      undefined,
      true,
    );

    // Verify output was written
    expect(fs.writeFile).toHaveBeenCalledWith(
      "output.ts",
      "Generated TypeScript",
    );

    // Verify info messages were logged
    expect(core.info).toHaveBeenCalledWith("Validating input files...");
    expect(core.info).toHaveBeenCalledWith("Reading input files...");
    expect(core.info).toHaveBeenCalledWith(
      "Generating diff between Python files...",
    );
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("Using LLM"),
    );
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("Writing output"),
    );
    expect(core.info).toHaveBeenCalledWith(
      "Successfully generated TypeScript!",
    );
  });

  it("should handle file not found errors", async () => {
    // Setup mock to simulate a file not found
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error("File not found"));

    // Run the function
    await run();

    // Verify error was handled
    expect(core.setFailed).toHaveBeenCalledWith(
      "Base Python file not found at path: base.py",
    );
  });

  it("should handle read file errors", async () => {
    // Setup mock to simulate a read error
    (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error("Read error"));

    // Run the function
    await run();

    // Verify error was handled
    expect(core.setFailed).toHaveBeenCalledWith(
      "Failed to read file base.py: Read error",
    );
  });

  it("should configure LangSmith when API key is provided", async () => {
    // Setup mock to provide LangSmith API key
    const originalMockImpl = (
      core.getInput as jest.Mock
    ).getMockImplementation();
    (core.getInput as jest.Mock).mockImplementation((name, options) => {
      if (name === "langsmith-api-key") return "langsmith-key";
      if (name === "langsmith-project") return "custom-project";
      // Call the original mock implementation for other inputs
      return originalMockImpl ? originalMockImpl(name, options) : "";
    });

    (path.basename as jest.Mock).mockReturnValue("basename-result");

    // Run the function
    await run();

    // Verify LangSmith config was passed to generateTypescript
    expect(converter.generateTypescript).toHaveBeenCalledWith(
      "Base Python content",
      "New Python content",
      "Mock diff",
      "Current TypeScript content",
      {
        provider: "anthropic",
        model: "test-model",
        anthropicApiKey: "test-key",
        openaiApiKey: "",
        temperature: 0.1,
      },
      "",
      {
        langsmithApiKey: "langsmith-key",
        projectName: "custom-project",
        runName: "basename-result",
      },
      true,
    );

    // Verify the basename function was called with the correct path
    expect(path.basename).toHaveBeenCalledWith("base.py");
  });
});
