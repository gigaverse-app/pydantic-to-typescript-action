import * as core from "@actions/core";
import * as fs from "fs/promises";
import path from "path";
import { createDiff, generateTypescript, LangSmithConfig } from "./converter";

export async function run(): Promise<void> {
  try {
    // Get inputs
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
    const modelProvider = core.getInput("model-provider") || "anthropic";
    const modelName = core.getInput("model-name") || "claude-3-7-sonnet-latest";
    const temperature = parseFloat(core.getInput("temperature") || "0.1");

    // API keys
    const anthropicApiKey = core.getInput("anthropic-api-key");
    const openaiApiKey = core.getInput("openai-api-key");

    // Custom prompt (optional)
    const customPrompt = core.getInput("custom-prompt");

    // LangSmith inputs (optional)
    const langsmithApiKey = core.getInput("langsmith-api-key");
    const langsmithProject = core.getInput("langsmith-project");

    // Verbose mode (default is true; treat any value other than "false" as true)
    const verboseInput = core.getInput("verbose");
    const verbose = verboseInput.toLowerCase() !== "false";

    // Validate file paths
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

    // Determine run name based on the base Python file name
    const runName = path.basename(basePythonFile);

    // Prepare optional LangSmith configuration if provided
    const langsmithConfig: LangSmithConfig | undefined = langsmithApiKey
      ? { langsmithApiKey, projectName: langsmithProject, runName }
      : undefined;

    core.info(`Verbose mode is ${verbose ? "enabled" : "disabled"}.`);
    core.info(
      `LangSmith tracing: ${langsmithConfig ? "enabled" : "not enabled"}.`,
    );

    // Generate TypeScript using the LLM, passing in the verbose flag
    core.info(
      `Using LLM (${modelProvider} - ${modelName}) to generate TypeScript...`,
    );
    const updatedTypescript = await generateTypescript(
      basePython,
      newPython,
      diff,
      currentTypescript,
      {
        provider: modelProvider,
        model: modelName,
        anthropicApiKey,
        openaiApiKey,
        temperature,
      },
      customPrompt, // Optional custom prompt
      langsmithConfig, // Optional LangSmith tracing configuration
      verbose, // Verbose flag
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

async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

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

// Execute the run function
void run();
