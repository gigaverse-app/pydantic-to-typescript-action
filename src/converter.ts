import * as diff from 'diff';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

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
  file2Content: string
): string {
  // First create the standard patch
  const standardPatch = diff.createPatch(
    file1Path,
    file1Content,
    file2Content,
    'Original',
    'Modified'
  );
  
  // Convert to Git-style diff format
  const gitStyleDiff = `diff --git a/${file1Path} b/${file2Path}
--- a/${file1Path}
+++ b/${file2Path}
${standardPatch.split('\n').slice(4).join('\n')}`;

  return gitStyleDiff;
}

/**
 * Create an LLM client based on the provider
 */
function createLLMClient(config: LLMConfig): BaseChatModel {
  if (config.provider === 'anthropic') {
    if (!config.anthropicApiKey) {
      throw new Error('Anthropic API key is required when using Anthropic provider');
    }
    
    return new ChatAnthropic({
      apiKey: config.anthropicApiKey,
      modelName: config.model,
      temperature: config.temperature,
    });
  } else if (config.provider === 'openai') {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is required when using OpenAI provider');
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
 * Create the prompt for the LLM
 */
function createPrompt(
  basePython: string,
  newPython: string,
  diff: string,
  currentTypescript: string
): string {
  return `
You are a specialized AI tasked with updating TypeScript interface definitions based on changes in Python Pydantic models.

# CONTEXT
I have Python Pydantic models that define an API schema, and a corresponding TypeScript adaptation.
The Python models have been modified, and I need you to update the TypeScript accordingly.

# INPUT
I will provide:
1. The original Python Pydantic models
2. The new Python Pydantic models with changes
3. A diff showing what changed in the Python models
4. The current TypeScript adaptation

# TASK
Generate an updated version of the TypeScript that:
1. Incorporates all changes from the Python models (added/removed/modified fields and models)
2. Maintains the exact same styling, naming conventions, and patterns as the current TypeScript
3. Preserves any TypeScript-specific optimizations or adaptations
4. Includes all comments and documentation from the current TypeScript where still relevant

# ORIGINAL PYTHON PYDANTIC MODELS
\`\`\`python
${basePython}
\`\`\`

# NEW PYTHON PYDANTIC MODELS
\`\`\`python
${newPython}
\`\`\`

# PYTHON DIFF
\`\`\`diff
${diff}
\`\`\`

# CURRENT TYPESCRIPT
\`\`\`typescript
${currentTypescript}
\`\`\`

# OUTPUT INSTRUCTIONS
1. Return ONLY the complete, updated TypeScript code with no additional explanation
2. Do not explain the changes - just provide the final code
3. Ensure ALL existing TypeScript conventions are preserved
4. The response should be valid TypeScript that can be directly saved to a file

# UPDATED TYPESCRIPT OUTPUT:
`;
}

/**
 * Extract TypeScript code from LLM response if wrapped in code blocks
 */
function extractTypescriptCode(response: string): string {
  // Check if the response is wrapped in code blocks
  const typescriptBlockMatch = response.match(/```typescript\s*([\s\S]*?)\s*```/);
  if (typescriptBlockMatch && typescriptBlockMatch[1]) {
    return typescriptBlockMatch[1].trim();
  }
  
  // Also check for ts code blocks
  const tsBlockMatch = response.match(/```ts\s*([\s\S]*?)\s*```/);
  if (tsBlockMatch && tsBlockMatch[1]) {
    return tsBlockMatch[1].trim();
  }
  
  // If no code blocks, assume the whole response is code (trimming potential explanatory text)
  return response.replace(/^(.*?)```/s, '').replace(/```.*$/s, '').trim();
}

/**
 * Generate TypeScript code using the LLM
 */
export async function generateTypescript(
  basePython: string,
  newPython: string,
  diff: string,
  currentTypescript: string,
  llmConfig: LLMConfig
): Promise<string> {
  // Create LLM client
  const llm = createLLMClient(llmConfig);
  
  // Create prompt
  const prompt = createPrompt(basePython, newPython, diff, currentTypescript);
  
  // Create chain
  const chain = ChatPromptTemplate.fromTemplate(prompt)
    .pipe(llm)
    .pipe(new StringOutputParser());
  
  // Run chain
  const response = await chain.invoke({});
  
  // Extract TypeScript code
  return extractTypescriptCode(response);
}