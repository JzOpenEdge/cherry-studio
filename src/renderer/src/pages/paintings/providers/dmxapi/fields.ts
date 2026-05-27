/**
 * dmxapi's lone vendor extra — a user-readable seed input. Lives here only
 * because dmxapi's registry models don't declare `supports.seed: true`; once
 * they do, the registry-driven form will render this row and this file goes
 * away.
 */
export function buildDmxapiConfigFields(): any[] {
  return [
    {
      type: 'input',
      key: 'seed',
      title: 'paintings.seed',
      tooltip: 'paintings.seed_desc_tip'
    }
  ]
}
