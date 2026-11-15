// The public link is permanent; resolve a fresh playback URL for every viewing.
export async function resolveVideo(publicLink,{fetcher=globalThis.fetch,signal}={}) {
 const endpoint=new URL('https://cloud-api.yandex.net/v1/disk/public/resources/download');
 endpoint.searchParams.set('public_key',publicLink);
 const response=await fetcher(endpoint.href,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
 if(!response.ok)throw new Error('Не удалось загрузить серию. Попробуйте ещё раз.');
 const {href}=await response.json();
 let url;try{url=new URL(href);}catch{throw new Error('Не удалось получить адрес видео. Попробуйте ещё раз.');}
 if(url.protocol!=='https:')throw new Error('Не удалось получить адрес видео. Попробуйте ещё раз.');
 return url.href;
}
