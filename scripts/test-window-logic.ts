
import { getWindowNumber, getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from '../src/utils/windowCalculations';

function calculateStatus(points: number, target: number, previousStatus: string): string {
  const ratio = target > 0 ? points / target : 0;
  let status = 'alert';
  if (ratio >= 1) {
    status = 'on_track';
  } else if (ratio >= 0.75) {
    status = 'warning';
  }

  if (previousStatus === 'alert' && (status === 'on_track' || status === 'warning')) {
    status = 'recovery';
  }
  return status;
}

function testWindowCalculations() {
  console.log('Testing Window Calculations...');

  console.log('\n--- Default (4-week windows) ---');
  const cases4 = [
    { week: 1, expectedWindow: 1 },
    { week: 4, expectedWindow: 1 },
    { week: 5, expectedWindow: 2 },
  ];
  cases4.forEach(({ week, expectedWindow }) => {
    const win = getWindowNumber(week);
    console.log(`Week ${week} -> Window ${win} (Expected: ${expectedWindow}) - ${win === expectedWindow ? 'PASS' : 'FAIL'}`);
  });

  console.log('\n--- Parallel (2-week windows) ---');
  const cases2 = [
    { week: 1, expectedWindow: 1 },
    { week: 2, expectedWindow: 1 },
    { week: 3, expectedWindow: 2 },
    { week: 4, expectedWindow: 2 },
    { week: 5, expectedWindow: 3 },
  ];

  cases2.forEach(({ week, expectedWindow }) => {
    const win = getWindowNumber(week, PARALLEL_WINDOW_SIZE_WEEKS);
    console.log(`Week ${week} -> Window ${win} (Expected: ${expectedWindow}) - ${win === expectedWindow ? 'PASS' : 'FAIL'}`);
  });

  console.log('\nTesting Window Range (2-week)...');
  const range1 = getWindowRange(1, 6, PARALLEL_WINDOW_SIZE_WEEKS);
  console.log(`Week 1 (Total 6) -> Range: ${range1.startWeek}-${range1.endWeek}, weeks: ${range1.windowWeeks} - ${range1.windowWeeks === 2 ? 'PASS' : 'FAIL'}`);

  const range6 = getWindowRange(6, 6, PARALLEL_WINDOW_SIZE_WEEKS);
  console.log(`Week 6 (Total 6) -> Range: ${range6.startWeek}-${range6.endWeek}, weeks: ${range6.windowWeeks} - ${range6.windowWeeks === 2 ? 'PASS' : 'FAIL'}`);
}

function testStatusTransitions() {
  console.log('\nTesting Status Transitions...');
  const target = 1000;

  const transitions = [
    { points: 500, prev: 'alert', expected: 'alert' },
    { points: 800, prev: 'alert', expected: 'recovery' },
    { points: 1100, prev: 'alert', expected: 'recovery' },
    { points: 1100, prev: 'warning', expected: 'on_track' },
    { points: 800, prev: 'on_track', expected: 'warning' },
    { points: 500, prev: 'warning', expected: 'alert' },
  ];

  transitions.forEach(({ points, prev, expected }) => {
    const status = calculateStatus(points, target, prev);
    console.log(`Points: ${points}, Prev: ${prev} -> New: ${status} (Expected: ${expected}) - ${status === expected ? 'PASS' : 'FAIL'}`);
  });
}

testWindowCalculations();
testStatusTransitions();
