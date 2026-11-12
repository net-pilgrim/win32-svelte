import type { Token } from "./lexer.ts";
import type {
  ResourceBundle,
  DialogTemplate,
  DialogControlTemplate,
  DialogFont,
  MenuTemplate,
  MenuItemTemplate,
  AcceleratorTable,
  AcceleratorItem,
} from "./types.ts";
import { RC_CONSTANTS } from "./constants.ts";

export class RcParser {
  private tokens: Token[];
  private pos = 0;
  private symbols: Record<string, number>;

  constructor(tokens: Token[], symbols: Record<string, number> = {}) {
    this.tokens = tokens;
    this.symbols = { ...RC_CONSTANTS, ...symbols };
  }

  public parse(): ResourceBundle {
    const bundle: ResourceBundle = {
      dialogs: {},
      menus: {},
      stringTable: {},
      accelerators: {},
      icons: {},
      bitmaps: {},
      symbols: this.symbols,
    };

    while (!this.isEof()) {
      const tok = this.peek();
      if (tok.type === "EOF") break;

      // Check if keyword at top-level
      const upper = tok.value.toUpperCase();

      if (upper === "STRINGTABLE") {
        this.advance(); // skip STRINGTABLE
        this.parseStringTable(bundle.stringTable);
        continue;
      }

      // name or ID followed by resource type
      const idToken = this.advance();
      if (this.isEof()) break;

      const typeToken = this.peek();
      const typeUpper = typeToken.value.toUpperCase();

      if (typeUpper === "DIALOG" || typeUpper === "DIALOGEX") {
        this.advance(); // skip DIALOG/DIALOGEX
        const isExtended = typeUpper === "DIALOGEX";
        const dlg = this.parseDialog(idToken, isExtended);
        const key = typeof dlg.id === "string" ? dlg.id : String(dlg.id);
        bundle.dialogs[key] = dlg;
        if (dlg.name && dlg.name !== key) {
          bundle.dialogs[dlg.name] = dlg;
        }
        continue;
      }

      if (typeUpper === "MENU" || typeUpper === "MENUEX") {
        this.advance(); // skip MENU/MENUEX
        const menu = this.parseMenu(idToken);
        const key = typeof menu.id === "string" ? menu.id : String(menu.id);
        bundle.menus[key] = menu;
        if (menu.name && menu.name !== key) {
          bundle.menus[menu.name] = menu;
        }
        continue;
      }

      if (typeUpper === "ACCELERATORS") {
        this.advance(); // skip ACCELERATORS
        const accel = this.parseAccelerators(idToken);
        const key = typeof accel.id === "string" ? accel.id : String(accel.id);
        bundle.accelerators[key] = accel;
        if (accel.name && accel.name !== key) {
          bundle.accelerators[accel.name] = accel;
        }
        continue;
      }

      if (typeUpper === "ICON") {
        this.advance();
        const fileToken = this.advance();
        bundle.icons[idToken.value] = fileToken.value;
        continue;
      }

      if (typeUpper === "BITMAP") {
        this.advance();
        const fileToken = this.advance();
        bundle.bitmaps[idToken.value] = fileToken.value;
        continue;
      }

      // Unknown or unsupported top-level statement - advance to avoid infinite loop
    }

    return bundle;
  }

  private parseDialog(idToken: Token, isExtended: boolean): DialogTemplate {
    // Coordinates: x, y, width, height [, helpID]
    this.skipOptionalKeyword("DISCARDABLE");
    this.skipOptionalKeyword("LOADONCALL");
    this.skipOptionalKeyword("MOVEABLE");
    this.skipOptionalKeyword("PRELOAD");
    this.skipOptionalKeyword("PURE");

    let x = 0;
    let y = 0;
    let width = 300;
    let height = 180;
    let helpId: number | undefined;

    // Check if next token is number/expression
    if (this.isExpressionStart(this.peek())) {
      x = this.parseExpression();
      this.consumeOptional(",");
      y = this.parseExpression();
      this.consumeOptional(",");
      width = this.parseExpression();
      this.consumeOptional(",");
      height = this.parseExpression();

      if (this.peek().value === ",") {
        this.advance();
        helpId = this.parseExpression();
      }
    }

    let caption = "Dialog";
    let style =
      RC_CONSTANTS.WS_POPUP |
      RC_CONSTANTS.WS_CAPTION |
      RC_CONSTANTS.WS_SYSMENU |
      RC_CONSTANTS.DS_MODALFRAME;
    let exStyle = 0;
    let font: DialogFont | undefined;
    let menu: number | string | undefined;
    let className: string | undefined;

    // Read attributes until BEGIN or {
    while (!this.isEof() && !this.isBlockStart(this.peek())) {
      const attr = this.peek().value.toUpperCase();

      if (attr === "CAPTION") {
        this.advance();
        caption = this.expectString();
      } else if (attr === "STYLE") {
        this.advance();
        style = this.parseExpression();
      } else if (attr === "EXSTYLE") {
        this.advance();
        exStyle = this.parseExpression();
      } else if (attr === "FONT") {
        this.advance();
        const pointSize = this.parseExpression();
        this.consumeOptional(",");
        const typeface = this.expectString();
        let weight: number | undefined;
        let italic: boolean | undefined;
        let charset: number | undefined;

        if (this.consumeOptional(",")) {
          weight = this.parseExpression();
          if (this.consumeOptional(",")) {
            italic = Boolean(this.parseExpression());
            if (this.consumeOptional(",")) {
              charset = this.parseExpression();
            }
          }
        }
        font = { pointSize, typeface, weight, italic, charset };
      } else if (attr === "MENU") {
        this.advance();
        menu = this.parseIdOrString();
      } else if (attr === "CLASS") {
        this.advance();
        className = String(this.parseIdOrString());
      } else {
        // Skip unknown attribute and its possible expression
        this.advance();
        if (this.isExpressionStart(this.peek()) || this.peek().type === "STRING") {
          this.advance();
        }
      }
    }

    this.expectBlockStart();

    const controls: DialogControlTemplate[] = [];

    // Controls until END or }
    while (!this.isEof() && !this.isBlockEnd(this.peek())) {
      const ctrl = this.parseControlStatement();
      if (ctrl) {
        controls.push(ctrl);
      }
    }

    this.expectBlockEnd();

    const idVal = this.resolveId(idToken);

    return {
      id: idVal,
      name: idToken.value,
      isExtended,
      x,
      y,
      width,
      height,
      helpId,
      caption,
      style,
      exStyle,
      font,
      menu,
      className,
      controls,
    };
  }

  private parseControlStatement(): DialogControlTemplate | null {
    const typeToken = this.advance();
    const type = typeToken.value.toUpperCase();

    // 1. Text controls with text as first param:
    // LTEXT, RTEXT, CTEXT, PUSHBUTTON, DEFPUSHBUTTON, GROUPBOX,
    // CHECKBOX, AUTOCHECKBOX, RADIOBUTTON, AUTORADIOBUTTON, AUTO3STATE
    if (
      type === "LTEXT" ||
      type === "RTEXT" ||
      type === "CTEXT" ||
      type === "PUSHBUTTON" ||
      type === "DEFPUSHBUTTON" ||
      type === "GROUPBOX" ||
      type === "CHECKBOX" ||
      type === "AUTOCHECKBOX" ||
      type === "RADIOBUTTON" ||
      type === "AUTORADIOBUTTON" ||
      type === "AUTO3STATE"
    ) {
      const text = this.expectString();
      this.consumeOptional(",");
      const idToken = this.peek();
      const id = this.parseId();
      this.consumeOptional(",");
      const x = this.parseExpression();
      this.consumeOptional(",");
      const y = this.parseExpression();
      this.consumeOptional(",");
      const width = this.parseExpression();
      this.consumeOptional(",");
      const height = this.parseExpression();

      let extraStyle = 0;
      let exStyle = 0;
      let helpId: number | undefined;

      if (this.consumeOptional(",")) {
        extraStyle = this.parseExpression();
        if (this.consumeOptional(",")) {
          exStyle = this.parseExpression();
          if (this.consumeOptional(",")) {
            helpId = this.parseExpression();
          }
        }
      }

      let defaultStyle = RC_CONSTANTS.WS_CHILD | RC_CONSTANTS.WS_VISIBLE;
      let className = "STATIC";

      if (type === "LTEXT") {
        defaultStyle |= RC_CONSTANTS.SS_LEFT;
      } else if (type === "RTEXT") {
        defaultStyle |= RC_CONSTANTS.SS_RIGHT;
      } else if (type === "CTEXT") {
        defaultStyle |= RC_CONSTANTS.SS_CENTER;
      } else if (type === "PUSHBUTTON") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_PUSHBUTTON;
      } else if (type === "DEFPUSHBUTTON") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_DEFPUSHBUTTON;
      } else if (type === "GROUPBOX") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.BS_GROUPBOX;
      } else if (type === "CHECKBOX") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_CHECKBOX;
      } else if (type === "AUTOCHECKBOX") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_AUTOCHECKBOX;
      } else if (type === "RADIOBUTTON") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_RADIOBUTTON;
      } else if (type === "AUTORADIOBUTTON") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_AUTORADIOBUTTON;
      } else if (type === "AUTO3STATE") {
        className = "BUTTON";
        defaultStyle |= RC_CONSTANTS.WS_TABSTOP | RC_CONSTANTS.BS_AUTO3STATE;
      }

      return {
        id,
        idName: idToken.value,
        type,
        className,
        text,
        x,
        y,
        width,
        height,
        style: defaultStyle | extraStyle,
        exStyle,
        helpId,
      };
    }

    // 2. ICON text_or_id, id, x, y [, width, height [, style [, exStyle [, helpID]]]]
    if (type === "ICON") {
      let iconName = "";
      if (this.peek().type === "STRING") {
        iconName = this.advance().value;
      } else {
        iconName = this.advance().value;
      }
      this.consumeOptional(",");
      const idToken = this.peek();
      const id = this.parseId();
      this.consumeOptional(",");
      const x = this.parseExpression();
      this.consumeOptional(",");
      const y = this.parseExpression();

      let width = 20;
      let height = 20;
      let extraStyle = 0;
      let exStyle = 0;
      let helpId: number | undefined;

      if (this.consumeOptional(",")) {
        width = this.parseExpression();
        this.consumeOptional(",");
        height = this.parseExpression();

        if (this.consumeOptional(",")) {
          extraStyle = this.parseExpression();
          if (this.consumeOptional(",")) {
            exStyle = this.parseExpression();
            if (this.consumeOptional(",")) {
              helpId = this.parseExpression();
            }
          }
        }
      }

      return {
        id,
        idName: idToken.value,
        type: "ICON",
        className: "STATIC",
        text: iconName,
        x,
        y,
        width,
        height,
        style: RC_CONSTANTS.WS_CHILD | RC_CONSTANTS.WS_VISIBLE | RC_CONSTANTS.SS_ICON | extraStyle,
        exStyle,
        helpId,
      };
    }

    // 3. EDITTEXT, COMBOBOX, LISTBOX, SCROLLBAR (first param is id!)
    if (
      type === "EDITTEXT" ||
      type === "COMBOBOX" ||
      type === "LISTBOX" ||
      type === "SCROLLBAR"
    ) {
      const idToken = this.peek();
      const id = this.parseId();
      this.consumeOptional(",");
      const x = this.parseExpression();
      this.consumeOptional(",");
      const y = this.parseExpression();
      this.consumeOptional(",");
      const width = this.parseExpression();
      this.consumeOptional(",");
      const height = this.parseExpression();

      let extraStyle = 0;
      let exStyle = 0;
      let helpId: number | undefined;

      if (this.consumeOptional(",")) {
        extraStyle = this.parseExpression();
        if (this.consumeOptional(",")) {
          exStyle = this.parseExpression();
          if (this.consumeOptional(",")) {
            helpId = this.parseExpression();
          }
        }
      }

      let defaultStyle = RC_CONSTANTS.WS_CHILD | RC_CONSTANTS.WS_VISIBLE | RC_CONSTANTS.WS_TABSTOP;
      let className = "EDIT";

      if (type === "EDITTEXT") {
        className = "EDIT";
        defaultStyle |= RC_CONSTANTS.WS_BORDER | RC_CONSTANTS.ES_LEFT;
      } else if (type === "COMBOBOX") {
        className = "COMBOBOX";
        defaultStyle |= RC_CONSTANTS.CBS_DROPDOWN;
      } else if (type === "LISTBOX") {
        className = "LISTBOX";
        defaultStyle |= RC_CONSTANTS.WS_BORDER;
      } else if (type === "SCROLLBAR") {
        className = "SCROLLBAR";
        defaultStyle &= ~RC_CONSTANTS.WS_TABSTOP;
      }

      return {
        id,
        idName: idToken.value,
        type,
        className,
        text: "",
        x,
        y,
        width,
        height,
        style: defaultStyle | extraStyle,
        exStyle,
        helpId,
      };
    }

    // 4. CONTROL text, id, class, style, x, y, width, height [, exStyle [, helpID]]
    if (type === "CONTROL") {
      const text = this.expectString();
      this.consumeOptional(",");
      const idToken = this.peek();
      const id = this.parseId();
      this.consumeOptional(",");
      const classToken = this.advance();
      const className = classToken.value.replace(/^"|"$/g, "");
      this.consumeOptional(",");
      const style = this.parseExpression();
      this.consumeOptional(",");
      const x = this.parseExpression();
      this.consumeOptional(",");
      const y = this.parseExpression();
      this.consumeOptional(",");
      const width = this.parseExpression();
      this.consumeOptional(",");
      const height = this.parseExpression();

      let exStyle = 0;
      let helpId: number | undefined;

      if (this.consumeOptional(",")) {
        exStyle = this.parseExpression();
        if (this.consumeOptional(",")) {
          helpId = this.parseExpression();
        }
      }

      return {
        id,
        idName: idToken.value,
        type: "CONTROL",
        className,
        text,
        x,
        y,
        width,
        height,
        style,
        exStyle,
        helpId,
      };
    }

    // Unknown control statement - skip tokens on line
    return null;
  }

  private parseMenu(idToken: Token): MenuTemplate {
    this.skipOptionalKeyword("DISCARDABLE");
    this.expectBlockStart();

    const items = this.parseMenuItems();

    this.expectBlockEnd();

    const idVal = this.resolveId(idToken);

    return {
      id: idVal,
      name: idToken.value,
      items,
    };
  }

  private parseMenuItems(): MenuItemTemplate[] {
    const items: MenuItemTemplate[] = [];

    while (!this.isEof() && !this.isBlockEnd(this.peek())) {
      const tok = this.peek();
      const upper = tok.value.toUpperCase();

      if (upper === "POPUP") {
        this.advance();
        const popupText = this.expectString();
        let flags = RC_CONSTANTS.MF_POPUP;
        if (this.consumeOptional(",")) {
          flags |= this.parseExpression();
        }
        this.expectBlockStart();
        const subItems = this.parseMenuItems();
        this.expectBlockEnd();

        items.push({
          text: popupText,
          flags,
          subItems,
        });
        continue;
      }

      if (upper === "MENUITEM") {
        this.advance();
        const next = this.peek();
        const nextUpper = next.value.toUpperCase();

        if (nextUpper === "SEPARATOR") {
          this.advance();
          items.push({
            text: "",
            flags: RC_CONSTANTS.MF_SEPARATOR,
            isSeparator: true,
          });
          continue;
        }

        const itemText = this.expectString();
        let id = 0;
        let idName: string | undefined;
        let flags = RC_CONSTANTS.MF_STRING;

        if (this.consumeOptional(",")) {
          const idTok = this.peek();
          idName = idTok.value;
          id = this.parseId();

          if (this.consumeOptional(",")) {
            flags |= this.parseExpression();
          }
        }

        // Check if text has shortcut e.g. "Save\tCtrl+S"
        let shortcut: string | undefined;
        let cleanText = itemText;
        const tabIdx = itemText.indexOf("\t");
        if (tabIdx !== -1) {
          cleanText = itemText.substring(0, tabIdx);
          shortcut = itemText.substring(tabIdx + 1);
        }

        items.push({
          id,
          idName,
          text: cleanText,
          flags,
          shortcut,
          isSeparator: false,
        });
        continue;
      }

      // Skip unknown token
      this.advance();
    }

    return items;
  }

  private parseStringTable(stringTable: Record<number, string>): void {
    this.skipOptionalKeyword("DISCARDABLE");
    this.expectBlockStart();

    while (!this.isEof() && !this.isBlockEnd(this.peek())) {
      if (this.isExpressionStart(this.peek())) {
        const id = this.parseId();
        this.consumeOptional(",");
        const text = this.expectString();
        stringTable[id] = text;
      } else {
        this.advance();
      }
    }

    this.expectBlockEnd();
  }

  private parseAccelerators(idToken: Token): AcceleratorTable {
    this.expectBlockStart();
    const items: AcceleratorItem[] = [];

    while (!this.isEof() && !this.isBlockEnd(this.peek())) {
      const eventTok = this.advance();
      let event: string | number = eventTok.value;
      if (eventTok.numberValue !== undefined) {
        event = eventTok.numberValue;
      }
      this.consumeOptional(",");
      const idTok = this.peek();
      const id = this.parseId();

      let flags = 0;
      while (this.consumeOptional(",")) {
        const flagTok = this.advance();
        const f = flagTok.value.toUpperCase();
        if (f in RC_CONSTANTS) {
          flags |= RC_CONSTANTS[f];
        }
      }

      items.push({
        event,
        id,
        idName: idTok.value,
        flags,
      });
    }

    this.expectBlockEnd();

    return {
      id: this.resolveId(idToken),
      name: idToken.value,
      items,
    };
  }

  private parseExpression(): number {
    return this.parseBitwiseOr();
  }

  private parseBitwiseOr(): number {
    let left = this.parseBitwiseXor();
    while (this.matchPunctuator("|")) {
      const right = this.parseBitwiseXor();
      left = (left | right) | 0;
    }
    return left;
  }

  private parseBitwiseXor(): number {
    let left = this.parseBitwiseAnd();
    while (this.matchPunctuator("^")) {
      const right = this.parseBitwiseAnd();
      left = (left ^ right) | 0;
    }
    return left;
  }

  private parseBitwiseAnd(): number {
    let left = this.parseAdditive();
    while (this.matchPunctuator("&")) {
      const right = this.parseAdditive();
      left = (left & right) | 0;
    }
    return left;
  }

  private parseAdditive(): number {
    let left = this.parseUnary();
    while (this.peek().value === "+" || this.peek().value === "-") {
      const op = this.advance().value;
      const right = this.parseUnary();
      if (op === "+") {
        left = (left + right) | 0;
      } else {
        left = (left - right) | 0;
      }
    }
    return left;
  }

  private parseUnary(): number {
    if (this.matchPunctuator("~")) {
      return (~this.parseUnary()) | 0;
    }
    if (this.peek().value.toUpperCase() === "NOT") {
      this.advance();
      return (~this.parseUnary()) | 0;
    }
    if (this.matchPunctuator("+")) {
      return this.parseUnary();
    }
    if (this.matchPunctuator("-")) {
      return (-this.parseUnary()) | 0;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();

    if (tok.value === "(") {
      this.advance();
      const val = this.parseExpression();
      this.expectPunctuator(")");
      return val;
    }

    if (tok.type === "NUMBER") {
      this.advance();
      return tok.numberValue ?? parseInt(tok.value, 10);
    }

    if (tok.type === "IDENTIFIER") {
      this.advance();
      const name = tok.value;
      if (name in this.symbols) {
        return this.symbols[name];
      }
      return 0;
    }

    this.advance();
    return 0;
  }

  private parseId(): number {
    const tok = this.peek();
    if (tok.type === "NUMBER") {
      this.advance();
      return tok.numberValue ?? parseInt(tok.value, 10);
    }
    if (tok.type === "IDENTIFIER") {
      this.advance();
      if (tok.value in this.symbols) {
        return this.symbols[tok.value];
      }
      return 0;
    }
    return this.parseExpression();
  }

  private resolveId(idToken: Token): number | string {
    if (idToken.type === "NUMBER") {
      return idToken.numberValue ?? parseInt(idToken.value, 10);
    }
    if (idToken.value in this.symbols) {
      return this.symbols[idToken.value];
    }
    return idToken.value;
  }

  private parseIdOrString(): number | string {
    const tok = this.advance();
    if (tok.type === "STRING") {
      return tok.value;
    }
    if (tok.type === "NUMBER") {
      return tok.numberValue ?? parseInt(tok.value, 10);
    }
    if (tok.value in this.symbols) {
      return this.symbols[tok.value];
    }
    return tok.value;
  }

  private isExpressionStart(tok: Token): boolean {
    return (
      tok.type === "NUMBER" ||
      tok.type === "IDENTIFIER" ||
      tok.value === "(" ||
      tok.value === "~" ||
      tok.value === "-" ||
      tok.value === "+"
    );
  }

  private isBlockStart(tok: Token): boolean {
    const u = tok.value.toUpperCase();
    return u === "BEGIN" || tok.value === "{";
  }

  private isBlockEnd(tok: Token): boolean {
    const u = tok.value.toUpperCase();
    return u === "END" || tok.value === "}";
  }

  private expectBlockStart(): void {
    const tok = this.peek();
    if (this.isBlockStart(tok)) {
      this.advance();
    } else {
      throw new Error(
        `Expected BEGIN or '{', got '${tok.value}' at line ${tok.line}, col ${tok.column}`
      );
    }
  }

  private expectBlockEnd(): void {
    const tok = this.peek();
    if (this.isBlockEnd(tok)) {
      this.advance();
    } else {
      throw new Error(
        `Expected END or '}', got '${tok.value}' at line ${tok.line}, col ${tok.column}`
      );
    }
  }

  private expectString(): string {
    const tok = this.peek();
    if (tok.type === "STRING") {
      return this.advance().value;
    }
    // Also accept identifier as fallback text
    if (tok.type === "IDENTIFIER") {
      return this.advance().value;
    }
    return "";
  }

  private skipOptionalKeyword(kw: string): boolean {
    if (this.peek().value.toUpperCase() === kw.toUpperCase()) {
      this.advance();
      return true;
    }
    return false;
  }

  private consumeOptional(val: string): boolean {
    if (this.peek().value === val) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchPunctuator(val: string): boolean {
    if (this.peek().value === val) {
      this.advance();
      return true;
    }
    return false;
  }

  private expectPunctuator(val: string): void {
    const tok = this.peek();
    if (tok.value === val) {
      this.advance();
    }
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: "EOF", value: "", line: 0, column: 0 };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private isEof(): boolean {
    return this.pos >= this.tokens.length || this.tokens[this.pos].type === "EOF";
  }
}
