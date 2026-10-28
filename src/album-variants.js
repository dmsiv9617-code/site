import variants from './album-variants.json' with { type: 'json' };

// Retain the original numeric colour IDs so saved customer projects stay valid.
export const coverColors = ['natural', 'walnut', 'black', 'copper'];
export const leatherName = leather => leather === 'brown' ? 'Коричневая' : 'Чёрная';
export function variantFor(configuration, models) {
  const c = configuration;
  // Generated photos have fixed engraving. Personalised artwork uses the editable sketch.
  if (c.image || c.motif !== c.model || c.inscription !== models[c.model]?.inscription) return null;
  return variants[`${c.model}:${coverColors[c.color]}:${c.leather || 'black'}:${c.binding}`] || null;
}
