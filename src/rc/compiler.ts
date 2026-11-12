import { RcPreprocessor } from "./preprocessor.ts";
import { RcParser } from "./parser.ts";
import { RcEmitter } from "./emitter.ts";
import type { CompilerOptions, ResourceBundle } from "./types.ts";

export interface CompileResult {
  bundle: ResourceBundle;
  code: string;
  json: string;
  dts: string;
  includedFiles: string[];
}

export class RcCompiler {
  public static async compile(
    source: string,
    options: CompilerOptions = {}
  ): Promise<CompileResult> {
    const preprocessor = new RcPreprocessor(options);
    const preResult = await preprocessor.process(source, options.sourcePath);

    const parser = new RcParser(preResult.tokens, preResult.symbols);
    const bundle = parser.parse();

    const code = RcEmitter.emitTypeScript(bundle);
    const json = RcEmitter.emitJson(bundle);
    const dts = RcEmitter.emitDts(bundle);

    return {
      bundle,
      code,
      json,
      dts,
      includedFiles: preResult.includedFiles,
    };
  }

  public static compileSync(
    source: string,
    options: CompilerOptions = {}
  ): CompileResult {
    const preprocessor = new RcPreprocessor(options);
    const preResult = preprocessor.processSync(source, options.sourcePath);

    const parser = new RcParser(preResult.tokens, preResult.symbols);
    const bundle = parser.parse();

    const code = RcEmitter.emitTypeScript(bundle);
    const json = RcEmitter.emitJson(bundle);
    const dts = RcEmitter.emitDts(bundle);

    return {
      bundle,
      code,
      json,
      dts,
      includedFiles: preResult.includedFiles,
    };
  }
}

export const compileRc = (source: string, options?: CompilerOptions) =>
  RcCompiler.compile(source, options);

export const compileRcSync = (source: string, options?: CompilerOptions) =>
  RcCompiler.compileSync(source, options);
