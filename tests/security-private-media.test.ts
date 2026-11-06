import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageManager } from '../src/lib/storage';

test('local media URLs always use the authenticated job route', () => {
  const url = StorageManager.getLocalMediaUrl('doc_1793888488471_3b865d', 'images/scene_01.jpg');
  assert.equal(url, '/api/jobs/doc_1793888488471_3b865d/media/images/scene_01.jpg');
  assert.equal(url.startsWith('/generated/'), false);
  assert.throws(() => StorageManager.getLocalMediaUrl('doc_1793888488471_3b865d', '../secret'));
  assert.throws(() => StorageManager.getLocalMediaUrl('invalid id', 'documentary.mp4'));
});
