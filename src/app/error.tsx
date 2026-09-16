"use client";

export default function EditionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="paper">
      <section className="notice">
        <h1 className="notice__title">The presses have stopped</h1>
        <p>This edition could not be composed: {error.message}</p>
        <p>
          <button type="button" className="notice__button" onClick={reset}>
            Try again
          </button>
        </p>
      </section>
    </main>
  );
}
