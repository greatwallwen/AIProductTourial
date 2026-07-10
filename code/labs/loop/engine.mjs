import { createHash } from 'node:crypto';

const scenarios = {
  converge: [
    { score: 55, status: 'failed', failureFingerprint: 'missing-behavioral-sensor', action: 'replace file-exists check with a live verifier call', evidenceRefs: ['evidence://cycle-1/test-report'] },
    { score: 100, status: 'passed', failureFingerprint: null, action: 'rerun the independent checker', evidenceRefs: ['evidence://cycle-2/test-report', 'evidence://cycle-2/mutant-report'] }
  ],
  'repeated-failure': [
    { score: 40, status: 'failed', failureFingerprint: 'external-license-missing', action: 'retry source lookup', evidenceRefs: ['evidence://cycle-1/source-check'] },
    { score: 40, status: 'failed', failureFingerprint: 'external-license-missing', action: 'retry with the same unavailable source', evidenceRefs: ['evidence://cycle-2/source-check'] }
  ],
  regression: [
    { score: 80, status: 'failed', failureFingerprint: 'one-test-failed', action: 'patch the failing behavior', evidenceRefs: ['evidence://cycle-1/test-report'] },
    { score: 60, status: 'failed', failureFingerprint: 'previous-pass-regressed', action: 'patch a shared helper', evidenceRefs: ['evidence://cycle-2/test-report'] }
  ]
};

function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function runBoundedLoop(scenario = 'converge', maxTurns = 5) {
  const planned = scenarios[scenario];
  if (!planned) throw new Error(`unknown scenario: ${scenario}`);
  const cycles = [];
  let stopReason = 'max-turns';
  for (const item of planned.slice(0, maxTurns)) {
    const cycle = { cycle: cycles.length + 1, ...item, durationMs: 12 + cycles.length * 7 };
    cycles.push(cycle);
    if (item.status === 'passed') {
      stopReason = 'all-green';
      break;
    }
    const previous = cycles.at(-2);
    if (previous?.failureFingerprint && previous.failureFingerprint === item.failureFingerprint) {
      stopReason = 'repeated-failure';
      break;
    }
    if (previous && item.score < previous.score) {
      stopReason = 'regression';
      break;
    }
  }
  const last = cycles.at(-1);
  const escalationPacket = stopReason === 'all-green' ? null : {
    cycle: `${cycles.length}/${maxTurns}`,
    unresolved: [...new Set(cycles.map((item) => item.failureFingerprint).filter(Boolean))],
    attemptedActions: cycles.map((item) => item.action),
    owner: stopReason === 'repeated-failure' ? 'course-owner' : 'engineering-owner',
    reason: `continuing would repeat or worsen the ${last?.failureFingerprint ?? 'current'} failure`
  };
  const trace = {
    schema: 'loop-run-trace/v1',
    scenario,
    goal: 'produce a verified course artifact without weakening its checker',
    maxTurns,
    cycles,
    stopReason,
    failureFingerprint: last?.failureFingerprint ?? null,
    escalationPacket,
    ok: stopReason === 'all-green'
  };
  return { ...trace, traceHash: digest(trace) };
}
