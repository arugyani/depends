declare const activeWindow: typeof window;

export interface DebouncedFn<A extends readonly unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends readonly unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): DebouncedFn<A> {
  let timer: number | null = null;
  let pending: A | null = null;

  const debounced = ((...args: A) => {
    pending = args;
    if (timer !== null) activeWindow.clearTimeout(timer);
    timer = activeWindow.setTimeout(() => {
      timer = null;
      const a = pending;
      pending = null;
      if (a) fn(...a);
    }, ms);
  }) as DebouncedFn<A>;

  debounced.cancel = () => {
    if (timer !== null) {
      activeWindow.clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  debounced.flush = () => {
    if (timer !== null && pending) {
      activeWindow.clearTimeout(timer);
      timer = null;
      const a = pending;
      pending = null;
      fn(...a);
    }
  };

  return debounced;
}
