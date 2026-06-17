import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ScanSearch, RotateCcw, Image as ImageIcon, FileJson, Search, X, Info, FlaskConical, Database, Globe, Settings2, Maximize, Minimize, ZoomIn, ZoomOut, MousePointerClick, Network, GitBranch, Layers } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: 'chemical' | 'resin';
  radius: number;
  desc?: string;
  formula?: string;
  cas?: string;
}

const nodeZhMap: Record<string, string> = {
  "Ethylene": "乙烯",
  "Propylene": "丙烯",
  "Styrene": "苯乙烯",
  "Butadiene": "丁二烯",
  "Acrylonitrile": "丙烯腈",
  "Vinyl Chloride": "氯乙烯",
  "Bisphenol A": "双酚A",
  "Caprolactam": "己内酰胺",
  "Terephthalic Acid": "对苯二甲酸",
  "Ethylene Glycol": "乙二醇",
  "Phosgene": "光气"
};

const nodeZhDescMap: Record<string, string> = {
  "Ethylene": "石化工业的关键基础原料，用于生产聚乙烯、环氧乙烷等。",
  "Propylene": "主要单体，用于生产聚丙烯及多种环氧丙烷衍生物。",
  "Styrene": "芳香烃类，主要用于生产聚苯乙烯以及ABS、SAN等共聚物。",
  "Butadiene": "重要的二烯烃，广泛作为生产合成橡胶和聚合物树脂的单体。",
  "Acrylonitrile": "一种反应性单体，用于生产聚丙烯腈、ABS塑料和特种合成橡胶。",
  "Vinyl Chloride": "合成聚氯乙烯 (PVC) 的主要前体原料，PVC是一种用途广泛的塑料。",
  "Bisphenol A": "合成聚碳酸酯和环氧树脂的关键起始原料。",
  "Caprolactam": "主要作为生产尼龙6 (PA6) 的单体的有机化合物。",
  "Terephthalic Acid": "生产PET和PBT等聚酯树脂的主要前体原料。",
  "Ethylene Glycol": "与对苯二甲酸一起用于生产PET，也是一种常见的防冻剂。",
  "Phosgene": "一种高反应性分子，用作聚碳酸酯和聚氨酯的工业基础原料。",
  "PE": "聚乙烯：世界上产量最大的塑料，广泛应用于包装、管道等领域。",
  "HDPE": "高密度聚乙烯：以高强度密度比著称，常用于硬质容器和管道。",
  "LDPE": "低密度聚乙烯：柔韧且具韧性，通常用于塑料袋和普通薄膜。",
  "LLDPE": "线性低密度聚乙烯：比LDPE具有更高的韧性和抗穿刺性。",
  "EVA": "乙烯-醋酸乙烯酯共聚物：一种弹性体聚合物，可生产柔软且具灵活性的类似橡胶的材料。",
  "PP": "聚丙烯：坚固且对许多化学溶剂、碱和酸具有异常的耐受性。",
  "PS": "聚苯乙烯：由苯乙烯制成的坚硬塑料，常用于保护性包装和食品容器。",
  "EPS": "发泡聚苯乙烯：一种轻质的硬质闭孔塑料，主要用于隔热和包装。",
  "ABS": "丙烯腈-丁二烯-苯乙烯共聚物：一种不透明的热塑性聚合物，提供卓越的抗冲击性和韧性。",
  "SAN": "苯乙烯-丙烯腈共聚物：一种结合了苯乙烯的高透明度和丙烯腈的高韧性的共聚塑料。",
  "PVC": "聚氯乙烯：世界上产量第三的合成塑料聚合物，被大量应用于建筑行业。",
  "PC": "聚碳酸酯：一种坚固、强韧的材料，具有高度的抗冲击性，某些级别透明度极高。",
  "PA6": "聚酰胺6 (尼龙6)：提供出色的机械韧性和耐化学性，用于纤维和工程塑料。",
  "PET": "聚对苯二甲酸乙二醇酯：常用于服装纤维、食品包装和液体容器。",
  "PBT": "聚对苯二甲酸丁二醇酯：一种热塑性工程聚合物，广泛用作电绝缘体。"
};

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

const rawData = {
  nodes: [
    { id: "Ethylene", group: "chemical", radius: 25, formula: "C2H4", cas: "74-85-1", desc: "A key building block in the petrochemical industry, used to make polyethylene, ethylene oxide, and more." },
    { id: "Propylene", group: "chemical", radius: 25, formula: "C3H6", cas: "115-07-1", desc: "A major monomer used in the production of polypropylene and various propylene oxide derivatives." },
    { id: "Styrene", group: "chemical", radius: 25, formula: "C8H8", cas: "100-42-5", desc: "An aromatic hydrocarbon used mainly to produce polystyrene and various copolymers like ABS and SAN." },
    { id: "Butadiene", group: "chemical", radius: 25, formula: "C4H6", cas: "106-99-0", desc: "An important diene widely used as a monomer in the production of synthetic rubbers and polymer resins." },
    { id: "Acrylonitrile", group: "chemical", radius: 25, formula: "C3H3N", cas: "107-13-1", desc: "A reactive monomer used in the production of polyacrylonitrile, ABS plastics, and specialized synthetic rubbers." },
    { id: "Vinyl Chloride", group: "chemical", radius: 25, formula: "C2H3Cl", cas: "75-01-4", desc: "The primary precursor to polyvinyl chloride (PVC), a versatile and widely used plastic." },
    { id: "Bisphenol A", group: "chemical", radius: 25, formula: "C15H16O2", cas: "80-05-7", desc: "A key starting material for the synthesis of polycarbonates and epoxy resins." },
    { id: "Caprolactam", group: "chemical", radius: 25, formula: "C6H11NO", cas: "105-60-2", desc: "An organic compound used primarily as a monomer in the production of nylon 6 (PA6)." },
    { id: "Terephthalic Acid", group: "chemical", radius: 25, formula: "C8H6O4", cas: "100-21-0", desc: "A major precursor used in the manufacture of polyester resins like PET and PBT." },
    { id: "Ethylene Glycol", group: "chemical", radius: 25, formula: "C2H6O2", cas: "107-21-1", desc: "Used alongside terephthalic acid to produce PET, also a common antifreeze agent." },
    { id: "Phosgene", group: "chemical", radius: 25, formula: "CCl2O", cas: "75-44-5", desc: "A highly reactive molecule used as an industrial building block for polycarbonates and polyurethanes." },
    { id: "PE", group: "resin", radius: 18, desc: "Polyethylene: the most widely produced plastic in the world, utilized in packaging, pipes, and more." },
    { id: "HDPE", group: "resin", radius: 15, desc: "High-density Polyethylene: known for its high strength-to-density ratio, used in hard containers and pipes." },
    { id: "LDPE", group: "resin", radius: 15, desc: "Low-density Polyethylene: flexible and tough, typically used for plastic bags and general films." },
    { id: "LLDPE", group: "resin", radius: 15, desc: "Linear Low-density Polyethylene: offers greater toughness and puncture resistance than LDPE." },
    { id: "EVA", group: "resin", radius: 18, desc: "Ethylene-vinyl acetate: an elastomeric polymer that produces materials which are 'rubber-like' in softness and flexibility." },
    { id: "PP", group: "resin", radius: 18, desc: "Polypropylene: rugged and unusually resistant to many chemical solvents, bases and acids." },
    { id: "PS", group: "resin", radius: 18, desc: "Polystyrene: a strong plastic created from styrene, often used in protective packaging and food containers." },
    { id: "EPS", group: "resin", radius: 15, desc: "Expanded Polystyrene: a lightweight rigid cellular plastic used primarily in insulation and packaging." },
    { id: "ABS", group: "resin", radius: 22, desc: "Acrylonitrile Butadiene Styrene: an opaque thermoplastic polymer offering incredible impact resistance and toughness." },
    { id: "SAN", group: "resin", radius: 18, desc: "Styrene Acrylonitrile: a copolymer plastic combining the clarity of polystyrene with the toughness of acrylonitrile." },
    { id: "PVC", group: "resin", radius: 18, desc: "Polyvinyl Chloride: the world's third-most widely produced synthetic plastic polymer, used heavily in construction." },
    { id: "PC", group: "resin", radius: 18, desc: "Polycarbonate: a strong, tough material, highly impact resistant, and some grades are optically transparent." },
    { id: "PA6", group: "resin", radius: 18, desc: "Polyamide 6 (Nylon 6): offers excellent mechanical toughness and chemical resistance, used in fibers and engineering plastics." },
    { id: "PET", group: "resin", radius: 18, desc: "Polyethylene Terephthalate: commonly used for fibers for clothing, food packaging, and liquid containers." },
    { id: "PBT", group: "resin", radius: 18, desc: "Polybutylene Terephthalate: a thermoplastic engineering polymer used heavily as an electrical insulator." },
  ] as Node[],
  links: [
    { source: "Ethylene", target: "PE", value: 5 },
    { source: "PE", target: "HDPE", value: 2 },
    { source: "PE", target: "LDPE", value: 2 },
    { source: "PE", target: "LLDPE", value: 2 },
    { source: "Ethylene", target: "EVA", value: 3 },
    { source: "Propylene", target: "PP", value: 5 },
    { source: "Styrene", target: "PS", value: 4 },
    { source: "PS", target: "EPS", value: 2 },
    { source: "Styrene", target: "ABS", value: 2 },
    { source: "Acrylonitrile", target: "ABS", value: 2 },
    { source: "Butadiene", target: "ABS", value: 2 },
    { source: "Styrene", target: "SAN", value: 2 },
    { source: "Acrylonitrile", target: "SAN", value: 2 },
    { source: "Vinyl Chloride", target: "PVC", value: 5 },
    { source: "Bisphenol A", target: "PC", value: 3 },
    { source: "Phosgene", target: "PC", value: 2 },
    { source: "Caprolactam", target: "PA6", value: 4 },
    { source: "Terephthalic Acid", target: "PET", value: 3 },
    { source: "Ethylene Glycol", target: "PET", value: 3 },
    { source: "Terephthalic Acid", target: "PBT", value: 3 },
  ] as Link[]
};

const DependencyMapD3: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const { t, language } = useLanguage();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const nodeRef = useRef<any>(null);
  const linkRef = useRef<any>(null);
  const simulationRef = useRef<any>(null);
  const gRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [params, setParams] = useState({
    repulsion: 400,
    linkDistance: 100,
    showLabels: true,
    showParticles: true,
    traceMode: true,
    traceDirection: 'both', // 'both' | 'upstream' | 'downstream'
    layout: 'force',
    linkStyle: 'straight'
  });

  const zoomRef = useRef<any>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    hoveredNodeIdRef.current = hoveredNodeId;
  }, [hoveredNodeId]);

  const getDisplayName = useCallback((id: string) => language === 'zh' ? (nodeZhMap[id] || id) : id, [language]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "resin_dependency_map.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportPNG = () => {
    const svgNode = svgRef.current;
    if (!svgNode) return;

    // We clone the SVG to avoid mutating the DOM directly
    const svgClone = svgNode.cloneNode(true) as SVGSVGElement;
    
    // Inject the theme styles temporarily for rendering
    const isDark = document.documentElement.classList.contains('dark');
    const style = document.createElement('style');
    style.innerHTML = `
      text { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; font-size: 10px; font-weight: bold; }
      .fill-slate-700 { fill: #334155; }
      .fill-slate-200 { fill: #e2e8f0; }
    `;
    svgClone.insertBefore(style, svgClone.firstChild);

    // Apply absolute width/height for canvas scaling instead of 100%
    svgClone.setAttribute("width", dimensions.width.toString());
    svgClone.setAttribute("height", dimensions.height.toString());

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData.includes('xmlns=') ? svgData : svgData.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')], {type: 'image/svg+xml;charset=utf-8'});
    const DOMURL = (window.URL || window.webkitURL || window) as any;
    const url = DOMURL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 3; // 3x high resolution
      canvas.width = dimensions.width * scale;
      canvas.height = dimensions.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = isDark ? '#020617' : '#f8fafc'; // slate-950 or slate-50
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        const pngData = canvas.toDataURL('image/png');
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", pngData);
        downloadAnchorNode.setAttribute("download", "resin_dependency_map.png");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      }
      DOMURL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    const observeTarget = wrapperRef.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length > 0) {
        const newWidth = entries[0].contentRect.width;
        const newHeight = entries[0].contentRect.height;
        setDimensions(prev => {
          if (prev.width === newWidth && prev.height === newHeight) return prev;
          return { width: newWidth, height: newHeight };
        });
      }
    });
    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;

    // Create a deep copy of data because d3 simulation mutates it
    const data = {
      nodes: rawData.nodes.map(d => ({ ...d })),
      links: rawData.links.map(d => ({ ...d }))
    };

    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);
    // Initial centering
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1));

    const defs = svg.append("defs");
    
    // Flowing gradient
    const gradient = defs.append("linearGradient")
      .attr("id", "flowingGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.8);
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "#10b981").attr("stop-opacity", 0.8);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.8);

    // Add glow effect filter
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "8")
      .attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(params.linkDistance))
      .force("charge", d3.forceManyBody().strength(-params.repulsion))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 15).iterations(2));
      
    if (params.layout === 'force') {
      simulation
        .force("x", d3.forceX().strength(0.05))
        .force("y", d3.forceY().strength(0.05));
    } else if (params.layout === 'layered') {
      simulation
        .force("x", d3.forceX(width / 2).strength(0.1))
        .force("y", d3.forceY((d: any) => d.group === 'chemical' ? height * 0.25 : height * 0.75).strength(0.3));
    }

    simulationRef.current = simulation;

    const link = g.append("g")
      .selectAll("path")
      .data(data.links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d: any) => Math.sqrt(d.value) * 1.5);

    linkRef.current = link;

    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    nodeRef.current = node;

    node.append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.group === 'chemical' ? '#3b82f6' : '#10b981')
      .attr("stroke", d => d.group === 'chemical' ? '#2563eb' : '#059669')
      .attr("stroke-width", 2)
      .attr("class", "transition-all duration-300 cursor-pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNodeId(d.id === selectedNodeIdRef.current ? null : d.id);
        setContextMenu(null);
      })
      .on("contextmenu", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: d.id });
      })
      .on("mouseover", function(event, d) {
        setHoveredNodeId(d.id);
        if (selectedNodeIdRef.current) return;
        d3.select(this)
          .attr("stroke-width", 4)
          .attr("filter", "url(#glow)");

        // Highlight connected links
        link.attr("stroke", l => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          return (srcId === d.id || tgtId === d.id) ? (d.group === 'chemical' ? '#3b82f6' : '#10b981') : '#94a3b8';
        })
        .attr("stroke-opacity", l => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          return (srcId === d.id || tgtId === d.id) ? 1 : 0.1;
        });

        // Fade out non-connected nodes
        node.attr("opacity", n => {
          if (n.id === d.id) return 1;
          const isConnected = data.links.some(l => {
            const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
            return (srcId === d.id && tgtId === n.id) || (tgtId === d.id && srcId === n.id);
          });
          return isConnected ? 1 : 0.15;
        });
      })
      .on("mouseout", function() {
        setHoveredNodeId(null);
        if (selectedNodeIdRef.current) return;
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("filter", null);

        // Reset highlights
        link.attr("stroke", "#94a3b8")
            .attr("stroke-opacity", 0.4);
        node.attr("opacity", 1);
      });

    // Handle background click to deselect
    svg.on("click", () => {
      setSelectedNodeId(null);
      setContextMenu(null);
    });

    // Add flowing particles layer under nodes
    const particleLinks = g.insert("g", ":first-child")
      .selectAll("path")
      .data(data.links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "url(#flowingGradient)")
      .attr("stroke-opacity", params.showParticles ? 0.6 : 0)
      .attr("stroke-width", (d: any) => Math.sqrt(d.value) * 1.5)
      .attr("stroke-dasharray", "4 8")
      .attr("class", "animate-[flow_0.5s_linear_infinite]");

    node.append("text")
      .attr("dx", 0)
      .attr("dy", d => d.radius + 16)
      .attr("text-anchor", "middle")
      .text(d => getDisplayName(d.id))
      .attr("opacity", params.showLabels ? 1 : 0)
      .attr("class", "font-sans text-[10px] font-bold fill-slate-700 dark:fill-slate-200 pointer-events-none transition-opacity duration-300")
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(255,255,255,0.8)")
      .attr("stroke-width", 3);

    // Make dark mode label background stroke look right
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      node.selectAll("text").attr("stroke", "rgba(15,23,42,0.8)");
    }

    simulation.on("tick", () => {
      const getPath = (d: any) => {
        if (params.linkStyle === 'curved') {
          const dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
          return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        }
        return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      };
      
      link.attr("d", getPath);
      particleLinks.attr("d", getPath);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Controls
    const resetZoom = () => {
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
      );
    };

    if (containerRef.current) {
      (containerRef.current as any).resetZoom = resetZoom;
    }

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]); // Note: removing dependencies that shouldn't trigger full simulation rebuild

  useEffect(() => {
    if (!simulationRef.current) return;
    const simulation = simulationRef.current;
    
    simulation.force("x", null).force("y", null);
    
    if (params.layout === 'force') {
      simulation
        .force("x", d3.forceX().strength(0.05))
        .force("y", d3.forceY().strength(0.05));
    } else if (params.layout === 'layered') {
      simulation
        .force("x", d3.forceX(dimensions.width / 2).strength(0.1))
        .force("y", d3.forceY((d: any) => d.group === 'chemical' ? dimensions.height * 0.25 : dimensions.height * 0.75).strength(0.3));
    }
    
    simulation.alpha(1).restart();
  }, [params.layout, dimensions.width, dimensions.height]);

  // Handle physics parameter updates
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.force("charge").strength(-params.repulsion);
      simulationRef.current.force("link").distance(params.linkDistance);
      simulationRef.current.alpha(0.3).restart();
    }
  }, [params.repulsion, params.linkDistance]);

  useEffect(() => {
    if (linkRef.current && gRef.current && simulationRef.current) {
       simulationRef.current.on('tick')(); // Call tick directly to redraw paths immediately
    }
  }, [params.linkStyle]);

  // Handle toggling display elements
  useEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.selectAll("text").attr("opacity", params.showLabels ? 1 : 0);
    }
    if (gRef.current) {
      gRef.current.selectAll(".animate-\\[flow_0\\.5s_linear_infinite\\]").attr("stroke-opacity", params.showParticles ? 0.6 : 0);
    }
  }, [params.showLabels, params.showParticles]);

  useEffect(() => {
    if (!nodeRef.current || !linkRef.current || !rawData || !gRef.current) return;
    
    // First reset everything to default state
    nodeRef.current.attr("opacity", 1);
    linkRef.current.attr("stroke", "#94a3b8").attr("stroke-opacity", 0.4);
    nodeRef.current.selectAll("circle").attr("stroke-width", 2).attr("filter", null);

    const query = searchQuery.trim().toLowerCase();

    if (selectedNodeId) {
      const d = rawData.nodes.find(n => n.id === selectedNodeId);
      if (d) {
        nodeRef.current.selectAll("circle")
          .filter((n: any) => n.id === selectedNodeId)
          .attr("stroke-width", 4)
          .attr("filter", "url(#glow)");

        const activeUpstreamLinks = new Set<string>();
        const activeDownstreamLinks = new Set<string>();
        const activeNodes = new Set<string>();

        if (params.traceMode) {
          activeNodes.add(selectedNodeId);

          const traverseDown = (id: string) => {
            rawData.links.forEach((l, idx) => {
              const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
              const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
              if (srcId === id) {
                activeDownstreamLinks.add(`${srcId}-${tgtId}-${idx}`);
                if (!activeNodes.has(tgtId)) {
                  activeNodes.add(tgtId);
                  traverseDown(tgtId);
                }
              }
            });
          };

          const traverseUp = (id: string) => {
            rawData.links.forEach((l, idx) => {
              const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
              const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
              if (tgtId === id) {
                activeUpstreamLinks.add(`${srcId}-${tgtId}-${idx}`);
                if (!activeNodes.has(srcId)) {
                  activeNodes.add(srcId);
                  traverseUp(srcId);
                }
              }
            });
          };

          if (params.traceDirection === 'both' || params.traceDirection === 'downstream') {
            traverseDown(selectedNodeId);
          }
          if (params.traceDirection === 'both' || params.traceDirection === 'upstream') {
            traverseUp(selectedNodeId);
          }
        }

        linkRef.current.attr("stroke", (l: any, idx: number) => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          const linkKey = `${srcId}-${tgtId}-${idx}`;
          
          if (params.traceMode) {
             if (params.traceDirection === 'both' || params.traceDirection === 'upstream') {
               if (activeUpstreamLinks.has(linkKey)) return '#3b82f6';
             }
             if (params.traceDirection === 'both' || params.traceDirection === 'downstream') {
               if (activeDownstreamLinks.has(linkKey)) return '#10b981';
             }
             return '#94a3b8';
          } else {
             return (srcId === d.id || tgtId === d.id) ? (d.group === 'chemical' ? '#3b82f6' : '#10b981') : '#94a3b8';
          }
        })
        .attr("stroke-opacity", (l: any, idx: number) => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          const linkKey = `${srcId}-${tgtId}-${idx}`;

          if (params.traceMode) {
             const isActive = activeUpstreamLinks.has(linkKey) || activeDownstreamLinks.has(linkKey);
             return isActive ? 1 : 0.05;
          } else {
             return (srcId === d.id || tgtId === d.id) ? 1 : 0.05;
          }
        });

        nodeRef.current.attr("opacity", (n: any) => {
          if (n.id === d.id) return 1;
          if (params.traceMode) {
             return activeNodes.has(n.id) ? 1 : 0.05;
          } else {
             const isConnected = rawData.links.some(l => {
              const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
              const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
              return (srcId === d.id && tgtId === n.id) || (tgtId === d.id && srcId === n.id);
            });
            return isConnected ? 1 : 0.05;
          }
        });
      }
    } else if (query) {
      // Highlight search matches
      nodeRef.current.attr("opacity", (n: any) => {
        const name = getDisplayName(n.id).toLowerCase();
        const engName = n.id.toLowerCase();
        const formula = (n.formula || '').toLowerCase();
        const cas = (n.cas || '').toLowerCase();
        return (name.includes(query) || engName.includes(query) || formula.includes(query) || cas.includes(query)) ? 1 : 0.05;
      });
      linkRef.current.attr("stroke-opacity", 0.05);
    }
  }, [selectedNodeId, searchQuery, params.traceMode, params.traceDirection, getDisplayName, dimensions]);

  const selectedNodeData = selectedNodeId ? rawData.nodes.find(n => n.id === selectedNodeId) : null;

  const handlePinNode = (nodeId: string, pinned: boolean) => {
    const node = rawData.nodes.find(n => n.id === nodeId) as any;
    if (node) {
      if (pinned) {
        node.fx = node.x;
        node.fy = node.y;
      } else {
        node.fx = null;
        node.fy = null;
      }
      if (simulationRef.current) simulationRef.current.alpha(0.3).restart();
    }
    setContextMenu(null);
  };

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flow {
          to { stroke-dashoffset: -12; }
        }
      `}} />
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ScanSearch className="w-5 h-5 text-indigo-500" />
          {t('DependencyMapTitle', 'Resin Dependency Map')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm drop-shadow-sm">
          {t('DependencyMapDesc', 'Interactive graph illustrating the relationships between base chemical components (monomers) and final resin types (polymers).')}
        </p>
        
        <div className="mt-4 flex gap-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-600/50" />
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 drop-shadow-sm">{t('BaseChemical', 'Base Chemical')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-600/50" />
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 drop-shadow-sm">{t('ResinType', 'Resin Type')}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-10 w-auto flex gap-2 pointer-events-auto items-start">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'zh' ? "搜索物质、CAS..." : "Search chemical, CAS..."}
            className="w-full pl-9 pr-4 py-2.5 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2.5 rounded-xl shadow-lg transition-all border backdrop-blur-md ${showSettings ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          title={language === 'zh' ? '设置' : 'Settings'}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-20 right-6 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 p-5 pointer-events-auto"
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-500" />
              {language === 'zh' ? '图表参数与显示' : 'Graph Physics & Display'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-mono text-slate-500 mb-1">{language === 'zh' ? '布局模式' : 'Layout Mode'}</p>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setParams(p => ({ ...p, layout: 'force' }))} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${params.layout === 'force' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Network size={14} />
                    {language === 'zh' ? '引力' : 'Force'}
                  </button>
                  <button onClick={() => setParams(p => ({ ...p, layout: 'layered' }))} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${params.layout === 'layered' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Layers size={14} />
                    {language === 'zh' ? '分层' : 'Layered'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-mono text-slate-500 mb-1">{language === 'zh' ? '连线样式' : 'Link Style'}</p>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setParams(p => ({ ...p, linkStyle: 'straight' }))} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${params.linkStyle === 'straight' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <GitBranch size={14} />
                    {language === 'zh' ? '直线' : 'Straight'}
                  </button>
                  <button onClick={() => setParams(p => ({ ...p, linkStyle: 'curved' }))} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${params.linkStyle === 'curved' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <RotateCcw size={14} />
                    {language === 'zh' ? '曲线' : 'Curved'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>{language === 'zh' ? '节点排斥力' : 'Node Repulsion'}</span>
                  <span>{params.repulsion}</span>
                </div>
                <input 
                  title="Node Repulsion"
                  type="range" min="100" max="1000" step="50"
                  value={params.repulsion}
                  onChange={e => setParams(p => ({ ...p, repulsion: Number(e.target.value)}))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>{language === 'zh' ? '连线长度' : 'Link Distance'}</span>
                  <span>{params.linkDistance}</span>
                </div>
                <input 
                  title="Link Distance"
                  type="range" min="50" max="300" step="10"
                  value={params.linkDistance}
                  onChange={e => setParams(p => ({ ...p, linkDistance: Number(e.target.value)}))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{language === 'zh' ? '深度追溯模式' : 'Deep Trace Mode'}</span>
                  <input type="checkbox" className="sr-only peer" checked={params.traceMode} onChange={e => setParams(p => ({ ...p, traceMode: e.target.checked}))} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500 relative"></div>
                </label>
                {params.traceMode && (
                  <div className="flex gap-2">
                    <button onClick={() => setParams(p => ({ ...p, traceDirection: 'upstream' }))} className={`flex-1 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${params.traceDirection === 'upstream' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {language === 'zh' ? '来源' : 'Upstream'}
                    </button>
                    <button onClick={() => setParams(p => ({ ...p, traceDirection: 'both' }))} className={`flex-1 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${params.traceDirection === 'both' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {language === 'zh' ? '双向' : 'Both'}
                    </button>
                    <button onClick={() => setParams(p => ({ ...p, traceDirection: 'downstream' }))} className={`flex-1 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${params.traceDirection === 'downstream' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {language === 'zh' ? '影响' : 'Downstream'}
                    </button>
                  </div>
                )}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{language === 'zh' ? '显示标签' : 'Show Labels'}</span>
                  <input type="checkbox" className="sr-only peer" checked={params.showLabels} onChange={e => setParams(p => ({ ...p, showLabels: e.target.checked}))} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500 relative"></div>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{language === 'zh' ? '粒子流动效果' : 'Particle Flow'}</span>
                  <input type="checkbox" className="sr-only peer" checked={params.showParticles} onChange={e => setParams(p => ({ ...p, showParticles: e.target.checked}))} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500 relative"></div>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-6 right-6 z-10 flex gap-2 pointer-events-auto">
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => svgRef.current && d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3)}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 rounded-xl shadow-lg hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
            title={language === 'zh' ? '放大' : 'Zoom In'}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={() => svgRef.current && d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.77)}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 rounded-xl shadow-lg hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
            title={language === 'zh' ? '缩小' : 'Zoom Out'}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex shadow-lg rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden backdrop-blur-md">
          <button 
            onClick={handleExportJSON}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-r border-slate-200 dark:border-slate-700"
            title={language === 'zh' ? '导出 JSON' : 'Export JSON'}
          >
            <FileJson className="w-4 h-4" />
          </button>
          <button 
            onClick={handleExportPNG}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-r border-slate-200 dark:border-slate-700"
            title={language === 'zh' ? '导出高清 PNG' : 'Export High-Res PNG'}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => (containerRef.current as any)?.resetZoom()}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-r border-slate-200 dark:border-slate-700"
            title={language === 'zh' ? '重置视图' : 'Reset View'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            title={language === 'zh' ? (isFullscreen ? '退出全屏' : '全屏显示') : 'Toggle Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div ref={wrapperRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-48 py-1 pointer-events-auto"
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                {getDisplayName(contextMenu.nodeId)}
              </p>
            </div>
            {(() => {
              const node = rawData.nodes.find(n => n.id === contextMenu.nodeId) as any;
              const isPinned = node && node.fx !== null && node.fx !== undefined;
              return (
                <div className="py-1">
                  <button 
                    onClick={() => handlePinNode(contextMenu.nodeId, !isPinned)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <MousePointerClick className="w-4 h-4" />
                    {language === 'zh' ? (isPinned ? '取消固定位置' : '固定当前位置') : (isPinned ? 'Unpin Node' : 'Pin Node')}
                  </button>
                  <button 
                    onClick={() => {
                       setSelectedNodeId(contextMenu.nodeId);
                       setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Info className="w-4 h-4" />
                    {language === 'zh' ? '查看详情' : 'View Details'}
                  </button>
                  <button 
                    onClick={() => {
                        window.open(`https://${language === 'zh' ? 'zh' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(language === 'zh' && nodeZhMap[contextMenu.nodeId] ? nodeZhMap[contextMenu.nodeId] : contextMenu.nodeId)}`, '_blank');
                        setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    {language === 'zh' ? '维基百科' : 'Wikipedia lookup'}
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hoveredNodeId && !selectedNodeId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 left-6 z-10 w-72 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl pointer-events-none"
          >
            {(() => {
              const d = rawData.nodes.find(n => n.id === hoveredNodeId);
              if (!d) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${d.group === 'chemical' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{getDisplayName(d.id)}</h4>
                  </div>
                  {d.desc && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{language === 'zh' ? (nodeZhDescMap[d.id] || d.desc) : d.desc}</p>}
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">{language === 'zh' ? '点击节点可以隔离查看' : 'Click to isolate node'}</p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-16 right-6 w-80 max-h-[80vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl z-20 overflow-hidden pointer-events-auto"
          >
            <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex gap-3 items-center">
                <div className={`p-2 rounded-xl text-white ${selectedNodeData.group === 'chemical' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                  {selectedNodeData.group === 'chemical' ? <FlaskConical size={20} /> : <Database size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{getDisplayName(selectedNodeData.id)}</h3>
                  <div className="flex gap-2 text-xs font-mono mt-1">
                    <span className={selectedNodeData.group === 'chemical' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {selectedNodeData.group === 'chemical' ? t('BaseChemical', 'Base Chemical') : t('ResinType', 'Resin Type')}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNodeId(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5">
              {(selectedNodeData.formula || selectedNodeData.cas) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedNodeData.formula && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{language === 'zh' ? '化学式' : 'Formula'}</p>
                      <p className="font-mono text-slate-800 dark:text-slate-200">{selectedNodeData.formula}</p>
                    </div>
                  )}
                  {selectedNodeData.cas && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{language === 'zh' ? 'CAS编号' : 'CAS No.'}</p>
                      <p className="font-mono text-slate-800 dark:text-slate-200">{selectedNodeData.cas}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedNodeData.desc && (
                <div>
                  <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                    <Info size={12} />
                    {language === 'zh' ? '概述' : 'Overview'}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                    {language === 'zh' ? (nodeZhDescMap[selectedNodeData.id] || selectedNodeData.desc) : selectedNodeData.desc}
                  </p>
                </div>
              )}
              
              <div className="mt-2">
                <a 
                  href={`https://${language === 'zh' ? 'zh' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(language === 'zh' && nodeZhMap[selectedNodeData.id] ? nodeZhMap[selectedNodeData.id] : selectedNodeData.id)}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <Globe size={14} />
                  {language === 'zh' ? '通过维基百科查询' : 'Wikipedia Lookup'}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DependencyMapD3;
