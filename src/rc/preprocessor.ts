import type { Token } from "./lexer.ts";
import { RcLexer } from "./lexer.ts";
import { RC_CONSTANTS } from "./constants.ts";
import type { CompilerOptions } from "./types.ts";

export interface PreprocessorResult {
  tokens: Token[];
  symbols: Record<string, number>;
  includedFiles: string[];
}

export class RcPreprocessor {
  private symbols: Record<string, number> = { ...RC_CONSTANTS };
  private includedFiles: string[] = [];
  private options: CompilerOptions;

  constructor(options: CompilerOptions = {}) {
    this.options = options;
  }

  public async process(
    source: string,
    sourcePath?: string
  ): Promise<PreprocessorResult> {
    const lexer = new RcLexer(source);
    const rawTokens = lexer.tokenize();
    const finalTokens = await this.processTokens(rawTokens, sourcePath);
    const nonEof = finalTokens.filter((t) => t.type !== "EOF");
    nonEof.push({
      type: "EOF",
      value: "",
      line: 0,
      column: 0,
    });

    return {
      tokens: nonEof,
      symbols: this.symbols,
      includedFiles: this.includedFiles,
    };
  }

  public processSync(
    source: string,
    sourcePath?: string
  ): PreprocessorResult {
    const lexer = new RcLexer(source);
    const rawTokens = lexer.tokenize();
    const finalTokens = this.processTokensSync(rawTokens, sourcePath);
    const nonEof = finalTokens.filter((t) => t.type !== "EOF");
    nonEof.push({
      type: "EOF",
      value: "",
      line: 0,
      column: 0,
    });

    return {
      tokens: nonEof,
      symbols: this.symbols,
      includedFiles: this.includedFiles,
    };
  }

  private async processTokens(
    tokens: Token[],
    currentPath?: string
  ): Promise<Token[]> {
    const out: Token[] = [];
    let i = 0;
    const condStack: boolean[] = [];

    const isCurrentActive = () => condStack.every((c) => c);

    while (i < tokens.length) {
      const tok = tokens[i];

      if (tok.type === "DIRECTIVE") {
        const dirName = tok.value.toLowerCase();
        i++; // skip directive name

        if (dirName === "ifdef") {
          const symTok = tokens[i++];
          const symName = symTok?.value ?? "";
          condStack.push(symName in this.symbols);
          continue;
        }

        if (dirName === "ifndef") {
          const symTok = tokens[i++];
          const symName = symTok?.value ?? "";
          condStack.push(!(symName in this.symbols));
          continue;
        }

        if (dirName === "else") {
          if (condStack.length > 0) {
            const last = condStack.pop()!;
            condStack.push(!last);
          }
          continue;
        }

        if (dirName === "endif") {
          if (condStack.length > 0) {
            condStack.pop();
          }
          continue;
        }

        if (!isCurrentActive()) {
          // Skip tokens until next directive or end
          continue;
        }

        if (dirName === "define") {
          const nameTok = tokens[i++];
          if (!nameTok || nameTok.type !== "IDENTIFIER") continue;

          // Collect tokens until end of line / next directive or newline
          const defLine = nameTok.line;
          const exprTokens: Token[] = [];
          while (i < tokens.length && tokens[i].line === defLine && tokens[i].type !== "DIRECTIVE" && tokens[i].type !== "EOF") {
            exprTokens.push(tokens[i++]);
          }

          if (exprTokens.length === 0) {
            this.symbols[nameTok.value] = 1;
          } else {
            const val = this.evaluateTokens(exprTokens);
            if (val !== undefined) {
              this.symbols[nameTok.value] = val;
            }
          }
          continue;
        }

        if (dirName === "undef") {
          const nameTok = tokens[i++];
          if (nameTok) {
            delete this.symbols[nameTok.value];
          }
          continue;
        }

        if (dirName === "include") {
          const incTok = tokens[i++];
          if (!incTok) continue;

          let filename = incTok.value;
          // Could be <filename.h> or "filename.h"
          if (filename.startsWith("<") && filename.endsWith(">")) {
            filename = filename.slice(1, -1);
          }

          // Special case: windows.h, afxres.h, winres.h standard stubs
          const lower = filename.toLowerCase();
          if (
            lower === "windows.h" ||
            lower === "winres.h" ||
            lower === "afxres.h" ||
            lower === "winuser.h"
          ) {
            // Already populated in RC_CONSTANTS
            continue;
          }

          const fileContent = await this.resolveAndReadFile(filename, currentPath);
          if (fileContent !== null) {
            const subLexer = new RcLexer(fileContent);
            const subTokens = subLexer.tokenize();
            const processedSub = await this.processTokens(subTokens, filename);
            out.push(...processedSub.filter((t) => t.type !== "EOF"));
          }
          continue;
        }

        // Unknown directive - ignore
        continue;
      }

      if (!isCurrentActive()) {
        i++;
        continue;
      }

      out.push(tok);
      i++;
    }

    return out;
  }

  private processTokensSync(
    tokens: Token[],
    currentPath?: string
  ): Token[] {
    const out: Token[] = [];
    let i = 0;
    const condStack: boolean[] = [];

    const isCurrentActive = () => condStack.every((c) => c);

    while (i < tokens.length) {
      const tok = tokens[i];

      if (tok.type === "DIRECTIVE") {
        const dirName = tok.value.toLowerCase();
        i++; // skip directive name

        if (dirName === "ifdef") {
          const symTok = tokens[i++];
          const symName = symTok?.value ?? "";
          condStack.push(symName in this.symbols);
          continue;
        }

        if (dirName === "ifndef") {
          const symTok = tokens[i++];
          const symName = symTok?.value ?? "";
          condStack.push(!(symName in this.symbols));
          continue;
        }

        if (dirName === "else") {
          if (condStack.length > 0) {
            const last = condStack.pop()!;
            condStack.push(!last);
          }
          continue;
        }

        if (dirName === "endif") {
          if (condStack.length > 0) {
            condStack.pop();
          }
          continue;
        }

        if (!isCurrentActive()) {
          continue;
        }

        if (dirName === "define") {
          const nameTok = tokens[i++];
          if (!nameTok || nameTok.type !== "IDENTIFIER") continue;

          const defLine = nameTok.line;
          const exprTokens: Token[] = [];
          while (i < tokens.length && tokens[i].line === defLine && tokens[i].type !== "DIRECTIVE" && tokens[i].type !== "EOF") {
            exprTokens.push(tokens[i++]);
          }

          if (exprTokens.length === 0) {
            this.symbols[nameTok.value] = 1;
          } else {
            const val = this.evaluateTokens(exprTokens);
            if (val !== undefined) {
              this.symbols[nameTok.value] = val;
            }
          }
          continue;
        }

        if (dirName === "undef") {
          const nameTok = tokens[i++];
          if (nameTok) {
            delete this.symbols[nameTok.value];
          }
          continue;
        }

        if (dirName === "include") {
          const incTok = tokens[i++];
          if (!incTok) continue;

          let filename = incTok.value;
          if (filename.startsWith("<") && filename.endsWith(">")) {
            filename = filename.slice(1, -1);
          }

          const lower = filename.toLowerCase();
          if (
            lower === "windows.h" ||
            lower === "winres.h" ||
            lower === "afxres.h" ||
            lower === "winuser.h"
          ) {
            continue;
          }

          const fileContent = this.resolveAndReadFileSync(filename, currentPath);
          if (fileContent !== null) {
            const subLexer = new RcLexer(fileContent);
            const subTokens = subLexer.tokenize();
            const processedSub = this.processTokensSync(subTokens, filename);
            out.push(...processedSub.filter((t) => t.type !== "EOF"));
          }
          continue;
        }

        continue;
      }

      if (!isCurrentActive()) {
        i++;
        continue;
      }

      out.push(tok);
      i++;
    }

    return out;
  }

  private evaluateTokens(tokens: Token[]): number | undefined {
    let expr = "";
    for (const tok of tokens) {
      if (tok.type === "NUMBER") {
        expr += tok.value;
      } else if (tok.type === "IDENTIFIER") {
        if (tok.value === "NOT") {
          expr += "~";
        } else if (tok.value in this.symbols) {
          expr += this.symbols[tok.value];
        } else {
          expr += "0";
        }
      } else if (tok.type === "PUNCTUATOR") {
        expr += tok.value;
      }
    }

    try {
      // Safe numeric evaluation for bitwise and arithmetic operations
      // Sanitize: only allow numbers, operators, parens
      if (/^[0-9a-fA-FxX\s|&~^()+\-*\/]+$/.test(expr)) {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${expr}) | 0;`);
        return fn();
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private async resolveAndReadFile(
    filename: string,
    currentPath?: string
  ): Promise<string | null> {
    if (this.options.readFile) {
      try {
        const content = await this.options.readFile(filename);
        this.includedFiles.push(filename);
        return content;
      } catch {
        // Continue to check paths
      }
    }

    // Node.js fs fallback if running under Node/Vite
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const candidates: string[] = [];
      if (currentPath) {
        candidates.push(path.resolve(path.dirname(currentPath), filename));
      }
      candidates.push(path.resolve(process.cwd(), filename));
      if (this.options.includeDirs) {
        for (const dir of this.options.includeDirs) {
          candidates.push(path.resolve(dir, filename));
        }
      }

      for (const cand of candidates) {
        try {
          const content = await fs.readFile(cand, "utf-8");
          this.includedFiles.push(cand);
          return content;
        } catch {
          // try next
        }
      }
    } catch {
      // fs not available
    }

    return null;
  }

  private resolveAndReadFileSync(
    filename: string,
    currentPath?: string
  ): string | null {
    if (this.options.readFile) {
      try {
        const content = this.options.readFile(filename);
        if (typeof content === "string") {
          this.includedFiles.push(filename);
          return content;
        }
      } catch {}
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");

      const candidates: string[] = [];
      if (currentPath) {
        candidates.push(path.resolve(path.dirname(currentPath), filename));
      }
      candidates.push(path.resolve(process.cwd(), filename));
      if (this.options.includeDirs) {
        for (const dir of this.options.includeDirs) {
          candidates.push(path.resolve(dir, filename));
        }
      }

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          const content = fs.readFileSync(cand, "utf-8");
          this.includedFiles.push(cand);
          return content;
        }
      }
    } catch {}

    return null;
  }
}
