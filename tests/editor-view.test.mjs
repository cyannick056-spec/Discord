import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorView} from '../src/editor-view.ts';
import {borderFromPixels} from '../src/avatar-border.ts';
test('inspection zoom anchors to the cursor and resets independently of saved scene data',()=>{
 const room={style:{}},output={},area={getBoundingClientRect:()=>({left:0,top:0,width:600,height:400})};
 const view=new EditorView(area,room,output);view.scale(2,450,300);
 assert.equal(view.zoom,2);assert.equal(view.x,-150);assert.equal(view.y,-100);assert.equal(output.textContent,'200%');
 view.pan(20,30);assert.equal(view.x,-130);assert.equal(view.y,-70);
 view.scale(20);assert.equal(view.zoom,8);view.reset();assert.equal(room.style.transform,'translate(0px,0px) scale(1)');
});
test('white avatars receive dark outlines and dark avatars receive white outlines',()=>{
 assert.equal(borderFromPixels(new Uint8ClampedArray([255,255,255,255,240,240,240,255])),'#111111');
 assert.equal(borderFromPixels(new Uint8ClampedArray([30,30,30,255,70,70,70,255])),'#ffffff');
 assert.equal(borderFromPixels(new Uint8ClampedArray([255,255,255,0,0,0,0,255])),'#ffffff');
});
