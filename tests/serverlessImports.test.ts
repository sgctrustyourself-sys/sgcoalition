import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findExtensionlessImportsInSource, findExtensionlessRelativeImports } from '../scripts/check-serverless-imports.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('serverless native-ESM relative imports', () => {
    it('detects extensionless static, export, and dynamic relative imports', () => {
        const source = [
            "import x from './x';",
            "export { y } from '../y';",
            "const z = import('./z');",
            "import './side-effect';",
            "import typed from './typed.js';",
            "type Imported = import('./types').Thing;",
            "import external from 'package';",
        ].join(String.fromCharCode(10));

        expect(findExtensionlessImportsInSource(source, 'fixture.ts')).toEqual([
            { file: 'fixture.ts', specifier: './x', line: 1 },
            { file: 'fixture.ts', specifier: '../y', line: 2 },
            { file: 'fixture.ts', specifier: './z', line: 3 },
            { file: 'fixture.ts', specifier: './side-effect', line: 4 },
            { file: 'fixture.ts', specifier: './types', line: 6 },
        ]);
    });

    // A filesystem sweep of api/services/utils/constants (108 files, ~740KB)
    // plus the TypeScript compiler load that parses them — not a unit test.
    // Measured at ~1-2s warm, but 5-13s when the compiler load lands cold or
    // beside the suite's parallel workers, so vitest's 5s default made this
    // time out mid-suite and the assertion never ran. That budget is now
    // explicit: the release gate runs this suite on every Vercel build, where a
    // spurious timeout would refuse a good production deploy.
    it('passes for every TypeScript source file in serverless-reachable directories', () => {
        expect(findExtensionlessRelativeImports(projectRoot)).toEqual([]);
    }, 30_000);
});