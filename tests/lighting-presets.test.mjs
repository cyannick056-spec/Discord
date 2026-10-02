import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLightingPreset,lightingPresets} from '../src/lighting-presets.ts';
import {validMood} from '../studio-validation.mjs';

test('night lighting presets preserve geometry, other views and personalized decorations', () => {
  const a='home-landscape-16x9',b='home-portrait-4x3';
  const fixture={items:[{id:crypto.randomUUID(),kind:'light',name:'Luz lavanda detrás de la TV',placements:{[a]:{hidden:false},[b]:{hidden:false}}},
    {id:crypto.randomUUID(),name:'Mi figura',placements:{[a]:{x:23,width:10}}}],presentations:{[a]:{tv:{zoom:.7,x:12},camera:{zoom:1.2},tvModel:'crt-wood',reflection:{enabled:false}},[b]:{ambient:91,mood:{preset:'neutral',intensity:0,tvGlow:100}}}};
  for(const preset of lightingPresets) {
    const d=structuredClone(fixture);assert.equal(applyLightingPreset(d,a,preset.id),true);
    assert.deepEqual(d.presentations[b],fixture.presentations[b]);assert.deepEqual(d.items[1],fixture.items[1]);
    assert.deepEqual(d.presentations[a].tv,fixture.presentations[a].tv);assert.deepEqual(d.presentations[a].camera,fixture.presentations[a].camera);
    assert.deepEqual(d.presentations[a].reflection,fixture.presentations[a].reflection);assert.equal(d.presentations[a].tvModel,'crt-wood');
    assert.equal(d.items[0].placements[a].hidden,true);assert.equal(d.items[0].placements[b].hidden,false);assert.equal(validMood(d.presentations[a].mood),true);
  }
  assert.equal(applyLightingPreset(fixture,a,'unknown'),false);
});
test('backlight and depth reject invalid persisted controls', () => {
  const mood={preset:'neutral',intensity:0,tvGlow:100,depth:42,backlight:{color:'#aabbcc',intensity:30,reach:115}};
  assert.equal(validMood(mood),true);
  for(const mutate of [m=>m.depth=101,m=>m.depth='30',m=>m.backlight.color='url(x)',m=>m.backlight.intensity=-1,m=>m.backlight.reach=500,m=>m.backlight=null]) {
    const m=structuredClone(mood);mutate(m);assert.equal(validMood(m),false);
  }
});
