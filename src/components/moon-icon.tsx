const RAD = Math.PI / 180;

/**
 * The moon as it looks tonight: a disc with the lit part filled, its terminator an ellipse whose width follows
 * the phase. Waxing moons are lit on the right, as seen from the northern hemisphere.
 */
export default function MoonIcon({ angle, className = "glyph" }: { angle: number; className?: string }) {
  const phase = ((angle % 360) + 360) % 360;
  const cosine = Math.cos(phase * RAD);
  const right = phase < 180;
  const terminatorWidth = (10 * Math.abs(cosine)).toFixed(2);
  // A crescent's terminator bulges toward the lit edge, a gibbous moon's away from it.
  const lit = `M12 2A10 10 0 0 ${right ? 1 : 0} 12 22A${terminatorWidth} 10 0 0 ${right === cosine > 0 ? 0 : 1} 12 2Z`;
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d={lit} fill="currentColor" />
    </svg>
  );
}
