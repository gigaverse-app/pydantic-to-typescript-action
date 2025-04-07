import { BaseChatModel, BaseChatModelCallOptions } from "langchain/chat_models/base";
import { BaseMessage, AIMessage } from "langchain/schema";
import { ChatResult, ChatGeneration } from "langchain/schema";
import { CallbackManagerForLLMRun } from "langchain/callbacks";
import { generateTypescript } from '../converter';

// Mock LLM implementation for testing
class MockLLM extends BaseChatModel<BaseChatModelCallOptions> {
  _llmType(): string {
    return "mock";
  }

  // Storage for mock response
  mockResponse: string;

  constructor(mockResponse: string) {
    super({});
    this.mockResponse = mockResponse;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    // Create proper AIMessage
    const message = new AIMessage(this.mockResponse);
    
    // Create a valid ChatGeneration object
    const generation: ChatGeneration = {
      text: this.mockResponse,
      message: message,
    };

    return {
      generations: [generation],
    };
  }

  async invoke(
    input: BaseMessage[] | string,
    options?: BaseChatModelCallOptions
  ): Promise<AIMessage> {
    // Handle string or BaseMessage[] input
    const messages = typeof input === "string" ? [new AIMessage(input)] : input;
    
    // Return a proper AIMessage
    return new AIMessage({
      content: this.mockResponse,
    });
  }
}

describe('LLM Integration Tests', () => {
  describe('generateTypescript', () => {
    it('should generate TypeScript code from Python models', async () => {
      // Mock TypeScript output
      const mockOutput = `
export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}
`;
      
      // Create mock LLM
      const llm = new MockLLM(mockOutput);
      
      // Sample Python models
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

      // Create a diff
      const diff = `
diff --git a/models.py b/models.py
--- a/models.py
+++ b/models.py
@@ -3,4 +3,5 @@ from typing import List, Optional

 class User(BaseModel):
     id: int
     name: str
     email: str
+    age: Optional[int] = None
`;
      
      // Sample TypeScript
      const currentTypescript = `
export interface User {
  id: number;
  name: string;
  email: string;
}
`;
      
      // Mock the createLLMClient function by manipulating the scope
      // This is a bit hacky, but it's just for the test
      const originalCreateLLMClient = require('../converter').__createLLMClient;
      require('../converter').__createLLMClient = () => llm;
      
      try {
        // Generate TypeScript
        const result = await generateTypescript(
          basePython,
          newPython,
          diff,
          currentTypescript,
          {
            provider: 'anthropic',
            model: 'mock-model',
            temperature: 0.1,
          }
        );
        
        // Verify result
        expect(result).toContain('interface User');
        expect(result).toContain('age?: number');
      } finally {
        // Restore original function
        require('../converter').__createLLMClient = originalCreateLLMClient;
      }
    });
  });
});