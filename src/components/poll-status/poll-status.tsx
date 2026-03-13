import { component$, type Signal } from "@builder.io/qwik";

interface PollStatusProps {
  lastUpdated: Signal<number>;
  secondsAgo: Signal<number>;
}

export const PollStatus = component$<PollStatusProps>((props) => {
  if (props.lastUpdated.value <= 0) {
    return null;
  }

  return (
    <div class="poll-status">
      <span class="last-updated">
        Updated{" "}
        {props.secondsAgo.value < 5
          ? "just now"
          : `${props.secondsAgo.value}s ago`}
      </span>
    </div>
  );
});
