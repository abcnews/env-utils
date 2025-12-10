type PrefersColorSchemeValue = 'light' | 'dark';
type PrefersColorSchemeSubscriber = (value: PrefersColorSchemeValue) => void;

export const prefersColorSchemeTarget: {
  _value: undefined | PrefersColorSchemeValue;
  _subscribers: Set<PrefersColorSchemeSubscriber>;
  subscribe: (fn: PrefersColorSchemeSubscriber) => () => void;
  value: PrefersColorSchemeValue;
} = {
  _value: undefined,
  _subscribers: new Set(),
  subscribe(fn: PrefersColorSchemeSubscriber) {
    this._subscribers.add(fn);
    fn(this.value);
    return () => this._subscribers.delete(fn);
  },
  get value(): PrefersColorSchemeValue {
    if (typeof this._value === 'undefined') {
      const mediaMatcher = window.matchMedia('(prefers-color-scheme: dark)');

      this._value = mediaMatcher.matches ? 'dark' : 'light'; // Light is the default to match browser behaviour

      mediaMatcher.addEventListener('change', () => {
        this._value = mediaMatcher.matches ? 'dark' : 'light'; // Light is the default to match browser behaviour
      });
    }

    return this._value;
  },
};

export const prefersColorSchemeHandler: ProxyHandler<
  typeof prefersColorSchemeTarget
> = {
  set(target, prop, value) {
    if (prop === '_value') {
      target._subscribers.forEach(subscriber => {
        subscriber(value);
      });
    }
    return Reflect.set(target, prop, value);
  },
};

export const prefersColorScheme = new Proxy<typeof prefersColorSchemeTarget>(
  prefersColorSchemeTarget,
  prefersColorSchemeHandler
);
