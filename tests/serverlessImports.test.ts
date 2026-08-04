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

    it('passes for every TypeScript source file in serverless-reachable directories', () => {
        expect(findExtensionlessRelativeImports(projectRoot)).toEqual([]);
    });
});