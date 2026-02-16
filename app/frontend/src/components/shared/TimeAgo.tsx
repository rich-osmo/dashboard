export function TimeAgo({ date }: { date: string }) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  let text: string;
  if (diffMin < 1) text = 'just now';
  else if (diffMin < 60) text = `${diffMin}m ago`;
  else if (diffHrs < 24) text = `${diffHrs}h ago`;
  else if (diffDays < 7) text = `${diffDays}d ago`;
  else text = then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return <span title={then.toLocaleString()}>{text}</span>;
}
