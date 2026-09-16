type Task<T> = () => Promise<T>;

/**
 * Creates a function that runs at most `concurrency` tasks at the same time.
 * Used to keep the number of parallel page fetches polite.
 */
export function createLimiter(concurrency: number) {
  const queue: Array<() => void> = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (!run) return;
    active++;
    run();
  };

  return function limit<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
