import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobSchema, scriptUpdateSchema, testimonialFieldsSchema, timelineUpdateSchema } from '../src/lib/security/schemas';

const scene = {
  sceneNumber: 1,
  title: 'Opening',
  narration: 'A bounded narration.',
  imagePrompt: 'A wide establishing shot.',
  approxDurationSeconds: 6,
  subtitleText: 'A bounded narration.',
};

test('job creation accepts supported modes and rejects unknown execution fields', () => {
  assert.equal(createJobSchema.safeParse({ topic: 'Ocean currents', contentStyle: 'documentary' }).success, true);
  assert.equal(createJobSchema.safeParse({ topic: 'Bedtime planets', contentStyle: 'kids', kidsFormat: 'bedtime' }).success, true);
  assert.equal(createJobSchema.safeParse({ topic: 'Unsafe', status: 'completed' }).success, false);
  assert.equal(createJobSchema.safeParse({ topic: 'Too long vertical', durationMinutes: 3, aspectRatio: '9:16' }).success, false);
});

test('script updates reject client-controlled generation state and excessive scenes', () => {
  assert.equal(scriptUpdateSchema.safeParse({ scenes: [scene], approve: true }).success, true);
  assert.equal(scriptUpdateSchema.safeParse({ scenes: [{ ...scene, imageStatus: 'completed' }] }).success, false);
  assert.equal(scriptUpdateSchema.safeParse({ scenes: Array.from({ length: 51 }, () => scene) }).success, false);
});

test('timeline updates only accept bounded editable fields', () => {
  assert.equal(timelineUpdateSchema.safeParse({ scenes: [scene], includeSubtitles: false }).success, true);
  assert.equal(timelineUpdateSchema.safeParse({ scenes: [{ ...scene, error: 'injected' }] }).success, false);
  assert.equal(timelineUpdateSchema.safeParse({ scenes: [{ ...scene, narration: 'x'.repeat(5001) }] }).success, false);
});

test('showcase uploads require a supported audience category', () => {
  const base = { title: 'Demo', description: '', quote: '', attribution: '', format: 'landscape', videoUrl: '' };
  assert.equal(testimonialFieldsSchema.safeParse({ ...base, category: 'documentary' }).success, true);
  assert.equal(testimonialFieldsSchema.safeParse({ ...base, category: 'kids' }).success, true);
  assert.equal(testimonialFieldsSchema.safeParse({ ...base, category: 'other' }).success, false);
});
