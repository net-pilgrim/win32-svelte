export type TokenType =
  | "IDENTIFIER"
  | "NUMBER"
  | "STRING"
  | "PUNCTUATOR"
  | "DIRECTIVE"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  numberValue?: number;
  line: number;
  column: number;
}

export class RcLexer {
  private pos = 0;
  private line = 1;
  private column = 1;
  private readonly source: string;
  private readonly length: number;

  constructor(source: string) {
    this.source = source;
    this.length = source.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.isEof()) {
      this.skipWhitespace();
      if (this.isEof()) break;

      const char = this.peek();

      // Comment check
      if (char === "/" && this.peek(1) === "/") {
        this.skipLineComment();
        continue;
      }
      if (char === "/" && this.peek(1) === "*") {
        this.skipBlockComment();
        continue;
      }

      // Preprocessor directive (#include, #define, etc.)
      if (char === "#") {
        tokens.push(this.readDirective());
        continue;
      }

      // String literal
      if (char === '"') {
        tokens.push(this.readString());
        // Handle adjacent string literals concatenation: "A" "B" -> "AB"
        while (true) {
          const savePos = this.pos;
          const saveLine = this.line;
          const saveCol = this.column;
          this.skipWhitespace();
          if (this.peek() === '"') {
            const nextStr = this.readString();
            const lastToken = tokens[tokens.length - 1];
            lastToken.value += nextStr.value;
          } else {
            this.pos = savePos;
            this.line = saveLine;
            this.column = saveCol;
            break;
          }
        }
        continue;
      }

      // Numbers (decimal or hex: 0x...)
      if (
        (char >= "0" && char <= "9") ||
        (char === "-" && this.isDigit(this.peek(1)))
      ) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers & keywords
      if (this.isIdentifierStart(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Punctuators and single/double character operators
      if (
        char === "," ||
        char === "|" ||
        char === "&" ||
        char === "^" ||
        char === "~" ||
        char === "+" ||
        char === "-" ||
        char === "(" ||
        char === ")" ||
        char === "{" ||
        char === "}" ||
        char === "=" ||
        char === ":"
      ) {
        const startLine = this.line;
        const startCol = this.column;
        this.advance();
        tokens.push({
          type: "PUNCTUATOR",
          value: char,
          line: startLine,
          column: startCol,
        });
        continue;
      }

      // Unknown character - advance and report
      const startLine = this.line;
      const startCol = this.column;
      const unk = this.advance();
      tokens.push({
        type: "PUNCTUATOR",
        value: unk,
        line: startLine,
        column: startCol,
      });
    }

    tokens.push({
      type: "EOF",
      value: "",
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private isEof(): boolean {
    return this.pos >= this.length;
  }

  private peek(offset = 0): string {
    const p = this.pos + offset;
    return p < this.length ? this.source[p] : "";
  }

  private advance(): string {
    if (this.isEof()) return "";
    const char = this.source[this.pos++];
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (!this.isEof()) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.advance();
      } else {
        break;
      }
    }
  }

  private skipLineComment(): void {
    this.advance(); // /
    this.advance(); // /
    while (!this.isEof() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    this.advance(); // /
    this.advance(); // *
    while (!this.isEof()) {
      if (this.peek() === "*" && this.peek(1) === "/") {
        this.advance();
        this.advance();
        break;
      }
      this.advance();
    }
  }

  private readDirective(): Token {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // skip '#'
    let name = "";
    while (this.isIdentifierPart(this.peek())) {
      name += this.advance();
    }
    return {
      type: "DIRECTIVE",
      value: name,
      line: startLine,
      column: startCol,
    };
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // skip opening quote '"'
    let content = "";

    while (!this.isEof()) {
      const c = this.peek();
      if (c === '"') {
        // Double quote escape: "" -> " in RC scripts
        if (this.peek(1) === '"') {
          content += '"';
          this.advance();
          this.advance();
          continue;
        }
        this.advance(); // skip closing quote
        break;
      } else if (c === "\\") {
        this.advance();
        const esc = this.advance();
        if (esc === "n") content += "\n";
        else if (esc === "t") content += "\t";
        else if (esc === "r") content += "\r";
        else if (esc === '"') content += '"';
        else if (esc === "\\") content += "\\";
        else content += esc;
      } else {
        content += this.advance();
      }
    }

    return {
      type: "STRING",
      value: content,
      line: startLine,
      column: startCol,
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let raw = "";

    if (this.peek() === "-") {
      raw += this.advance();
    }

    if (this.peek() === "0" && (this.peek(1) === "x" || this.peek(1) === "X")) {
      raw += this.advance(); // 0
      raw += this.advance(); // x
      while (this.isHexDigit(this.peek())) {
        raw += this.advance();
      }
      // Possible suffix 'L' or 'U'
      if (this.peek() === "L" || this.peek() === "l" || this.peek() === "U" || this.peek() === "u") {
        this.advance();
      }
      const num = parseInt(raw, 16);
      return {
        type: "NUMBER",
        value: raw,
        numberValue: Number.isNaN(num) ? 0 : (num | 0),
        line: startLine,
        column: startCol,
      };
    }

    while (this.isDigit(this.peek())) {
      raw += this.advance();
    }
    if (this.peek() === "L" || this.peek() === "l" || this.peek() === "U" || this.peek() === "u") {
      this.advance();
    }

    const num = parseInt(raw, 10);
    return {
      type: "NUMBER",
      value: raw,
      numberValue: Number.isNaN(num) ? 0 : (num | 0),
      line: startLine,
      column: startCol,
    };
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private isHexDigit(c: string): boolean {
    return (
      (c >= "0" && c <= "9") ||
      (c >= "a" && c <= "f") ||
      (c >= "A" && c <= "F")
    );
  }

  private isIdentifierStart(c: string): boolean {
    return (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      c === "_"
    );
  }

  private isIdentifierPart(c: string): boolean {
    return (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9") ||
      c === "_"
    );
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let name = "";
    while (this.isIdentifierPart(this.peek())) {
      name += this.advance();
    }
    return {
      type: "IDENTIFIER",
      value: name,
      line: startLine,
      column: startCol,
    };
  }
}
