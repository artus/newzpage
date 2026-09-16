"use client";

import { useEffect, useRef, useState } from "react";

interface PhotoProps {
  src: string;
  alt?: string;
  caption?: string;
}

/**
 * A remote photograph rendered as a newspaper halftone (see the .photo styles).
 * Images that fail to load remove themselves so the column reflows instead of showing a broken frame.
 */
export default function Photo({ src, alt, caption }: PhotoProps) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = ref.current;
    if (image && image.complete && image.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;

  return (
    <figure className="photo">
      <div className="photo__frame">
        {/* Arbitrary remote hosts, so the Next.js image optimiser is deliberately not used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={ref} src={src} alt={alt ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
