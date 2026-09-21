/** Alt text is only a caption when it reads like one; "palma3_1" or "image" is not. */
export function captionFor(alt: string | undefined, host: string | undefined): string | undefined {
  const words = alt ? alt.trim().split(/\s+/) : [];
  const readable = words.length >= 3 && alt!.length <= 160 && !/[_\/]|\.(jpe?g|png|webp|gif)$/i.test(alt!);
  if (readable) return alt!.trim();
  return host ? `Photograph: ${host}` : undefined;
}
