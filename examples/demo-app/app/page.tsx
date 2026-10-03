import { Header } from '../components/Header';

export default function Home() {
  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Demo App</h1>
        <p className="text-lg text-gray-700">
          This is a demo Next.js application to showcase route-impact analysis.
        </p>
        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Features</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Shared components across multiple routes</li>
            <li>Dynamic routing with blog posts</li>
            <li>Real-world route structure</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
