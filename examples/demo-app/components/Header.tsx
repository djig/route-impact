import { Button } from './Button';

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
      <nav className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="text-2xl font-bold text-white">Demo App</div>
        <div className="flex gap-4">
          <a href="/" className="text-white hover:text-gray-200 px-3 py-2">Home</a>
          <a href="/blog" className="text-white hover:text-gray-200 px-3 py-2">Blog</a>
          <a href="/about" className="text-white hover:text-gray-200 px-3 py-2">About</a>
        </div>
      </nav>
    </header>
  );
}
