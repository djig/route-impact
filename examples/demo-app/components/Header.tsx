import { Button } from './Button';

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="text-2xl font-bold text-blue-600">Demo App</div>
        <div className="flex gap-4">
          <Button href="/">Home</Button>
          <Button href="/blog">Blog</Button>
          <Button href="/about">About</Button>
        </div>
      </nav>
    </header>
  );
}
