import Link from 'next/link';

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
    >
      {children}
    </Link>
  );
}
