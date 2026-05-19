export type ParetoObjective = {
  key: string;
  minimize: boolean;
};

export type ParetoMessage = {
  type: 'COMPUTE_PARETO';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    objectives: ParetoObjective[];
  };
};

export type ParetoResponse = {
  type: 'PARETO_RESULT';
  payload: {
    paretoIds: string[];
  };
} | {
  type: 'ERROR';
  payload: { message: string };
};

// Dominance check for multi-dimensional pareto
function dominates(a: number[], b: number[], minimize: boolean[]): boolean {
  let strictlyBetter = false;
  for (let i = 0; i < a.length; i++) {
    if (minimize[i]) {
      if (a[i] > b[i]) return false;
      if (a[i] < b[i]) strictlyBetter = true;
    } else {
      if (a[i] < b[i]) return false;
      if (a[i] > b[i]) strictlyBetter = true;
    }
  }
  return strictlyBetter;
}

self.onmessage = (e: MessageEvent<ParetoMessage>) => {
  try {
    const { data, objectives } = e.data.payload;
    if (!objectives.length || !data.length) {
      self.postMessage({ type: 'PARETO_RESULT', payload: { paretoIds: data.map(d => d.id) } });
      return;
    }

    const minimizeMap = objectives.map(o => o.minimize);
    const keys = objectives.map(o => o.key);

    const points = data.map(d => ({
      id: d.id,
      values: keys.map(k => d.values[k] ?? (minimizeMap[keys.indexOf(k)] ? Infinity : -Infinity))
    }));

    const paretoIds: string[] = [];

    // Simple O(N^2) dominance check - for < 100,000 points this is often fast enough with early pruning
    // For strictly 2 objectives, we could sort and do O(N log N)
    if (objectives.length === 2) {
       // O(N log N) sweep line
       // Sort by primary objective (better first)
       const o1Min = minimizeMap[0];
       const o2Min = minimizeMap[1];
       
       points.sort((a, b) => {
          if (a.values[0] !== b.values[0]) {
             return o1Min ? a.values[0] - b.values[0] : b.values[0] - a.values[0];
          }
          return o2Min ? a.values[1] - b.values[1] : b.values[1] - a.values[1];
       });

       let bestO2SoFar = o2Min ? Infinity : -Infinity;
       
       for (const p of points) {
           const v2 = p.values[1];
           if (o2Min) {
               if (v2 < bestO2SoFar) {
                   paretoIds.push(p.id);
                   bestO2SoFar = v2;
               } else if (v2 === bestO2SoFar && p.values[0] === points[paretoIds.length > 0 ? points.findIndex(x => x.id === paretoIds[paretoIds.length-1]) : 0]?.values[0]) {
                   // identical points
                   paretoIds.push(p.id);
               }
           } else {
               if (v2 > bestO2SoFar) {
                   paretoIds.push(p.id);
                   bestO2SoFar = v2;
               } else if (v2 === bestO2SoFar && p.values[0] === points[paretoIds.length > 0 ? points.findIndex(x => x.id === paretoIds[paretoIds.length-1]) : 0]?.values[0]) {
                   paretoIds.push(p.id);
               }
           }
       }
    } else {
       // O(N^2)
       for (let i = 0; i < points.length; i++) {
         let dominated = false;
         for (let j = 0; j < points.length; j++) {
           if (i === j) continue;
           if (dominates(points[j].values, points[i].values, minimizeMap)) {
             dominated = true;
             break;
           }
         }
         if (!dominated) {
           paretoIds.push(points[i].id);
         }
       }
    }

    self.postMessage({ type: 'PARETO_RESULT', payload: { paretoIds } } as ParetoResponse);
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: { message: error instanceof Error ? error.message : 'Unknown error' } } as ParetoResponse);
  }
};
