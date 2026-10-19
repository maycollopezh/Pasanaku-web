import {mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const files=['index.html','styles.css','app.js','engine.js','cloud.js','config.js','auto-sync.js','report.js'];
await mkdir(new URL('dist/',root),{recursive:true});
for(const name of files)await copyFile(new URL(name,root),new URL('dist/'+name,root));
console.log(`Pasanaku listo: ${files.length} archivos publicados en ${fileURLToPath(new URL('dist/',root))}`);
