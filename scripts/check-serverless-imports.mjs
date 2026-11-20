import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE_DIRS = ['api', 'services', 'utils', 'constants'];

function isRelativeSpecifier(specifier) {
    return specifier.startsWith('./') || specifier.startsWith('../');
}

function isExtensionless(specifier) {
    const withoutQuery = specifier.split(/[?#]/, 1)[0];
    return path.extname(withoutQuery) === '';
}

export function findExtensionlessImportsInSource(source, fileName = 'source.ts') {
    const scriptKind = fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
        ? ts.ScriptKind.TSX
        : fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs')
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
    const violations = [];

    const inspect = (node) => {
        let moduleSpecifier = null;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            moduleSpecifier = node.moduleSpecifier;
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            moduleSpecifier = node.arguments[0];
        } else if (ts.isImportTypeNode(node)) {
            moduleSpecifier = node.argument;
            if (ts.isLiteralTypeNode(moduleSpecifier)) moduleSpecifier = moduleSpecifier.literal;
        }

        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
            const specifier = moduleSpecifier.text;
            if (isRelativeSpecifier(specifier) && isExtensionless(specifier)) {
                const position = sourceFile.getLineAndCharacterOfPosition(moduleSpecifier.getStart(sourceFile));
                violations.push({ file: fileName, specifier, line: position.line + 1 });
            }
        }
        ts.forEachChild(node, inspect);
    };

    inspect(sourceFile);
    return violations;
}

function sourceFiles(root, sourceDirs) {
    const files = [];
    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(absolute);
            else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) files.push(absolute);
        }
    };
    for (const relativeDir of sourceDirs) {
        const absolute = path.join(root, relativeDir);
        if (fs.existsSync(absolute)) walk(absolute);
    }
    return files;
}

export function findExtensionlessRelativeImports(root = PROJECT_ROOT, sourceDirs = DEFAULT_SOURCE_DIRS) {
    return sourceFiles(root, sourceDirs).flatMap((file) => {
        const relativeFile = path.relative(root, file).replaceAll(path.sep, '/');
        return findExtensionlessImportsInSource(fs.readFileSync(file, 'utf8'), relativeFile);
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const violations = findExtensionlessRelativeImports();
    if (violations.length > 0) {
        console.error('Extensionless relative imports are not valid in Vercel native ESM functions:');
        for (const violation of violations) {
            console.error('  ' + violation.file + ':' + violation.line + ' imports ' + violation.specifier);
        }
        process.exitCode = 1;
    } else {
        console.log('Serverless relative-import check passed.');
    }
}
