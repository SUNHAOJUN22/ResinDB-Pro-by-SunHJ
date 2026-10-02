import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Product } from '@/types/index';
import { KMeansBackendCalibrationPanel } from './KMeansBackendCalibrationPanel';
import { SCIENTIFIC_FONT_FAMILY } from './scientificFigurePolicy';
import { QuadTree, scatterFraction, type ScatterPoint } from '@/lib/math/scatterGeometry';
import { grahamScan, Point2D } from '@/lib/math/convexHull';

type Point = ScatterPoint<Product>;

interface CanvasScatterGraphProps {
  data: Product[];
  xKey: string;
  yKey: string;
  xLabel?: string;
  yLabel?: string;
  xValues: number[];
  yValues: number[];
  clusters?: Record<string, number>;
  paretoFrontIds?: Set<string>;
  enableConvexHull?: boolean;
}

export const CanvasScatterGraph: React.FC<CanvasScatterGraphProps> = ({
    data, xKey, yKey, xLabel = xKey, yLabel = yKey, xValues, yValues, clusters, paretoFrontIds, enableConvexHull
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const qTreeRef = useRef<QuadTree<Product> | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ point: Point, sx: number, sy: number } | null>(null);
    const [viewportEpoch, setViewportEpoch] = useState(0);

    useEffect(() => {
        let active = true;
        const invalidate = () => { if (active) setViewportEpoch((value) => value + 1); };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate);
        if (containerRef.current) observer?.observe(containerRef.current);
        window.addEventListener('resize', invalidate);
        document.fonts?.addEventListener('loadingdone', invalidate);
        return () => {
            active = false;
            observer?.disconnect();
            window.removeEventListener('resize', invalidate);
            document.fonts?.removeEventListener('loadingdone', invalidate);
        };
    }, []);

    // Filter pairs together: an invalid y must not affect the x domain or row identity.
    const validRows = useMemo(() => data.flatMap((product, index) => {
        const x = xValues[index];
        const y = yValues[index];
        return Number.isFinite(x) && Number.isFinite(y) ? [{ product, x, y }] : [];
    }), [data, xValues, yValues]);

    const { minX, maxX, minY, maxY } = useMemo(() => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const { x, y } of validRows) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        if (minX === Infinity) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
        return { minX, maxX, minY, maxY };
    }, [validRows]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        qTreeRef.current = null;
        setHoveredPoint(null);
        if (width <= 80 || height <= 80) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const padding = 40;
        const innerW = width - padding * 2;
        const innerH = height - padding * 2;
        const mapX = (val: number) => padding + scatterFraction(val, minX, maxX) * innerW;
        const mapY = (val: number) => height - padding - scatterFraction(val, minY, maxY) * innerH;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.font = `12px ${SCIENTIFIC_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, width / 2, height - 10);
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        const qt = new QuadTree<Product>({ x: 0, y: 0, w: width, h: height }, 10);
        const colors = [
          'rgba(99, 102, 241, 0.6)',
          'rgba(239, 68, 68, 0.6)',
          'rgba(34, 197, 94, 0.6)',
          'rgba(234, 179, 8, 0.6)',
          'rgba(168, 85, 247, 0.6)',
          'rgba(236, 72, 153, 0.6)',
          'rgba(14, 165, 233, 0.6)',
          'rgba(249, 115, 22, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(100, 116, 139, 0.6)',
        ];
        ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';

        if (enableConvexHull) {
            const pointsByManufacturer = new Map<string, Point2D[]>();
            for (const { product, x, y } of validRows) {
                const manufacturer = product.manufacturer || 'Unknown';
                const points = pointsByManufacturer.get(manufacturer) ?? [];
                points.push({ x: mapX(x), y: mapY(y), id: product.id });
                pointsByManufacturer.set(manufacturer, points);
            }
            [...pointsByManufacturer.values()].forEach((pts, idx) => {
                if (pts.length >= 3) {
                    const hullPts = grahamScan(pts);
                    if (hullPts.length > 0) {
                        ctx.beginPath();
                        const first = hullPts[0];
                        ctx.moveTo(first.x, first.y);
                        for (let j = 1; j < hullPts.length; j++) {
                            ctx.lineTo(hullPts[j].x, hullPts[j].y);
                        }
                        ctx.closePath();
                        const colorIdx = idx % colors.length;
                        ctx.fillStyle = colors[colorIdx].replace('0.6', '0.15');
                        ctx.fill();
                        ctx.strokeStyle = colors[colorIdx].replace('0.6', '0.8');
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
            });
        }

        for (const { product, x: rawX, y: rawY } of validRows) {
            const x = mapX(rawX);
            const y = mapY(rawY);
            const cluster = clusters?.[product.id];
            if (cluster !== undefined && Number.isSafeInteger(cluster) && cluster >= 0) {
                ctx.fillStyle = colors[cluster % colors.length];
            } else {
                ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
            }
            const isPareto = paretoFrontIds && paretoFrontIds.has(product.id);
            if (isPareto) {
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            qt.insert({ x, y, data: product });
        }

        if (paretoFrontIds && paretoFrontIds.size > 0) {
            const currentParetoPts: {x: number, y: number}[] = [];
            for (const { product, x, y } of validRows) {
                if (paretoFrontIds.has(product.id)) {
                    currentParetoPts.push({ x: mapX(x), y: mapY(y) });
                }
            }
            currentParetoPts.sort((a, b) => a.x - b.x);
            if (currentParetoPts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(currentParetoPts[0].x, currentParetoPts[0].y);
                for (let i = 1; i < currentParetoPts.length; i++) {
                    ctx.lineTo(currentParetoPts[i].x, currentParetoPts[i].y);
                }
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        qTreeRef.current = qt;
    }, [validRows, minX, maxX, minY, maxY, xLabel, yLabel, clusters, paretoFrontIds, enableConvexHull, viewportEpoch]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!qTreeRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const found = qTreeRef.current.query({ x: mouseX - 5, y: mouseY - 5, w: 10, h: 10 });
        if (found.length > 0) {
            let closest = found[0];
            let minDist = Infinity;
            for (const p of found) {
                const dist = (p.x - mouseX) ** 2 + (p.y - mouseY) ** 2;
                if (dist < minDist) { minDist = dist; closest = p; }
            }
            setHoveredPoint({ point: closest, sx: e.clientX, sy: e.clientY });
        } else {
            setHoveredPoint(null);
        }
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative" onMouseLeave={() => setHoveredPoint(null)}>
            <KMeansBackendCalibrationPanel />
            <canvas ref={canvasRef} role="img" aria-label={`${xLabel} / ${yLabel} (${validRows.length})`}
                onMouseMove={handleMouseMove} className="cursor-crosshair absolute inset-0" />
            {hoveredPoint && (
                <div className="fixed z-50 bg-slate-900 text-white text-xs p-2 rounded shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap"
                    style={{ left: hoveredPoint.sx, top: hoveredPoint.sy }}>
                    <div className="font-bold text-indigo-400 mb-1">{hoveredPoint.point.data.gradeName}</div>
                    <div>{xLabel}: {hoveredPoint.point.data.properties?.[xKey]?.value ?? '—'}</div>
                    <div>{yLabel}: {hoveredPoint.point.data.properties?.[yKey]?.value ?? '—'}</div>
                </div>
            )}
        </div>
    );
};
