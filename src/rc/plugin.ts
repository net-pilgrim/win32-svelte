import type { Plugin } from "vite";
import { compileRc } from "./compiler.ts";
import type { CompilerOptions } from "./types.ts";

export interface RcPluginOptions extends CompilerOptions {
  includeDirs?: string[];
}

export function win32RcPlugin(options: RcPluginOptions = {}): Plugin {
  return {
    name: "vite-plugin-win32-rc",
    enforce: "pre",

    async transform(code: string, id: string) {
      const cleanId = id.split("?")[0];
      if (!cleanId.endsWith(".rc")) {
        return null;
      }

      try {
        const result = await compileRc(code, {
          ...options,
          sourcePath: cleanId,
        });

        // Add included files to Vite watch graph for hot reload
        for (const inc of result.includedFiles) {
          this.addWatchFile(inc);
        }

        return {
          code: result.code,
          map: null,
        };
      } catch (err: any) {
        this.error(
          `[win32-rc-plugin] Error compiling ${cleanId}: ${err?.message || err}`
        );
      }
    },
  };
}

export default win32RcPlugin;
