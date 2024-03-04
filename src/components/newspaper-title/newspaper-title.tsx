type NewspaperTitleProps = {
  title: string;
}

export default function NewspaperTitle({ title }: NewspaperTitleProps) {
  return <h2>
    {title}
  </h2>
}