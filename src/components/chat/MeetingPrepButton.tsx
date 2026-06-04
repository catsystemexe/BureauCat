export function MeetingPrepButton({
  isPreparing,
  onPrepare
}: {
  isPreparing: boolean;
  onPrepare: () => void;
}) {
  return (
    <button
      className="meeting-prep-button secondary-action"
      disabled={isPreparing}
      onClick={onPrepare}
      type="button"
    >
      {isPreparing ? "Preparing…" : "Prepare meeting"}
    </button>
  );
}
