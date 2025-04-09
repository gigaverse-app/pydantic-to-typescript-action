import * as core from "@actions/core";
import * as fs from "fs/promises";
import path from "path";
import {
  createDiff,
  generateTypescript,
  LLMConfig,
  LangSmithConfig,
} from "./converter";

/**
 * Reads a file and returns its contents as a string.
 * @param filePath Path to the file to read
 * @returns The file contents as a string
 * @throws Error if file cannot be read
 */
async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validates that a file exists at the given path.
 * @param filePath Path to validate
 * @param fileDescription Description of the file (for error messages)
 * @throws Error if file does not exist
 */
async function validateFilePath(
  filePath: string,
  fileDescription: string,
): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${fileDescription} not found at path: ${filePath}`);
  }
}

/**
 * Main function to run the GitHub Action.
 */
export async function run(): Promise<void> {
  try {
    // Get required inputs
    const basePythonFile = core.getInput("base-python-file", {
      required: true,
    });
    const newPythonFile = core.getInput("new-python-file", { required: true });
    const currentTypescriptFile = core.getInput("current-typescript-file", {
      required: true,
    });
    const outputTypescriptFile = core.getInput("output-typescript-file", {
      required: true,
    });

    // Get optional inputs with defaults
    const modelProvider = core.getInput("model-provider") || "anthropic";
    const modelName = core.getInput("model-name") || "claude-3-7-sonnet-latest";
    const temperature = parseFloat(core.getInput("temperature") || "0.1");
    const customPrompt = core.getInput("custom-prompt");
    const verboseInput = core.getInput("verbose");
    const verbose = verboseInput.toLowerCase() !== "false";

    // API keys
    const anthropicApiKey = core.getInput("anthropic-api-key");
    const openaiApiKey = core.getInput("openai-api-key");

    // LangSmith configuration (optional)
    const langsmithApiKey = core.getInput("langsmith-api-key");
    const langsmithProject = core.getInput("langsmith-project");

    // Validate file paths
    core.info("Validating input files...");
    await validateFilePath(basePythonFile, "Base Python file");
    await validateFilePath(newPythonFile, "New Python file");
    await validateFilePath(currentTypescriptFile, "Current TypeScript file");

    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputTypescriptFile);
    await fs.mkdir(outputDir, { recursive: true });

    // Read files
    core.info("Reading input files...");
    const basePython = await readFile(basePythonFile);
    const newPython = await readFile(newPythonFile);
    const currentTypescript = await readFile(currentTypescriptFile);

    // Generate diff
    core.info("Generating diff between Python files...");
    const diff = createDiff(
      basePythonFile,
      basePython,
      newPythonFile,
      newPython,
    );

    // Configure LLM
    const llmConfig: LLMConfig = {
      provider: modelProvider,
      model: modelName,
      anthropicApiKey,
      openaiApiKey,
      temperature,
    };

    // Configure LangSmith if API key is provided
    let langsmithConfig: LangSmithConfig | undefined;
    if (langsmithApiKey) {
      langsmithConfig = {
        langsmithApiKey,
        projectName: langsmithProject,
        runName: path.basename(basePythonFile),
      };
    }

    // Log configuration
    core.info(`Verbose mode is ${verbose ? "enabled" : "disabled"}.`);
    core.info(
      `LangSmith tracing: ${langsmithConfig ? "enabled" : "not enabled"}.`,
    );
    core.info(
      `Using LLM (${modelProvider} - ${modelName}) to generate TypeScript...`,
    );

    // Generate TypeScript using the LLM
    const updatedTypescript = await generateTypescript(
      basePython,
      newPython,
      diff,
      currentTypescript,
      llmConfig,
      customPrompt,
      langsmithConfig,
      verbose,
    );

    // Write output file
    core.info(`Writing output to ${outputTypescriptFile}...`);
    await fs.writeFile(outputTypescriptFile, updatedTypescript);

    core.info("Successfully generated TypeScript!");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

// Execute the run function
void run();
