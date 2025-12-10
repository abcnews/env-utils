type PrefersReducedMotionSubscriber = (value: boolean) => void;

export const prefersReducedMotionTarget: {
  _value: undefined | boolean;
  _subscribers: Set<PrefersReducedMotionSubscriber>;
  subscribe: (fn: PrefersReducedMotionSubscriber) => () => void;
  value: boolean;
} = {
  _value: undefined,
  _subscribers: new Set(),
  subscribe(fn: PrefersReducedMotionSubscriber) {
    this._subscribers.add(fn);
    fn(this.value);
    return () => this._subscribers.delete(fn);
  },
  // Default value is false to align with standard browser behaviour.
  get value(): boolean {
    if (typeof this._value === 'undefined') {
      // In page selection takes priority
      // This is set by the AppReducedMotionToggle component in https://github.com/abcnews/interactive-plugins
      const getInPageMotionPreference = () => {
        return (
          document.body.classList.contains('is-reduced-motion') ||
          (document.body.classList.contains('is-high-motion') ? false : null)
        );
      };

      const inPageMotionPreference = getInPageMotionPreference();

      // Fall back to the global preference if no in-page preference is set.
      const mediaMatcher = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      );

      // Initial preference.
      this._value = inPageMotionPreference ?? mediaMatcher.matches;

      // Handle updates from the in-page toggle
      const observer = new MutationObserver(([{ target }]) => {
        if (target instanceof HTMLElement) {
          this._value = target.classList.contains('is-reduced-motion');
        }
      });
      observer.observe(document.body, { attributeFilter: ['class'] });

      // Handle updates from the global preference
      mediaMatcher.addEventListener('change', () => {
        if (getInPageMotionPreference() === null) {
          this._value = mediaMatcher.matches;
        }
      });
    }

    return this._value;
  },
};

export const prefersReducedMotionHandler: ProxyHandler<
  typeof prefersReducedMotionTarget
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

export const prefersReducedMotion = new Proxy<
  typeof prefersReducedMotionTarget
>(prefersReducedMotionTarget, prefersReducedMotionHandler);
