export interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
}

export interface ProcessResult {
  changes: FileChange[];
  appliedCodemods: string[];
  summary: string;
}
