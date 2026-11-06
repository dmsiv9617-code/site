// Only whitelisted personalisation metadata is persisted. Files and previews stay in memory.
const key='woodbase-draft-v1';
const steps=['binding','cover','extras'];
const extras=['box','metric','corners','markers','stickers'];
function configuration(c) {
 if(!c||!Number.isInteger(c.model)||c.model<0||c.model>5||!Number.isInteger(c.motif)||c.motif<0||c.motif>5||!Number.isInteger(c.color)||c.color<0||c.color>3||!['black','brown'].includes(c.leather)||!['bolts','woven'].includes(c.binding)||typeof c.inscription!=='string'||c.inscription.length>45||!Array.isArray(c.extras)||c.extras.length>extras.length||c.extras.some(id=>!extras.includes(id))||!['original','engrave'].includes(c.imageMode))return null;
 for(const [name,min,max]of [['imageScale',.5,1.5],['imageX',-20,20],['imageY',-20,20],['imageRotation',-45,45],['threshold',40,220]])if(!Number.isFinite(c[name])||c[name]<min||c[name]>max)return null;
 return {model:c.model,motif:c.motif,color:c.color,leather:c.leather,binding:c.binding,inscription:c.inscription,extras:[...new Set(c.extras)],imageScale:c.imageScale,imageX:c.imageX,imageY:c.imageY,imageRotation:c.imageRotation,threshold:c.threshold,imageMode:c.imageMode};
}
export function makeDraft(state,step) {
 const c=configuration(state);
 return c&&steps.includes(step)?{version:1,configuration:c,step,artworkRequired:!!(state.image||state.artworkRequired)}:null;
}
export function parseDraft(raw) {
 try {
  if(typeof raw!=='string'||raw.length>16000)return null;
  const d=JSON.parse(raw);
  if(d?.version!==1||typeof d.artworkRequired!=='boolean')return null;
  return makeDraft({...d.configuration,artworkRequired:d.artworkRequired},d.step);
 }catch{return null;}
}
export function createDraftStore(storage) {
 return {
  load() {
   try {
    const raw=storage.getItem(key);
    let draft=parseDraft(raw);
    const legacy=storage.getItem('woodbase-project');
    let persisted=true;
    // Old manual saves could contain a 600px customer preview: migrate metadata, then remove it.
    if(legacy){
     if(!draft&&legacy.length<=4100000){try{const d=JSON.parse(legacy);if(d?.version===1)draft=makeDraft({...d.configuration,leather:d.configuration?.leather??'black',artworkRequired:d.artworkRequired},steps.includes(d.step)?d.step:'binding');}catch{}}
     try{storage.removeItem('woodbase-project');}catch{persisted=false;}
    }
    if(draft){try{storage.setItem(key,JSON.stringify(draft));}catch{persisted=false;}return {status:'restored',draft,persisted};}
    if(raw!==null)storage.removeItem(key);
    return {status:raw!==null||legacy?'invalid':'empty',draft:null};
   }catch{return {status:'unavailable',draft:null};}
  },
  save(state,step) {
   try {const d=makeDraft(state,step);if(!d)return false;storage.setItem(key,JSON.stringify(d));return true;}catch{return false;}
  },
  clear() {
   try {storage.removeItem(key);storage.removeItem('woodbase-project');return true;}catch{return false;}
  }
 };
}
export function cartMetadata(item) {
 const saved={};
 for(const name of ['model','size','color','leather','inscription','motif','binding'])if(typeof item[name]==='string')saved[name]=item[name].slice(0,300);
 saved.price=Number.isFinite(item.price)?item.price:null;
 saved.extras=Array.isArray(item.extras)?item.extras.filter(x=>typeof x==='string').slice(0,10).map(x=>x.slice(0,120)):[];
 saved.image=null;
 saved.artworkRequired=!!(item.image||item.artworkRequired||item.configuration?.image||item.configuration?.artworkRequired);
 if(typeof item.preview==='string'&&/^\/configurator-assets\/[a-z0-9-]+\.webp(?:\?v=[a-f0-9]+)?$/.test(item.preview))saved.preview=item.preview;
 const c=configuration(item.configuration);
 if(c)saved.configuration={...c,image:null,artworkRequired:saved.artworkRequired,page:0};
 if(item.artwork){saved.artwork={};for(const [name,min,max]of [['scale',.5,1.5],['x',-20,20],['y',-20,20],['rotation',-45,45],['threshold',40,220]])if(Number.isFinite(item.artwork[name])&&item.artwork[name]>=min&&item.artwork[name]<=max)saved.artwork[name]=item.artwork[name];if(['engrave','original'].includes(item.artwork.mode))saved.artwork.mode=item.artwork.mode;}
 return saved;
}
