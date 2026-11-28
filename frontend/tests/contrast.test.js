import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function luminance(hex) {
  const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255);
  const linear=rgb.map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4);
  return 0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
}

test('declared text colors meet WCAG AA contrast against white', async()=>{
  const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
  const colors=[...css.matchAll(/color:\s*(#[\da-f]{6})/gi)].map(match=>match[1].toLowerCase());
  const violations=[...new Set(colors)].filter(color=>{
    if(color==='#ffffff') return false;
    return 1.05/(luminance(color)+0.05)<4.5;
  });
  assert.deepEqual(violations,[]);
});
