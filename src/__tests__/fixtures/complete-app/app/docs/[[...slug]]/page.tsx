export default function Docs({ params }: { params: { slug?: string[] } }) {
  return <div>{params.slug?.join('/') || 'index'}</div>;
}
