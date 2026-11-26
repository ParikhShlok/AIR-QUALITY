import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAqi, estimateTransportImpact} from '../src/domain.js';

test('AQI category boundaries follow the US AQI bands', () => {
  assert.equal(classifyAqi(50).label, 'Good');
  assert.equal(classifyAqi(51).label, 'Moderate');
  assert.equal(classifyAqi(101).label, 'Unhealthy for sensitive groups');
  assert.equal(classifyAqi(151).label, 'Unhealthy');
  assert.equal(classifyAqi(201).label, 'Very unhealthy');
  assert.equal(classifyAqi(301).label, 'Hazardous');
});

test('missing or invalid AQI remains unavailable', () => {
  assert.equal(classifyAqi(null).label, 'Data unavailable');
  assert.equal(classifyAqi(Number.NaN).label, 'Data unavailable');
  assert.equal(classifyAqi(-1).label, 'Data unavailable');
  assert.equal(classifyAqi(501).label, 'Data unavailable');
});

test('impact estimate matches the documented round-trip formula', () => {
  assert.deepEqual(estimateTransportImpact(10, 'average gasoline car', 'metro'), {
    day: 4.4912,
    week: 22.456,
  });
});

test('impact estimate rejects unsupported modes and invalid distances', () => {
  assert.throws(() => estimateTransportImpact(10, 'average gasoline car', 'jet'), RangeError);
  assert.throws(() => estimateTransportImpact(501, 'average gasoline car', 'metro'), RangeError);
});
