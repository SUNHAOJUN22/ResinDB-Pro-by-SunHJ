/** One layout read and at most one changed-size resize per animation frame. */
export function createChartResizeScheduler(
  container: Pick<HTMLElement, 'getBoundingClientRect'>,
  chart: { isDisposed(): boolean; resize(options: { animation: { duration: number } }): void },
) {
  let frame: number | null = null;
  let disposed = false;
  let forced = false;
  let width = -1;
  let height = -1;
  const schedule = (force = false) => {
    if (disposed) return;
    forced ||= force;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (disposed || chart.isDisposed()) return;
      const bounds = container.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0)) return;
      if (forced || bounds.width !== width || bounds.height !== height) {
        chart.resize({ animation: { duration: 0 } });
        width = bounds.width;
        height = bounds.height;
      }
      forced = false;
    });
  };
  return {
    schedule,
    dispose() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
