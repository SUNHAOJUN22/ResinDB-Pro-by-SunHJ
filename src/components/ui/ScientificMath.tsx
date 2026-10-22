import { useLayoutEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Local fonts and bounded trusted DOM rendering; invalid input remains plain text. */
export function ScientificMath({ tex, display = false }: { tex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    try {
      katex.render(tex, element, { displayMode: display, trust: false, strict: 'error', throwOnError: true, output: 'htmlAndMathml', maxExpand: 200, maxSize: 10 });
      element.dataset.mathStatus = 'ready';
    } catch {
      element.replaceChildren(document.createTextNode(tex));
      element.dataset.mathStatus = 'unavailable';
    }
  }, [tex, display]);
  return <span ref={ref} className="overflow-x-auto" aria-label={tex} />;
}
