export function createFavorites(storage, allowedIds) {
 const allowed=new Set(allowedIds), key='woodbase-favorites-v1';
 let saved=[];
 try {const parsed=JSON.parse(storage?.getItem(key)||'[]'); if(Array.isArray(parsed)) saved=parsed;} catch {}
 const selected=new Set(saved.filter(id=>allowed.has(id)));
 return {
  list:()=>[...selected],
  has:id=>selected.has(id),
  toggle(id) {
   if(!allowed.has(id)) return;
   if(selected.has(id)) selected.delete(id); else selected.add(id);
   try {storage?.setItem(key,JSON.stringify([...selected]));} catch {}
  }
 };
}
