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
  temperature: number;
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
    });
  } else if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key is required when using OpenAI provider");
    }
    return new ChatOpenAI({
      apiKey: config.openaiApiKey,
      modelName: config.model,
      temperature: config.temperature,
    });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

/**
 * Extract TypeScript code from an LLM response if wrapped in code blocks.
 */
function extractTypescriptCode(response: string): string {
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

/**
 * Generate TypeScript code using the LLM.
 *
 * @param basePython - Original Python content.
 * @param newPython - New Python content.
 * @param diffText - Diff between the two versions.
 * @param currentTypescript - The current TypeScript adaptation.
 * @param llmConfig - LLM configuration.
 * @param customPrompt - Optional custom rule/message.
 * @param langsmithConfig - Optional LangSmith configuration for tracing.
 * @param verbose - If true, print system and user messages, and LLM output.
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
  // Set LangSmith tracing if configuration is provided.
  if (langsmithConfig && langsmithConfig.langsmithApiKey) {
    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = langsmithConfig.langsmithApiKey;
    process.env.LANGSMITH_PROJECT =
      langsmithConfig.projectName || "pydantic-to-typescript-action";
    process.env.LANGSMITH_RUN = langsmithConfig.runName;
    console.info("LangSmith tracing enabled.");
  } else {
    console.info("LangSmith tracing not enabled.");
  }

  // Define the system prompt with a reminder about the optional custom rule.
  const systemMessage = `
You are a specialized AI tasked with updating TypeScript interface definitions based on changes in Python Pydantic models.
Generate valid TypeScript code that reflects the modifications in the Python models.
Do not include any extra commentary or explanation.

# CONTEXT
I have Python Pydantic models that define an API schema, and a corresponding TypeScript adaptation.
The Python models have been modified, and I need you to update the TypeScript accordingly.

# INPUT
I will provide:
1. The original Python Pydantic models
2. The new Python Pydantic models
3. A diff showing what changed
4. The current TypeScript adaptation

# REMINDER
An optional custom rule/message might be provided as an additional instruction.

# TASK
Generate an updated version of the TypeScript that:
- Incorporates all changes from the Python models.
- Maintains existing styling, naming conventions, and patterns.
- Preserves any TypeScript-specific optimizations and documentation.

# OUTPUT INSTRUCTIONS
Return ONLY the complete, updated TypeScript code with no additional explanation.
Ensure the code is valid and can be saved directly to a file.
  `.trim();

  // Define the user prompt with a placeholder for the custom rule.
  const userMessage = `
# INPUT
1. The original Python Pydantic models:
\`\`\`
{basePython}
\`\`\`

2. The new Python Pydantic models:
\`\`\`
{newPython}
\`\`\`

3. A diff showing what changed:
\`\`\`
{diff}
\`\`\`

4. The current TypeScript adaptation:
\`\`\`
{currentTypescript}
\`\`\`

5. Custom rule/message (if provided):
\`\`\`
{customPrompt}
\`\`\`

# REMINDER: TASK
Generate an updated version of the TypeScript that:
- Incorporates all changes from the Python models.
- Maintains existing styling, naming conventions, and patterns.
- Preserves any TypeScript-specific optimizations and documentation.

# REMINDER: OUTPUT INSTRUCTIONS
Return ONLY the complete, updated TypeScript code with no additional explanation.
Ensure the code is valid and can be saved directly to a file.
  `.trim();

  if (verbose) {
    console.log("System Message:");
    console.log(systemMessage);
    console.log("User Message:");
    console.log(userMessage);
  }

  // Build the LangChain prompt chain.
  const chain = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemMessage),
    HumanMessagePromptTemplate.fromTemplate(userMessage),
  ])
    .pipe(createLLMClient(llmConfig))
    .pipe(new StringOutputParser());

  console.info("Invoking LLM chain...");
  const response = await chain.invoke({
    basePython,
    newPython,
    diff: diffText,
    currentTypescript,
    customPrompt, // Substituted even if empty.
  });

  if (verbose) {
    console.log("LLM Output:");
    console.log(response);
  }

  return extractTypescriptCode(response);
}
