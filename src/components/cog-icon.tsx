/** A small cog, drawn in the current text colour, to mark the way to the composing room. */
export default function CogIcon({ className = "cog" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.9 4.9.1-1.4-.1-1.4 2.1-1.6-2-3.5-2.5 1a8.3 8.3 0 0 0-2.4-1.4L15.7 2h-4l-.4 2.7a8.3 8.3 0 0 0-2.4 1.4l-2.5-1-2 3.5 2.1 1.6-.1 1.4.1 1.4-2.1 1.6 2 3.5 2.5-1a8.3 8.3 0 0 0 2.4 1.4l.4 2.7h4l.4-2.7a8.3 8.3 0 0 0 2.4-1.4l2.5 1 2-3.5-2.1-1.6ZM12 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z"
      />
    </svg>
  );
}
