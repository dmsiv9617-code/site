import {variantFor} from './album-variants.js';
// A reference photo preserves the real engraving; it is never presented as
// a rendered photograph of a customer's new inscription or uploaded artwork.
export function albumPresentation(configuration, models) {
 const c=configuration;
 if(c.image||c.artworkRequired)return {source:null,reference:false};
 const exact=variantFor(c,models);
 if(exact)return {source:exact,reference:false};
 if(!Number.isInteger(c.motif)||!models[c.motif])return {source:null,reference:false};
 const source=variantFor({...c,model:c.motif,inscription:models[c.motif].inscription},models);
 return {source,reference:!!source};
}
export function safeImageSource(source) {
 return typeof source==='string'&&(/^(?:\/[^/]|https?:\/\/)/.test(source))?source:null;
}
export function cartCover(item,models) {
 if(safeImageSource(item.preview))return item.preview;
 const fields=Object.fromEntries((item.item_data||[]).map(x=>[x.key,x.value]));
 const model=models.findIndex(m=>m.name===(fields.model||item.model||item.name));
 const motif=models.findIndex(m=>m.name===(fields.motif||item.motif));
 if(model>=0){
  const color=['Натуральный','Ореховый','Чёрный','Медный'].indexOf(fields.wood||item.color);
  const c={model,motif:motif>=0?motif:model,color:color>=0?color:models[model].color,leather:/Коричнев/.test(fields.leather||item.leather||'')?'brown':'black',binding:/плетение/.test(fields.binding||item.binding||'')?'woven':'bolts',inscription:fields['Гравировка']||item.inscription||models[model].inscription};
  const view=albumPresentation(c,models);if(view.source)return view.source;
 }
 return safeImageSource(item.images?.[0]?.thumbnail||item.images?.[0]?.src)||null;
}
