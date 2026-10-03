import { Header } from '../../components/Header';

export default function AboutPage() {
  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-4 text-4xl font-bold">About</h1>
        <p className="text-lg text-gray-700">
          This demo app showcases how route-impact works. When you modify shared components like
          the Header or Button, route-impact will detect all affected routes automatically.
        </p>
      </main>
    </div>
  );
}
