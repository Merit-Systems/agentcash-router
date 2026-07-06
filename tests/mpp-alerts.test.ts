import { describe, it, expect } from 'vitest';
import { subscribePaymentFailedAlerts } from '../src/init/mpp.js';
import type { RouterPlugin } from '../src/plugin/index.js';
import type { AlertEvent } from '../src/types.js';

type FailedHandler = (payload: unknown) => void;

function makeFakeInstance() {
  const handlers: FailedHandler[] = [];
  return {
    instance: { onPaymentFailed: (h: FailedHandler) => handlers.push(h) },
    emit: (payload: unknown) => handlers.forEach((h) => h(payload)),
    handlers,
  };
}

function makeCapturingPlugin() {
  const alerts: AlertEvent[] = [];
  const plugin: RouterPlugin = {
    onAlert: (_ctx, alert) => {
      alerts.push(alert);
    },
  };
  return { plugin, alerts };
}

describe('mppx payment.failed → plugin.onAlert bridge', () => {
  it('forwards failures with method, error type, and payer metadata', () => {
    const { instance, emit } = makeFakeInstance();
    const { plugin, alerts } = makeCapturingPlugin();

    subscribePaymentFailedAlerts(plugin, [instance]);
    emit({
      error: {
        message: 'insufficient funds for gas',
        status: 402,
        type: 'https://mpp.dev/errors/verification-failed',
        hint: 'Fund the sponsor',
      },
      method: { name: 'tempo', intent: 'session' },
      credential: { source: 'did:pkh:eip155:4217:0xabc' },
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warn');
    expect(alerts[0].message).toBe('MPP payment failed: insufficient funds for gas');
    expect(alerts[0].meta).toMatchObject({
      method: 'tempo/session',
      status: 402,
      hint: 'Fund the sponsor',
      payer: 'did:pkh:eip155:4217:0xabc',
    });
  });

  it('maps status >= 500 to error level and defaults missing fields', () => {
    const { instance, emit } = makeFakeInstance();
    const { plugin, alerts } = makeCapturingPlugin();

    subscribePaymentFailedAlerts(plugin, [instance]);
    emit({ error: { message: 'boom', status: 500 } });
    emit({});

    expect(alerts[0].level).toBe('error');
    expect(alerts[1].level).toBe('warn');
    expect(alerts[1].message).toBe('MPP payment failed: unknown error');
  });

  it('does not subscribe without a plugin onAlert, and tolerates null instances', () => {
    const { instance, handlers } = makeFakeInstance();
    subscribePaymentFailedAlerts(undefined, [instance, null]);
    subscribePaymentFailedAlerts({}, [instance]);
    expect(handlers).toHaveLength(0);
  });

  it('never lets a throwing plugin break the handler', () => {
    const { instance, emit } = makeFakeInstance();
    const plugin: RouterPlugin = {
      onAlert: () => {
        throw new Error('plugin exploded');
      },
    };
    subscribePaymentFailedAlerts(plugin, [instance]);
    expect(() => emit({ error: { message: 'x' } })).not.toThrow();
  });
});
