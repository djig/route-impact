import { Header } from '../../../components/Header';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return (
    <div>
      <Header />
      <h1>Blog Post: {params.slug}</h1>
    </div>
  );
}
