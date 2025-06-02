export const TimeSince = ({ timestamp }: { timestamp: number }) => {
  const now = Math.floor(Date.now() / 1000);
  const difference = now - timestamp;

  const fullDate = new Date(timestamp * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

  const day = 24 * 60 * 60;
  const hour = 60 * 60;
  const minute = 60;

  if (difference > day) {
    const days = Math.floor(difference / day);
    return (
      <span title={fullDate}>
        {days} day{days > 1 ? "s" : ""} ago
      </span>
    );
  }

  if (difference > hour) {
    const hours = Math.floor(difference / hour);
    return (
      <span title={fullDate}>
        {hours} hour{hours > 1 ? "s" : ""} ago
      </span>
    );
  }

  if (difference > minute) {
    const minutes = Math.floor(difference / minute);
    return (
      <span title={fullDate}>
        {minutes} minute{minutes > 1 ? "s" : ""} ago
      </span>
    );
  }

  if (difference > 15) {
    const seconds = Math.floor(difference);
    return (
      <span title={fullDate}>
        {seconds} second{seconds > 1 ? "s" : ""} ago
      </span>
    );
  }

  if (difference > 0) {
    return <span title={fullDate}>Just now</span>;
  }

  // Calculate this area for "time until"

  if (difference < -day) {
    const days = Math.ceil(-difference / day);
    return (
      <span title={fullDate}>
        {days} day{days > 1 ? "s" : ""} until
      </span>
    );
  }

  if (difference < -hour) {
    const hours = Math.ceil(-difference / hour);
    return (
      <span title={fullDate}>
        {hours} hour{hours > 1 ? "s" : ""} until
      </span>
    );
  }

  if (difference < -minute) {
    const minutes = Math.ceil(-difference / minute);
    return (
      <span title={fullDate}>
        {minutes} minute{minutes > 1 ? "s" : ""} until
      </span>
    );
  }

  if (difference < -15) {
    const seconds = Math.ceil(-difference);
    return (
      <span title={fullDate}>
        {seconds} second{seconds > 1 ? "s" : ""} until
      </span>
    );
  }

  return <span title={fullDate}>In a few seconds</span>;
};
