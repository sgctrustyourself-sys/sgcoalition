// scripts/cli.ts
//
// The CLI surface every script under `scripts/` prints and parses through: read a
// flag, read a flag's value, print a titled block, print a label/value row.
//
// These live here rather than in a feature module because they belong to no
// feature. They used to live in scripts/dropKit.ts, which meant a script that has
// nothing to do with drops — scripts/syncProducts.ts — imported the drop registry
// and a Supabase client just to parse its own argv.

export function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(`--${flag}`);
}

export function argValue(argv: string[], key: string): string | null {
  const i = argv.indexOf(`--${key}`);
  if (i === -1) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
}

export function logHeader(title: string): void {
  console.log(`\n${title}\n${'─'.repeat(title.length)}`);
}

export function logRow(label: string, value: string): void {
  console.log(`  ${label.padEnd(14)} ${value}`);
}
