interface SectionSkeletonProps {
  name: string;
  done?: number;
  total?: number;
}

export default function SectionSkeleton({ name, done = 0, total = 0 }: SectionSkeletonProps) {
  return (
    <section className="section section--pending" aria-busy="true">
      <header className="section__head">
        <h2>{name}</h2>
        <p className="section__meta">{total > 0 ? `Setting type, ${done} of ${total} dispatches` : "Waiting for the wire"}</p>
      </header>
      <div className="skeleton">
        <div className="skeleton__block skeleton__block--wide" />
        <div className="skeleton__block" />
        <div className="skeleton__block" />
        <div className="skeleton__block" />
      </div>
    </section>
  );
}
