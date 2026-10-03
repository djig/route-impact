export default function Products({ params }: { params: { slug: string[] } }) {
  return <div>{params.slug.join('/')}</div>;
}
