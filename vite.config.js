import {defineConfig,loadEnv} from 'vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {server: {proxy: env.VITE_COMMERCE_MODE==='woocommerce' ? {
  '/wp-json': {target:'http://localhost:8088',changeOrigin:true},
 } : {}}};
});
