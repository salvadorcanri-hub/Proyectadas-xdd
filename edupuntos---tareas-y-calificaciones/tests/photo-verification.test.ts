import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFromOcr, validatePhotoReading, verificationStatus } from '../src/utils/photoVerification';
import type { Submission } from '../src/types';

test('OCR extracts marks conservatively without treating exercise answers as grades', () => {
  const read = (text: string, confidence = 95, cropped = false) => gradeFromOcr(text.split('\n').map(text => ({ text, confidence })), cropped);
  assert.equal(read('NOTA: AD').grade, 'AD');
  assert.equal(read('Calificación: B').grade, 'B');
  assert.equal(read('A').grade, 'A');
  assert.equal(read('Resuelve\nA\nB\n10 + 8').grade, null);
  assert.equal(read('NOTA: AD\nNOTA: B').grade, null);
  assert.equal(read('NOTA: A', 50).grade, null);
  assert.equal(read('10').grade, null);
  assert.equal(read('Respuesta\nA', 95, true).grade, 'A');
  assert.equal(read('').status, 'uncertain');
});

test('comparison waits for Excel, handles uncertain photos and rechecks the current official grade', () => {
  const submission: Submission = { id: 's', assignmentId: 'a', studentId: 'e', photoUrl: '/x', submittedAt: '', photoReading: { status: 'read', grade: 'AD', confidence: 95 } };
  assert.equal(verificationStatus(undefined, 'AD'), 'photo-needed');
  assert.equal(verificationStatus(submission, null), 'waiting');
  assert.equal(verificationStatus(submission, 'AD'), 'matched');
  assert.equal(verificationStatus(submission, 'B'), 'mismatch');
  assert.equal(verificationStatus({ ...submission, photoReading: null }, 'AD'), 'unreadable');
  assert.equal(verificationStatus({ ...submission, photoReading: null }, null), 'waiting');
});

test('photo metadata validation cannot substitute an arbitrary grade or an uncertain reading', () => {
  assert.equal(validatePhotoReading(undefined), null);
  assert.deepEqual(validatePhotoReading({ status: 'read', grade: 'A', confidence: 95, extra: 'ignored' }), { status: 'read', grade: 'A', confidence: 95 });
  for (const value of [{ status: 'read', grade: 'X', confidence: 100 }, { status: 'read', grade: 'A', confidence: 0 }, { status: 'uncertain', grade: 'A', confidence: 95 }, { status: 'read', grade: 'A', confidence: '99' }, {}]) {
    assert.throws(() => validatePhotoReading(value));
  }
});
