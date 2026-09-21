import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Cutting } from "@/lib/edition/cutting";
import { truncateWords } from "@/lib/util/text";
import { longDate } from "@/lib/util/time";

export interface ImageFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal" | "italic";
}

export interface ImageAssets {
  fonts: ImageFont[];
}

/** A missing file is simply not offered; the renderer then falls back to the first face it has. */
const optional = (read: Promise<Buffer>): Promise<Buffer | undefined> => read.catch(() => undefined);

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

let assets: Promise<ImageAssets> | undefined;

/**
 * TrueType copies of the paper's faces, read once per process. The paths are spelled out so the build traces
 * exactly these files into the function; the renderer reads neither WOFF2 nor system fonts.
 */
export function loadImageAssets(): Promise<ImageAssets> {
  assets ??= (async () => {
    const root = process.cwd();
    const [gothic, playfair, caslon, caslonItalic] = await Promise.all([
      optional(readFile(join(root, "src/fonts/traditional-gothic.ttf"))),
      optional(readFile(join(root, "src/fonts/playfair-display-700.ttf"))),
      optional(readFile(join(root, "src/fonts/libre-caslon-text-400.ttf"))),
      optional(readFile(join(root, "src/fonts/libre-caslon-text-italic-400.ttf"))),
    ]);
    const faces: Array<[Buffer | undefined, Omit<ImageFont, "data">]> = [
      [gothic, { name: "Traditional Gothic", weight: 400, style: "normal" }],
      [playfair, { name: "Playfair Display", weight: 700, style: "normal" }],
      [caslon, { name: "Libre Caslon Text", weight: 400, style: "normal" }],
      [caslonItalic, { name: "Libre Caslon Text", weight: 400, style: "italic" }],
    ];
    return { fonts: faces.flatMap(([data, face]) => (data ? [{ ...face, data: toArrayBuffer(data) }] : [])) };
  })();
  return assets;
}

const INK = "#1c1a17";
const INK_SOFT = "#3d3934";
const PAPER = "#e8dfcc";

/** Long headlines are set smaller so three lines suffice. */
function headlineSize(title: string): number {
  if (title.length <= 48) return 62;
  if (title.length <= 84) return 52;
  return 44;
}

/** The cutting as a 1200 by 630 card: masthead, rule, headline, dateline and the first lines of the copy. */
export function cuttingImage(cutting: Cutting) {
  const published = cutting.published ? new Date(cutting.published) : undefined;
  const dateline = [cutting.byline ? `By ${cutting.byline}` : undefined, cutting.host, published && !Number.isNaN(published.getTime()) ? longDate(published) : undefined]
    .filter(Boolean)
    .join("   ·   ");
  const copy = cutting.missing ? cutting.excerpt : truncateWords(cutting.paragraphs.join(" "), 60);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "40px 64px 36px",
        backgroundColor: PAPER,
        backgroundImage: "linear-gradient(135deg, #efe8d8 0%, #e8dfcc 50%, #ddd2ba 100%)",
        color: INK,
        fontFamily: "Libre Caslon Text",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", fontFamily: "Traditional Gothic", fontSize: 66, lineHeight: 1, letterSpacing: 2 }}>Newzpage</div>
      <div style={{ display: "flex", marginTop: 14, height: 3, backgroundColor: INK }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 3,
          padding: "7px 0",
          borderBottom: `1px solid ${INK}`,
          fontSize: 21,
          fontStyle: "italic",
        }}
      >
        <span>A cutting</span>
        <span>{longDate(new Date())}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, marginTop: 26, overflow: "hidden" }}>
        <div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 700, fontSize: headlineSize(cutting.title), lineHeight: 1.08 }}>{cutting.title}</div>
        {dateline ? <div style={{ display: "flex", marginTop: 14, fontSize: 17, letterSpacing: 2, textTransform: "uppercase", color: INK_SOFT }}>{dateline}</div> : null}
        <div style={{ display: "flex", marginTop: 18, fontSize: 27, lineHeight: 1.38, fontStyle: cutting.missing ? "italic" : "normal" }}>{copy}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(28, 26, 23, 0.4)", fontSize: 19, fontStyle: "italic", color: INK_SOFT }}>
        Cut from newz.page
      </div>
    </div>
  );
}
