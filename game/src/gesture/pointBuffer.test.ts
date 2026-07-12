// GES-01 Unit Test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PointBuffer, PointBufferRegistry } from './pointBuffer.ts';

describe('GES-01 PointBuffer', () => {
  it('저장 순서와 값 보존', () => {
    const b = new PointBuffer();
    b.add(1, 2, 100);
    b.add(3, 4, 116);
    assert.equal(b.length, 2);
    assert.deepEqual(b.at(0), { x: 1, y: 2, t: 100 });
    assert.deepEqual(b.at(1), { x: 3, y: 4, t: 116 });
  });

  it('timestamp 역행 시 클램프 (결정론)', () => {
    const b = new PointBuffer();
    b.add(0, 0, 100);
    b.add(1, 1, 90); // 역행
    assert.equal(b.at(1)!.t, 100);
  });

  it('용량 초과 시 거부 + overflow 플래그, 크래시 없음', () => {
    const b = new PointBuffer({ maxPoints: 3 });
    assert.equal(b.add(0, 0, 1), true);
    assert.equal(b.add(1, 0, 2), true);
    assert.equal(b.add(2, 0, 3), true);
    assert.equal(b.add(3, 0, 4), false);
    assert.equal(b.length, 3);
    assert.equal(b.overflowed, true);
  });

  it('elapsedMs 계산', () => {
    const b = new PointBuffer();
    b.add(0, 0, 100);
    b.add(1, 1, 350);
    assert.equal(b.elapsedMs(), 250);
    b.clear();
    assert.equal(b.elapsedMs(), 0);
    assert.equal(b.overflowed, false);
  });

  it('toArray는 방어적 복사', () => {
    const b = new PointBuffer();
    b.add(1, 1, 1);
    const arr = b.toArray();
    arr[0]!.x = 999;
    assert.equal(b.at(0)!.x, 1);
  });
});

describe('GES-01 PointBufferRegistry (멀티터치)', () => {
  it('pointer_id별 독립 버퍼', () => {
    const r = new PointBufferRegistry();
    r.begin(1, 0, 0, 100);
    r.begin(2, 50, 50, 100);
    r.append(1, 1, 1, 116);
    r.append(2, 51, 51, 116);
    const p1 = r.end(1)!;
    const p2 = r.end(2)!;
    assert.equal(p1.length, 2);
    assert.equal(p2.length, 2);
    assert.equal(p1[1]!.x, 1);
    assert.equal(p2[1]!.x, 51);
  });

  it('미시작 pointer append/end는 안전 무시 (INPUT-002/003)', () => {
    const r = new PointBufferRegistry();
    assert.equal(r.append(99, 0, 0, 1), false);
    assert.equal(r.end(99), null);
  });

  it('end 후 버퍼 제거, cancelAll 동작', () => {
    const r = new PointBufferRegistry();
    r.begin(1, 0, 0, 1);
    r.end(1);
    assert.equal(r.has(1), false);
    r.begin(2, 0, 0, 1);
    r.begin(3, 0, 0, 1);
    r.cancelAll();
    assert.equal(r.activeCount, 0);
  });
});
