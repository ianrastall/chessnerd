import { createHash } from 'node:crypto';
import { readFile,writeFile,rename,mkdir } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
export async function recordArchiveSource(repository:string,revision:string,source:string,manifest:string,entries:number){
  const destination=resolve('public/data/archive-sources.json');
  let sources:Record<string,unknown>={};
  try {sources=JSON.parse(await readFile(destination,'utf8'));} catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const content=await readFile(resolve('public',manifest));
  sources[repository]={revision,source,manifest,entries,sha256:createHash('sha256').update(content).digest('hex')};
  await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination+'.tmp',JSON.stringify(sources,null,2)+'\n');await rename(destination+'.tmp',destination);
}
