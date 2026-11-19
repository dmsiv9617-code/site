export const paidExtras=[
 {id:'box',name:'Подарочная упаковка',price:350},
 {id:'metric',name:'Держатель для метрики',price:120},
 {id:'pages',name:'Дополнительный блок листов',price:295},
 {id:'extra-corners',name:'Дополнительные уголки — 5 листов',price:120},
];
export const includedExtraIds=['corners','markers','stickers'];
export const allExtraIds=[...includedExtraIds,...paidExtras.map(x=>x.id)];
export function extrasTotal(ids,prices=Object.fromEntries(paidExtras.map(x=>[x.id,x.price]))) {
 return [...new Set(ids)].reduce((sum,id)=>sum+(includedExtraIds.includes(id)?0:Number(prices[id]||0)),0);
}
export function supportsPaidExtras(product,ids) {
 return ids.filter(id=>!includedExtraIds.includes(id)).every(id=>Object.hasOwn(product?.options?.extras||{},id)&&Number.isFinite(product?.extraPrices?.[id])&&product.extraPrices[id]>=0);
}
