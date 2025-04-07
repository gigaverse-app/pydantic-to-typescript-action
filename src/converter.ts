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

export type LLMConfig = {
  provider: string;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  temperature: number;
};

/**
 * Create a diff between two files
 */
export function createDiff(
  file1Path: string,
  file1Content: string,
  file2Path: string,
  file2Content: string,
): string {
  // Create the standard patch
  const standardPatch = diff.createPatch(
    file1Path,
    file1Content,
    file2Content,
    "Original",
    "Modified",
  );

  // Convert to Git-style diff format
  const gitStyleDiff = `diff --git a/${file1Path} b/${file2Path}
--- a/${file1Path}
+++ b/${file2Path}
${standardPatch.split("\n").slice(4).join("\n")}`;

  return gitStyleDiff;
}

/**
 * Create an LLM client based on the provider.
 * Exported to allow mocking in tests.
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
 * Extract TypeScript code from LLM response if wrapped in code blocks.
 */
function extractTypescriptCode(response: string): string {
  // Check if the response is wrapped in code blocks
  const typescriptBlockMatch = response.match(
    /```typescript\s*([\s\S]*?)\s*```/,
  );
  if (typescriptBlockMatch && typescriptBlockMatch[1]) {
    return typescriptBlockMatch[1].trim();
  }

  // Also check for ts code blocks
  const tsBlockMatch = response.match(/```ts\s*([\s\S]*?)\s*```/);
  if (tsBlockMatch && tsBlockMatch[1]) {
    return tsBlockMatch[1].trim();
  }

  // If no code blocks, assume the whole response is code (trimming potential extra text)
  return response
    .replace(/^(.*?)```/s, "")
    .replace(/```.*$/s, "")
    .trim();
}

/**
 * Generate TypeScript code using the LLM.
 *
 * This updated version uses:
 * 1. A system prompt for static context and instructions.
 * 2. A user (human) prompt with LangChain placeholders.
 * 3. The chain’s invoke function to provide the input data (via placeholder substitution).
 */
export async function generateTypescript(
  basePython: string,
  newPython: string,
  diffText: string,
  currentTypescript: string,
  llmConfig: LLMConfig,
  customPrompt?: string,
): Promise<string> {
  // Create the LLM client from the configuration
  const llm = createLLMClient(llmConfig);

  // Define a static system prompt (background context and rules)
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
5. An optional custom rule/message might be provided as an additional instruction.

# TASK
Generate an updated version of the TypeScript that:
- Incorporates all changes from the Python models (added/removed/modified fields or models).
- Maintains all existing styling, naming conventions, and patterns.
- Preserves TypeScript-specific optimizations and documentation.

# OUTPUT INSTRUCTIONS
Return ONLY the complete, updated TypeScript code with no additional explanation.
Ensure the code is valid and can be saved directly to a file.
  `.trim();

  // Define a user prompt with LangChain placeholders.
  // Note that the placeholders (e.g., {basePython}) are left as-is.
  const userMessage = `
# INPUT
1. The original Python Pydantic models:
\`\`\`
{basePython})
\`\`\`

2. The new Python Pydantic models
\`\`\`
{newPython}
\`\`\`

3. A diff showing what changed
\`\`\`
{diff}
\`\`\`

4. The current TypeScript adaptation
\`\`\`
{currentTypescript}
\`\`\`

5. Custom rule/message (if provided):
\`\`\`
{customPrompt}
\`\`\`

# Reminder: TASK
Generate an updated version of the TypeScript that:
- Incorporates all changes from the Python models (added/removed/modified fields or models).
- Maintains all existing styling, naming conventions, and patterns.
- Preserves TypeScript-specific optimizations and documentation.

# Reminder: OUTPUT INSTRUCTIONS
Return ONLY the complete, updated TypeScript code with no additional explanation.
Ensure the code is valid and can be saved directly to a file.
  `.trim();

  // Build the chain using separate system and human (user) message templates.
  const chain = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemMessage),
    HumanMessagePromptTemplate.fromTemplate(userMessage),
  ])
    .pipe(llm)
    .pipe(new StringOutputParser());

  // Provide the dynamic input values via the chain.invoke call.
  // These inputs will be substituted into the placeholders in the user prompt.
  const response = await chain.invoke({
    basePython,
    newPython,
    diff: diffText,
    currentTypescript,
    customPrompt,
  });

  // Extract TypeScript code from the LLM response and return it.
  return extractTypescriptCode(response);
}
