import React, { Suspense, useEffect, useState } from 'react';

/** Load a tool only after first use; preserve its draft state when it closes. */
export function DeferredMount({ active, children, fallback = null }: {
  active: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  // A newly opened lazy tool must not suspend its siblings or the workspace.
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
