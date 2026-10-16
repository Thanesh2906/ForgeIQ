import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="legal">
      <h1>This page could not be found.</h1>
      <Link className="btn" href="/dashboard">
        Go to your workspace
      </Link>
    </main>
  );
}
