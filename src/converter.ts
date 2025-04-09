import fs from "fs";
import path from "path";
import * as diff from "diff";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "test" ? "error" : "info",
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === "test", // Mutes logging during tests.
    }),
  ],
});

export default logger;


// Define types for LangSmith configuration and LLM configuration.
export type LangSmithConfig = {
  langsmithApiKey: string;
  projectName?: string;
  runName: string;
};

export type LLMConfig = {
  provider: string;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Create a diff between two files.
 */
export function createDiff(
  file1Path: string,
  file1Content: string,
  file2Path: string,
  file2Content: string,
): string {
  const standardPatch = diff.createPatch(
    file1Path,
    file1Content,
    file2Content,
    "Original",
    "Modified",
  );
  return `diff --git a/${file1Path} b/${file2Path}
--- a/${file1Path}
+++ b/${file2Path}
${standardPatch.split("\n").slice(4).join("\n")}`;
}

/**
 * Create an LLM client based on the provider.
 */
export function createLLMClient(config: LLMConfig): BaseChatModel {
  // Default to a high max tokens if not specified
  const maxTokens = config.maxTokens || 10000;

  if (config.provider === "anthropic") {
    if (!config.anthropicApiKey) {
      throw new Error(
        "Anthropic API key is required when using Anthropic provider",
      );
    }

    return new ChatAnthropic({
      apiKey: config.anthropicApiKey,
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: maxTokens,
      streaming: true, // Enable streaming if supported
    });
  } else if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key is required when using OpenAI provider");
    }

    return new ChatOpenAI({
      apiKey: config.openaiApiKey,
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: maxTokens,
      streaming: true, // Enable streaming
    });
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

/**
 * Extract TypeScript code from an LLM response if wrapped in code blocks.
 */
export function extractTypescriptCode(response: string): string {
  const typescriptBlockMatch = response.match(
    /```typescript\s*([\s\S]*?)\s*```/,
  );
  if (typescriptBlockMatch && typescriptBlockMatch[1]) {
    return typescriptBlockMatch[1].trim();
  }
  const tsBlockMatch = response.match(/```ts\s*([\s\S]*?)\s*```/);
  if (tsBlockMatch && tsBlockMatch[1]) {
    return tsBlockMatch[1].trim();
  }
  return response
    .replace(/^(.*?)```/s, "")
    .replace(/```.*$/s, "")
    .trim();
}

// Helper function to read prompt files
function readPromptFile(filename: string): string {
  try {
    // First try to read from the same directory as the current module
    return fs.readFileSync(path.join(__dirname, filename), 'utf8').trim();
  } catch (err) {
    // If that fails, try to read from the src directory
    try {
      return fs.readFileSync(path.join(__dirname, '../src', filename), 'utf8').trim();
    } catch (innerErr) {
      // If that also fails, check current working directory
      try {
        return fs.readFileSync(path.join(process.cwd(), 'src', filename), 'utf8').trim();
      } catch (finalErr) {
        console.error(`Error reading prompt file ${filename}: ${finalErr}`);
        throw new Error(`Could not find prompt file: ${filename}`);
      }
    }
  }
}

/**
 * Generate TypeScript code using the LLM with streaming output.
 *
 * Reads the system and user prompts from external text files, specializes them using the template parameters,
 * and logs the specialized prompts using a test-friendly logger.
 *
 * @param basePython - Original Python content.
 * @param newPython - New Python content.
 * @param diffText - Diff between the two versions.
 * @param currentTypescript - The current TypeScript adaptation.
 * @param llmConfig - LLM configuration.
 * @param customPrompt - Optional custom rule/message.
 * @param langsmithConfig - Optional LangSmith configuration for tracing.
 * @param verbose - If true, print messages and each streaming chunk.
 */
export async function generateTypescript(
  basePython: string,
  newPython: string,
  diffText: string,
  currentTypescript: string,
  llmConfig: LLMConfig,
  customPrompt?: string,
  langsmithConfig?: LangSmithConfig,
  verbose: boolean = true,
): Promise<string> {
  // Enable LangSmith tracing if configuration is provided.
  if (langsmithConfig && langsmithConfig.langsmithApiKey) {
    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = langsmithConfig.langsmithApiKey;
    process.env.LANGSMITH_PROJECT =
      langsmithConfig.projectName || "pydantic-to-typescript-action";
    process.env.LANGSMITH_RUN = langsmithConfig.runName;
    logger.info("LangSmith tracing enabled.");
  } else {
    logger.info("LangSmith tracing not enabled.");
  }

  // Read the prompts from external files.
  const systemPrompt = readPromptFile("system_prompt.txt")
  const userPromptTemplate = readPromptFile("user_prompt.txt")

  // Build the formatted user message by replacing placeholders.
  const userMessage = userPromptTemplate
    .replace("{basePython}", basePython)
    .replace("{newPython}", newPython)
    .replace("{diff}", diffText)
    .replace("{currentTypescript}", currentTypescript)
    .replace("{customPrompt}", customPrompt || "");

  // Log the specialized prompts.
  if (verbose) {
    logger.info("Specialized System Prompt:");
    logger.info(systemPrompt);
    logger.info("Specialized User Prompt:");
    logger.info(userMessage);
  }

  // Build the LangChain prompt chain using prompts from files.
  const chain = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate(userMessage),
  ])
    .pipe(createLLMClient(llmConfig))
    .pipe(new StringOutputParser());

  logger.info("Invoking LLM chain with streaming output...");

  // Use .stream() to receive output tokens as they are generated.
  const stream = await chain.stream({
    basePython,
    newPython,
    diff: diffText,
    currentTypescript,
    customPrompt, // Provided even if empty.
  });

  let fullOutput = "";
  for await (const chunk of stream) {
    fullOutput += chunk;
    if (verbose) {
      logger.info("Streaming chunk:", chunk);
    }
  }

  logger.info("LLM streaming complete. Final output received.");

  return extractTypescriptCode(fullOutput);
}
