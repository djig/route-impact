import { Header } from '../../components/Header';
import Link from 'next/link';

const posts = [
  { slug: 'intro', title: 'Introduction to Route Impact' },
  { slug: 'getting-started', title: 'Getting Started Guide' },
  { slug: 'advanced', title: 'Advanced Usage' },
];

export default function BlogPage() {
  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-4xl font-bold">Blog Posts</h1>
        <div className="space-y-4">
          {posts.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded border border-gray-200 p-6 transition hover:border-blue-500 hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold text-blue-600">{post.title}</h2>
              <p className="mt-2 text-gray-600">Read more →</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
