/**
 * Vendor-specific extras for dmxapi's painting form. `size` and `customSize`
 * come from the registry's `imageGeneration` block (per-model); these two
 * rows are dmxapi's bespoke UI knobs that don't fit the canonical schema
 * (`autoCreate` is a vendor product flag, `seed` is a user-readable random
 * number for reproducible reruns).
 */
export function buildDmxapiConfigFields(): any[] {
  return [
    {
      type: 'input',
      key: 'seed',
      title: 'paintings.seed',
      tooltip: 'paintings.seed_desc_tip'
    },
    {
      type: 'switch',
      key: 'autoCreate',
      title: 'paintings.auto_create_paint',
      tooltip: 'paintings.auto_create_paint_tip'
    }
  ]
}
