import { useEffect, useState, type ReactNode } from "react";

/**
 * Keeps the display clock isolated from data subscriptions. Consumers should
 * never use its value as a dependency for a Firestore listener.
 */
export function StudentClock({ children }: { children: (now: Date) => ReactNode }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  return <>{children(now)}</>;
}
