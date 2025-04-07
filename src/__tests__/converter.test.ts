import { createDiff } from '../converter';

describe('converter', () => {
  describe('createDiff', () => {
    it('should create a diff between two files', () => {
      const file1Path = 'models.py';
      const file1Content = `
from pydantic import BaseModel
from typing import List, Optional

class User(BaseModel):
    id: int
    name: str
    email: str
`;

      const file2Path = 'models.py';
      const file2Content = `
from pydantic import BaseModel
from typing import List, Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
`;

      const diff = createDiff(file1Path, file1Content, file2Path, file2Content);
      
      // Basic checks that the diff contains what we expect
      expect(diff).toContain('diff --git');
      expect(diff).toContain('+    age: Optional[int] = None');
    });
  });
});