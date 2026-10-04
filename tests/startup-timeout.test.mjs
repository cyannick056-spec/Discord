import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withDeadline} from '../src/startup-timeout.ts';
test('startup operations that never reply produce a useful retry error',async()=>{
 await assert.rejects(withDeadline(new Promise(()=>{}),10,'Discord no respondió'),/Discord no respondió/);
});
test('successful startup operations retain their result and clear the deadline',async()=>{
 assert.equal(await withDeadline(Promise.resolve('ready'),10000,'late'),'ready');
 await assert.rejects(withDeadline(Promise.reject(new Error('offline')),10000,'late'),/offline/);
});
