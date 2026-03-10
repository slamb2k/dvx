export type OutputFormat = 'json' | 'table' | 'ndjson';

export function formatMutationResult(
  result: Record<string, unknown> | null,
  opts: { format: OutputFormat; id?: string }
): void {
  const payload = result ?? (opts.id ? { ok: true, id: opts.id } : { ok: true });
  if (opts.format === 'json') {
    console.log(JSON.stringify(payload));
  } else {
    // table: print key-value pairs
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      console.log('ok');
    } else {
      for (const [k, v] of entries) {
        console.log(`${k}: ${String(v)}`);
      }
    }
  }
}
