export const formatRelativeTime = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 1) {
    return "just now";
  } else if (diff < 60) {
    return `${Math.floor(diff / 1)}s ago`;
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
};
