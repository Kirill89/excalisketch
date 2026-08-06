// Minimal arg parser. `valueFlags` are `--flags` that consume the next token;
// everything else `--flag` is boolean, and bare tokens are positionals.
export function parse(args, valueFlags = []) {
  const opts = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (valueFlags.includes(key)) opts[key] = args[++i];
      else opts[key] = true;
    } else {
      pos.push(a);
    }
  }
  return { opts, pos };
}
