import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/reference-design.ts'],bundle:true,format:'esm',write:false});
const {referenceDesign}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('reference palette creates editable settings without importing foreign code or content',()=>{
  const design=referenceDesign({colors:['#fff','#623','#f7f3ee','url(https://evil.com)','</style>','#ff0011aa'],textExcerpt:'Foreign claims',fonts:['malicious']});
  assert.equal(design.accentColor,'#662233');
  assert.equal(design.backgrounds.page.color,'#ffffff');
  assert.equal(design.backgrounds.page.mode,'color');
  assert.equal(design.texts,undefined);
  assert.equal(design.logo,undefined);
  assert.deepEqual(referenceDesign({colors:['broken']}),{});
  assert.deepEqual(referenceDesign(null),{});
});
