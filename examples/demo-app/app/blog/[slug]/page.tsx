import { Header } from '../../../components/Header';

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <article>
          <h1 className="mb-4 text-4xl font-bold">{slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</h1>
          <div className="prose prose-lg">
            <p>
              This is a blog post about {slug}. The content would normally be fetched from a CMS or
              markdown file.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
