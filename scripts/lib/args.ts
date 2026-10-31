/**
 * A script's command line, held to the flags it reads before it starts. `--help` names them and where the usage is, and
 * a flag it does not read stops it: a typo or a `--help` used to start a long run against the default address with
 * nothing it was asked for. A value after a flag, and a route given bare, are not flags, so they pass.
 */
export function holdArgs(script: string, args: readonly string[], known: readonly string[]): void {
  const takes = `${script} takes ${known.join(', ')}; the usage is at the top of scripts/${script}.ts`;
  if (args.includes('--help')) {
    console.log(`${takes}.`);
    process.exit(0);
  }
  const unknown = args.filter((a) => a.startsWith('--') && !known.includes(a));
  if (unknown.length) {
    console.error(`${script}: ${unknown.join(', ')} ${unknown.length === 1 ? 'is not an option' : 'are not options'}. ${takes}.`);
    process.exit(1);
  }
}
