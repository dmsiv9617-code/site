// Browser contract: server validates again and computes all prices.
export function configurationFromState(s, productId, fileId = null) {
 if(s.model!==5 || !Number.isSafeInteger(productId) || productId<1) throw new Error('Для тестового заказа выберите «Счастливые моменты»');
 if(s.image && !fileId) throw new Error('Private original-file storage must be implemented before enabling uploads');
 if(!['bolts','woven'].includes(s.binding)||!['black','brown'].includes(s.leather)||!Number.isInteger(s.color)||s.color<0||s.color>3||s.motif!==5) throw new Error('Unsupported option');
 if(typeof s.inscription!=='string'||[...s.inscription].length>45) throw new Error('Invalid inscription');
 if(!Array.isArray(s.extras)||s.extras.some(x=>!['corners','markers','stickers'].includes(x))) throw new Error('Стоимость дополнений пока не задана; снимите дополнительные опции');
 for(const [key,min,max] of [['imageScale',.5,1.5],['imageX',-20,20],['imageY',-20,20],['imageRotation',-45,45],['threshold',40,220]]) {
  if(!Number.isFinite(s[key])||s[key]<min||s[key]>max) throw new Error('Invalid artwork placement');
 }
 if(!['original','engrave'].includes(s.imageMode)) throw new Error('Invalid image mode');
 return {version:1,productId,options:{model:'moments',wood:['natural','walnut','black','copper'][s.color],binding:s.binding,leather:s.leather,motif:'moments',extras:[...new Set(s.extras)]},inscription:s.inscription,artwork:{fileId,x:s.imageX,y:s.imageY,scale:s.imageScale,rotation:s.imageRotation,mode:s.imageMode,threshold:s.threshold}};
}
// Cart-Token is an ephemeral bearer credential, never logged or included in exports.
// WooCommerce session cookies own checkout continuity. Use a same-origin reverse
// proxy; token alone does not establish the hosted checkout's cookie session.
export class StoreCart {
 constructor(origin, request=(...args)=>globalThis.fetch(...args)) { this.origin=new URL(origin).origin;this.request=request;this.token=null; }
 async call(path, body) {
  const headers={'Content-Type':'application/json'};
  if(this.token) headers['Cart-Token']=this.token;
  const response=await this.request(this.origin+'/wp-json/wc/store/v1/cart'+path,{method:body?'POST':'GET',credentials:'include',headers, ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const token=response.headers.get('Cart-Token');if(token)this.token=token;
  const data=await response.json();
  if(!response.ok)throw new Error(data.message||'Store API request failed');
  return data;
 }
 get(){return this.call('');}
 add(configuration,requestId){
  if(!this.token)throw new Error('Initialize cart first');
  if(typeof requestId!=='string'||!requestId.length)throw new Error('Request ID required');
  return this.call('/add-item',{id:configuration.productId,quantity:1,extensions:{woodbase:{configuration,requestId}}});
 }
 quantity(key,quantity){
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error('Invalid quantity');
  return this.call('/update-item',{key,quantity});
 }
 remove(key){return this.call('/remove-item',{key});}
}
