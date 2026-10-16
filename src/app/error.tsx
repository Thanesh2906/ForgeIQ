'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="legal">
      <h1>Something interrupted this request.</h1>
      <p>
        Please retry. If this is a new installation, check the required environment variables and
        database migration.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
