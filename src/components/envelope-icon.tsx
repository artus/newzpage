/** An envelope, drawn in the current text colour: letters to the editor, which is to say the comments. */
export default function EnvelopeIcon({ className = "glyph" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="M3.5 6.5 12 13l8.5-6.5" />
      </g>
    </svg>
  );
}
