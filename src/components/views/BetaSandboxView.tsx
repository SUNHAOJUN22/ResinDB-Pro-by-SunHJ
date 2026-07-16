import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cpu,
  Wifi,
  Scan,
  TableProperties,
  Play,
  StopCircle,
  RefreshCw,
  Sliders,
  Terminal,
  Calculator,
  Layers,
  ChevronDown,
  ChevronRight,
  FileSearch,
  CheckCircle2,
  Database,
  AlertTriangle,
  Volume2,
  VolumeX,
  Activity
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToasts } from '@/contexts/ToastContext';
import { safeStorage } from '@/lib/utils';

// Standard scientific properties interface for our sandbox
interface SampleLot {
  id: string;
  name: string;
  mfr: number | null;
  density: number | null;
  modulus: number | null;
  crystallinity: number | null;
}

interface TelemetryPacket {
  _senderPing?: number;
  data?: {
    mfr?: number | string;
    density?: number | string;
    modulus?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Excel formula parser helper for raw lot row
const evaluateLotFormula = (lot: SampleLot, expr: string, t: (key: string) => string): string => {
  try {
    const lowerExpr = expr.toLowerCase();
    const hasDensity = lowerExpr.includes('[density]');
    const hasMfr = lowerExpr.includes('[mfr]');
    const hasModulus = lowerExpr.includes('[modulus]');
    const hasCrystallinity = lowerExpr.includes('[crystallinity]');

    if (hasDensity && (lot.density === null || lot.density === undefined || isNaN(lot.density))) return t('missingDensity');
    if (hasMfr && (lot.mfr === null || lot.mfr === undefined || isNaN(lot.mfr))) return t('missingMfr');
    if (hasModulus && (lot.modulus === null || lot.modulus === undefined || isNaN(lot.modulus))) return t('missingModulus');
    if (hasCrystallinity && (lot.crystallinity === null || lot.crystallinity === undefined || isNaN(lot.crystallinity))) return t('missingCrystal');

    let cleaned = lowerExpr;
    cleaned = cleaned.replace(/\[density\]/g, String(lot.density ?? 0));
    cleaned = cleaned.replace(/\[mfr\]/g, String(lot.mfr ?? 0));
    cleaned = cleaned.replace(/\[modulus\]/g, String(lot.modulus ?? 0));
    cleaned = cleaned.replace(/\[crystallinity\]/g, String(lot.crystallinity ?? 0));
    
    // Basic math operations sanitization
    if (/[^0-9+\-*/().\s]/g.test(cleaned)) {
      return t('formulaSyntaxErr');
    }
    
    // Safe numerical evaluation using standard Function syntax
    const calcResult = new Function(`return (${cleaned})`)();
    if (isNaN(calcResult) || !isFinite(calcResult)) return t('formulaMathErr');
    return Number(calcResult).toFixed(2);
  } catch {
    return t('formulaEvalErr');
  }
};

interface ComputedCellProps {
  lot: SampleLot;
  formula: string;
}

const ComputedCell: React.FC<ComputedCellProps> = React.memo(({ lot, formula }) => {
  const { t } = useLanguage();
  const result = useMemo(() => {
    return evaluateLotFormula(lot, formula, t);
  }, [lot, formula, t]);

  return (
    <span className="bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded text-[10.5px]">
      {result}
    </span>
  );
});

interface ParentProduct {
  id: string;
  name: string;
  category: string;
  baseDensity: number;
  lots: SampleLot[];
}

export const BetaSandboxView: React.FC = () => {
  const { t, language } = useLanguage();
  const DEVICES = useMemo(() => [
    { id: 'DMA-700', name: t('dma700Name'), type: t('dma700Type'), status: 'online', port: '8081' },
    { id: 'TGA-50', name: t('tga50Name'), type: t('tga50Type'), status: 'online', port: '8082' },
    { id: 'MFI-3', name: t('mfi3Name'), type: t('mfi3Type'), status: 'online', port: '9010' }
  ], [t]);
  const { addToast } = useToasts();

  // Stabilize addToast reference via useRef to prevent dependency size change bugs
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  // --- TAB / SECTION CONTROL ---
  const [activeTab, setActiveTab] = useState<'wasm' | 'telemetry' | 'gemini' | 'grid'>('wasm');
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    const saved = safeStorage.local.getItem("resindb-compact");
    return saved !== null ? saved === "true" : true;
  });

  // ==========================================
  // 1. WASM NEWTON-RAPHSON SOLVER STATE & LOGIC
  // ==========================================
  const [solverMode, setSolverMode] = useState<'js' | 'wasm'>('wasm');
  const [shearRate, setShearRate] = useState<number>(10);
  const [lambda, setLambda] = useState<number>(0.155); // 松弛时间常数
  const [nParameter, setNParameter] = useState<number>(0.35); // 稀剪切指数
  const [etaZero, setEtaZero] = useState<number>(2400); // 零剪切粘度
  const [wasmPerformanceLog, setWasmPerformanceLog] = useState<string[]>([]);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Carreau-Yasuda Formula Solver: η = η0 * [1 + (λ * γ)^2]^((n-1)/2)
  const calculatedViscosity = useMemo(() => {
    const l = isNaN(lambda) || !isFinite(lambda) ? 0.155 : lambda;
    const g = isNaN(shearRate) || !isFinite(shearRate) ? 10 : shearRate;
    const n = isNaN(nParameter) || !isFinite(nParameter) ? 0.35 : nParameter;
    const e = isNaN(etaZero) || !isFinite(etaZero) ? 2400 : etaZero;
    const term = 1 + Math.pow(l * g, 2);
    const exponent = (n - 1) / 2;
    const res = e * Math.pow(term, exponent);
    return isNaN(res) || !isFinite(res) ? 0 : res;
  }, [shearRate, lambda, nParameter, etaZero]);

  const fitterCurvePath = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => {
      const xVal = (i * 10);
      const curveShear = Math.max(1, xVal);
      const factorTerm = 1 + Math.pow(lambda * curveShear, 2);
      const expVal = (nParameter - 1) / 2;
      const visFit = etaZero * Math.pow(factorTerm, expVal);
      // Normalize point positions values
      const normX = (i / 50) * 500;
      const normY = isNaN(visFit) || !isFinite(visFit) ? 200 : Math.max(0, Math.min(200, 200 - (visFit / 5000) * 200));
      return `${normX},${normY}`;
    }).join(' L ');
  }, [lambda, nParameter, etaZero]);

  // Simulated Newton-Raphson Solver with performance timing
  const runFittingSolver = () => {
    if (isNaN(calculatedViscosity) || !isFinite(calculatedViscosity)) {
      setIsSolving(false);
      return;
    }
    setIsSolving(true);
    const startTime = performance.now();
    
    // Simulate complex multidimensional Newton-Raphson regression for viscosity curve fitting
    const guess = etaZero;
    let iterations = 0;
    const maxIterations = 50;
    const tolerance = 1e-6;

    // Simulate load corresponding to real compile-time loaded Native WASM heap calculations
    const loadFactor = solverMode === 'wasm' ? 10 : 8000;
    for (let l = 0; l < loadFactor; l++) {
      let x = guess;
      for (let i = 0; i < maxIterations; i++) {
        // Simulated rheology damping matrices convergence formula: f(x) = x^2 - calculatedViscosity*x
        const fx = x * x - calculatedViscosity * x;
        const dfx = 2 * x - calculatedViscosity;
        if (Math.abs(dfx) < 1e-12) break;
        const nextX = x - fx / dfx;
        if (Math.abs(nextX - x) < tolerance) {
          x = nextX;
          iterations = i;
          break;
        }
        x = nextX;
      }
    }

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(solverMode === 'wasm' ? 3 : 1);
    
    setTimeout(() => {
      const initLog = t('sandboxInitLog')
        .replace('{time}', new Date().toLocaleTimeString())
        .replace('{mode}', solverMode.toUpperCase());
      
      const convLog = t('sandboxConvLog')
        .replace('{visc}', calculatedViscosity.toFixed(2))
        .replace('{etaZero}', String(etaZero))
        .replace('{lambda}', String(lambda));
      
      const timingLog = t('sandboxTimingLog')
        .replace('{duration}', duration)
        .replace('{unit}', t('msUnit'))
        .replace('{steps}', String(iterations + 1));
      
      const detailsLog = solverMode === 'wasm'
        ? t('sandboxDetailsWasmLog').replace('{pct}', (parseFloat(duration) > 0 ? (4.2 / parseFloat(duration)) * 100 : 420).toFixed(0))
        : t('sandboxDetailsJsLog');

      setWasmPerformanceLog(prev => [
        initLog,
        convLog,
        timingLog,
        detailsLog,
        ...prev.slice(0, 10)
      ]);
      setIsSolving(false);
      
      const toastMsg = solverMode === 'wasm'
        ? t('sandboxToastWasmMsg').replace('{duration}', duration)
        : t('sandboxToastJsMsg').replace('{duration}', duration);
      
      addToast(
        solverMode === 'wasm' ? 'success' : 'info',
        toastMsg
      );
    }, 150);
  };

  // ==========================================
  // 2. LIVE INSTRUMENT TELEMETRY WORKFLOWS (EXTENDED WEBSOCKET INTEGRATION)
  // ==========================================
  const [telemetryActive, setTelemetryActive] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<string>('DMA-700');
  const [liveMfrOutput, setLiveMfrOutput] = useState<number>(2.1);
  const [liveDensityOutput, setLiveDensityOutput] = useState<number>(0.922);
  const [liveModulusOutput, setLiveModulusOutput] = useState<number>(1450);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const nextInjectedLotIdRef = useRef<number>(101);

  // Advanced WebSockets state definitions
  const [wsUrl, setWsUrl] = useState<string>('wss://echo.websocket.org');
  const [useVirtualSocket, setUseVirtualSocket] = useState<boolean>(true);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [pingTime, setPingTime] = useState<number | null>(null);
  const [rxFrames, setRxFrames] = useState<number>(0);
  const [txFrames, setTxFrames] = useState<number>(0);
  const [dataRate, setDataRate] = useState<number>(0); // MB/s or KB/s
  const [streamHz, setStreamHz] = useState<number>(1); // Stream rate
  const [targetLotId, setTargetLotId] = useState<string>('lot-1-1'); // Default active lot in matrix
  const [customTermCommand, setCustomTermCommand] = useState<string>(''); // Terminal manual send text

  // 1. Alert limit states (告警阀值设定)
  const [mfrWarningRange, setMfrWarningRange] = useState<{ min: number; max: number }>({ min: 1.0, max: 8.0 });
  const [densityWarningRange, setDensityWarningRange] = useState<{ min: number; max: number }>({ min: 0.890, max: 0.960 });
  const [modulusWarningRange, setModulusWarningRange] = useState<{ min: number; max: number }>({ min: 500, max: 3000 });
  const [crystallinityWarningRange, _setCrystallinityWarningRange] = useState<{ min: number; max: number }>({ min: 30.0, max: 80.0 });
  const [isAuditModeActive, setIsAuditModeActive] = useState<boolean>(true);
  const [hideNormalLots, setHideNormalLots] = useState<boolean>(false);

  // 2. Waveform generator profile (波形信号特征)
  // 'mild' = Light noise, 'drift' = Sine drift, 'spike' = High anomalies, 'calib' = Perfect calibration
  const [signalProfile, setSignalProfile] = useState<'mild' | 'drift' | 'spike' | 'calib'>('mild');

  // 3. Mini historic telemetry queues for real-time visualization sparklines (保存最近24个点)
  const [historyMfr, setHistoryMfr] = useState<number[]>([]);
  const [historyDensity, setHistoryDensity] = useState<number[]>([]);
  const [historyModulus, setHistoryModulus] = useState<number[]>([]);

  // Pre-calculate sparkline ranges to avoid O(N^2) Math.min/max recalculations inside map() during rendering
  const historyMfrMin = useMemo(() => Math.min(...historyMfr) * 0.95, [historyMfr]);
  const historyMfrMax = useMemo(() => Math.max(...historyMfr) * 1.05 || 1, [historyMfr]);
  const historyMfrDen = useMemo(() => historyMfrMax - historyMfrMin || 1, [historyMfrMin, historyMfrMax]);

  const historyDenMin = useMemo(() => Math.min(...historyDensity) * 0.999, [historyDensity]);
  const historyDenMax = useMemo(() => Math.max(...historyDensity) * 1.001 || 1, [historyDensity]);
  const historyDenDen = useMemo(() => historyDenMax - historyDenMin || 0.001, [historyDenMin, historyDenMax]);

  const historyModMin = useMemo(() => Math.min(...historyModulus) * 0.95, [historyModulus]);
  const historyModMax = useMemo(() => Math.max(...historyModulus) * 1.05 || 1, [historyModulus]);
  const historyModDen = useMemo(() => historyModMax - historyModMin || 1, [historyModMin, historyModMax]);

  // Simulation sliding base vectors
  const [simBaseMfr, setSimBaseMfr] = useState<number>(2.20);
  const [simBaseDensity, setSimBaseDensity] = useState<number>(0.925);
  const [simBaseModulus, setSimBaseModulus] = useState<number>(1420);

  // New Sockets advanced features & telemetry calibration states
  const [mfrCalibrationOffset, setMfrCalibrationOffset] = useState<number>(0.0);
  const [mfrCalibrationGain, setMfrCalibrationGain] = useState<number>(1.0);
  const [densityCalibrationOffset, setDensityCalibrationOffset] = useState<number>(0.0);
  const [densityCalibrationGain, setDensityCalibrationGain] = useState<number>(1.0);
  const [modulusCalibrationOffset, setModulusCalibrationOffset] = useState<number>(0);
  const [modulusCalibrationGain, setModulusCalibrationGain] = useState<number>(1.0);

  // Connection safety & simulation parameters
  const [simJitterMs, setSimJitterMs] = useState<number>(10);
  const [simPacketLossRate, setSimPacketLossRate] = useState<number>(0);
  const [logFilterLevel, setLogFilterLevel] = useState<'ALL' | 'INFO' | 'ALERT' | 'SWAP'>('ALL');
  const [totalAlarmsTriggered, setTotalAlarmsTriggered] = useState<number>(0);
  const [isAlarmMuted, setIsAlarmMuted] = useState<boolean>(false);
  const [socketSubTab, setSocketSubTab] = useState<'conn' | 'calib' | 'sim'>('conn');

  // Grid live highlight trackers
  const [highlightedLots, setHighlightedLots] = useState<Record<string, { mfr?: boolean; density?: boolean; modulus?: boolean }>>({});

  // Real WebSocket connection holder
  const socketRef = useRef<WebSocket | null>(null);

  // Master telemetry connection control effect
  useEffect(() => {
    if (!telemetryActive) {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (closeErr) {
          console.warn("WebSocket closed abruptly during tear down", closeErr);
        }
        socketRef.current = null;
      }
      setWsStatus('disconnected');
      return;
    }

    if (useVirtualSocket) {
      // MODE A: LOCAL WEBSOCKET LOOPBACK NODE & REAL-TIME EMULATOR
      setWsStatus('connecting');
      const connTimeout = setTimeout(() => {
        setWsStatus('connected');
        const stamp = new Date().toLocaleTimeString();
        setTelemetryLogs(prev => [
          t('wsVirtualSuccess').replace('{stamp}', stamp),
          `[${stamp}] [VIRTUAL WS LINK] Listening on virtual interface ws://localhost:3000/api/labs/ws`,
          t('wsTargetBound').replace('{id}', targetLotId),
          ...prev
        ].slice(0, 100));
        addToastRef.current('success', t('wsBrokerEstablished'));
      }, 500);

      let localTx = 0;
      let localRx = 0;
      let byteCounter = 0;

      const hz = Math.max(0.1, isNaN(streamHz) || !isFinite(streamHz) ? 1 : streamHz);
      const intervalDelay = 1000 / hz;
      const streamTimer = setInterval(() => {
        // Packet Loss simulation
        if (simPacketLossRate > 0 && Math.random() * 100 < simPacketLossRate) {
          const lossStamp = new Date().toLocaleTimeString();
          if (logFilterLevel === 'ALL' || logFilterLevel === 'ALERT') {
            setTelemetryLogs(prev => [
              t('wsPacketLoss').replace('{stamp}', lossStamp).replace('{rate}', String(simPacketLossRate)),
              ...prev
            ].slice(-100));
          }
          return;
        }

        // Compute high-fidelity values using base values + physical fluctuations based on selected signal profile
        let mfrDelta = 0;
        let denDelta = 0;
        let modDelta = 0;

        const timeFactor = Date.now() / 15000;

        if (signalProfile === 'mild') {
          mfrDelta = (Math.random() - 0.5) * 0.15;
          denDelta = (Math.random() - 0.5) * 0.003;
          modDelta = Math.floor((Math.random() - 0.5) * 40);
        } else if (signalProfile === 'drift') {
          mfrDelta = Math.sin(timeFactor) * 0.6 + (Math.random() - 0.5) * 0.05;
          denDelta = Math.cos(timeFactor) * 0.012 + (Math.random() - 0.5) * 0.001;
          modDelta = Math.floor(Math.sin(timeFactor) * 220 + (Math.random() - 0.5) * 15);
        } else if (signalProfile === 'spike') {
          mfrDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 2.2 : -1.6) : (Math.random() - 0.5) * 0.08);
          denDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 0.018 : -0.015) : (Math.random() - 0.5) * 0.001);
          modDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 580 : -420) : Math.floor((Math.random() - 0.5) * 15));
        } else {
          // calib: perfect flatline
          mfrDelta = 0;
          denDelta = 0;
          modDelta = 0;
        }

        const rawMfr = Math.max(0.01, parseFloat((simBaseMfr + mfrDelta).toFixed(3)));
        const rawDensity = Math.max(0.85, parseFloat((simBaseDensity + denDelta).toFixed(4)));
        const rawModulus = Math.max(100, Math.floor(simBaseModulus + modDelta));

        // APPLY CALIBRATION COEFFICIENTS (应用数字校准偏置与增益)
        const mfrVal = parseFloat((rawMfr * mfrCalibrationGain + mfrCalibrationOffset).toFixed(3));
        const denVal = parseFloat((rawDensity * densityCalibrationGain + densityCalibrationOffset).toFixed(4));
        const modVal = Math.max(0, Math.floor(rawModulus * modulusCalibrationGain + modulusCalibrationOffset));

        setLiveMfrOutput(mfrVal);
        setLiveDensityOutput(denVal);
        setLiveModulusOutput(modVal);

        setHistoryMfr(prev => [...prev, mfrVal].slice(-24));
        setHistoryDensity(prev => [...prev, denVal].slice(-24));
        setHistoryModulus(prev => [...prev, modVal].slice(-24));

        const packet = {
          timestamp: Date.now(),
          device: selectedDevice,
          port: DEVICES.find(d => d.id === selectedDevice)?.port || '8000',
          protocol: 'Virtual Sockets Bus',
          data: {
            mfr: mfrVal,
            density: denVal,
            modulus: modVal,
            crystallinity: selectedDevice === 'DMA-700' ? 68.2 : 51.4
          },
          status: 'HEALTHY'
        };

        const jsonStr = JSON.stringify(packet);
        byteCounter += jsonStr.length;
        localTx++;
        localRx++;
        setTxFrames(localTx);
        setRxFrames(localRx);
        setDataRate(parseFloat((byteCounter / 1024).toFixed(2)));
        
        // Simulating jitter (引入延迟抖动模拟)
        const jitterVariance = (Math.random() - 0.5) * simJitterMs;
        const simulatedPing = Math.max(1, Math.floor(3 + jitterVariance));
        setPingTime(simulatedPing);

        const stamp = new Date().toLocaleTimeString();
        const logsToAppend: string[] = [];

        if (logFilterLevel === 'ALL') {
          logsToAppend.push(`[${stamp}] [VIRTUAL WS TX] Broadcaster frame dispatched. Length: ${jsonStr.length} bytes`);
          logsToAppend.push(`[${stamp}] [VIRTUAL WS RX] Dynamic echo packet received back in loopback tunnel:`);
          logsToAppend.push(`  ↳ Sensor value: MFR = ${mfrVal} g/10min, Density = ${denVal} g/cm³, Elastic Modulus = ${modVal} MPa`);
        }

        // Check alarm limits (越界告警逻辑与计数器增加)
        const outOfMfr = mfrVal < mfrWarningRange.min || mfrVal > mfrWarningRange.max;
        const outOfDensity = denVal < densityWarningRange.min || denVal > densityWarningRange.max;
        const outOfModulus = modVal < modulusWarningRange.min || modVal > modulusWarningRange.max;

        if (outOfMfr || outOfDensity || outOfModulus) {
          setTotalAlarmsTriggered(c => c + 1);
          if (!isAlarmMuted) {
            if (outOfMfr) {
              logsToAppend.push(
                language === 'zh'
                  ? `🚨 [告警管理器] MFR 超出设定阈值范围 [已标定: ${mfrVal} g/10min] (允许: ${mfrWarningRange.min} - ${mfrWarningRange.max})`
                  : `🚨 [Alarm Manager] MFR out of range [Calibrated: ${mfrVal} g/10min] (Allowed: ${mfrWarningRange.min} - ${mfrWarningRange.max})`
              );
            }
            if (outOfDensity) {
              logsToAppend.push(
                language === 'zh'
                  ? `🚨 [告警管理器] 密度超出设定阈值范围 [已标定: ${denVal} g/cm³] (允许: ${densityWarningRange.min} - ${densityWarningRange.max})`
                  : `🚨 [Alarm Manager] Density out of range [Calibrated: ${denVal} g/cm³] (Allowed: ${densityWarningRange.min} - ${densityWarningRange.max})`
              );
            }
            if (outOfModulus) {
              logsToAppend.push(
                language === 'zh'
                  ? `🚨 [告警管理器] 杨氏模量超出设定阈值范围 [已标定: ${modVal} MPa] (允许: ${modulusWarningRange.min} - ${modulusWarningRange.max})`
                  : `🚨 [Alarm Manager] Elastic Modulus out of range [Calibrated: ${modVal} MPa] (Allowed: ${modulusWarningRange.min} - ${modulusWarningRange.max})`
              );
            }
          }
        }

        // Perform live hot-updating in our local evaluation table
        if (targetLotId && targetLotId !== 'none') {
          setNestedProducts(prev => prev.map(p => ({
            ...p,
            lots: p.lots.map(l => {
              if (l.id !== targetLotId) return l;

              // Set active hot-swapping visual highlight flags
              setHighlightedLots(prevH => ({
                ...prevH,
                [targetLotId]: { mfr: true, density: true, modulus: true }
              }));

              // Clear hot flash in 450ms
              setTimeout(() => {
                setHighlightedLots(prevH => {
                  const copy = { ...prevH };
                  delete copy[targetLotId];
                  return copy;
                });
              }, 450);

              return {
                ...l,
                mfr: mfrVal,
                density: denVal,
                modulus: modVal
              };
            })
          })));

          if (logFilterLevel === 'ALL' || logFilterLevel === 'SWAP') {
            logsToAppend.push(
              t('wsHotSwapSuccess').replace('{id}', targetLotId)
            );
          }
        }

        if (logsToAppend.length > 0) {
          setTelemetryLogs(prev => [...prev, ...logsToAppend].slice(-100));
        }
      }, intervalDelay);

      return () => {
        clearTimeout(connTimeout);
        clearInterval(streamTimer);
      };

    } else {
      // MODE B: GENUINE WEB CLIENT WEBSOCKET HANDSHAKE LOOP
      setWsStatus('connecting');
      const stamp = new Date().toLocaleTimeString();
      setTelemetryLogs(prev => [
        t('wsConnecting').replace('{stamp}', stamp).replace('{url}', wsUrl),
        ...prev
      ].slice(0, 100));

      try {
        const wsClient = new WebSocket(wsUrl);
        socketRef.current = wsClient;

        wsClient.onopen = () => {
          setWsStatus('connected');
          const openedStamp = new Date().toLocaleTimeString();
          setTelemetryLogs(prev => [
            ...prev,
            t('wsConnected').replace('{openedStamp}', openedStamp).replace('{url}', wsUrl),
            t('wsHandshakeCompleted')
          ].slice(-100));
          addToastRef.current('success', `WebSocket linked to: ${wsUrl}`);
        };

        wsClient.onclose = (ev) => {
          setWsStatus('disconnected');
          const closedStamp = new Date().toLocaleTimeString();
          setTelemetryLogs(prev => [
            ...prev,
            t('wsDisconnected')
              .replace('{stamp}', closedStamp)
              .replace('{code}', String(ev.code))
              .replace('{reason}', ev.reason || 'None')
          ].slice(-100));
        };

        wsClient.onerror = (wsErr) => {
          setWsStatus('error');
          const errTime = new Date().toLocaleTimeString();
          setTelemetryLogs(prev => [
            ...prev,
            t('wsHandshakeError').replace('{stamp}', errTime).replace('{cause}', wsErr?.toString() || 'SSL/Block'),
            t('wsHandshakeSolution')
          ].slice(-100));
          addToastRef.current('error', `WebSocket connection failed: ${wsUrl}`);
        };

        let remoteTx = 0;
        let remoteRx = 0;
        let remoteBytes = 0;

        wsClient.onmessage = (event) => {
          remoteRx++;
          setRxFrames(remoteRx);
          const rawPayload = event.data;
          remoteBytes += typeof rawPayload === 'string' ? rawPayload.length : 128;
          setDataRate(parseFloat((remoteBytes / 1024).toFixed(2)));

          let parsed = null;
          try {
            parsed = JSON.parse(rawPayload);
          } catch (jsonErr) {
            console.debug("Parsed data is raw text frame", jsonErr);
          }

          const rxStamp = new Date().toLocaleTimeString();
          const logsToAppend: string[] = [];

          if (logFilterLevel === 'ALL') {
            logsToAppend.push(`[${rxStamp}] [WS MESSAGE RECEIVED] (${rawPayload.length} bytes): ${rawPayload.substring(0, 140)}${rawPayload.length > 140 ? '...' : ''}`);
          }

          // Compute RTT latency back-propagation
          if (parsed && parsed._senderPing) {
            const jitterVal = (Math.random() - 0.5) * simJitterMs;
            const rtt = Math.max(1, Math.floor(Date.now() - parsed._senderPing + jitterVal));
            setPingTime(rtt);
            if (logFilterLevel === 'ALL') {
              logsToAppend.push(`⏱️ [WS NET GAUGES] Telemetry frame roundtrip delay calculated: ${rtt} ms`);
            }
          }

          // Propagate parsed payload values to Formulation matrix automatically
          if (parsed && parsed.data) {
            const receivedData = parsed.data;
            if (receivedData.mfr) {
              const val = parseFloat(String(receivedData.mfr));
              if (!isNaN(val) && isFinite(val)) {
                setLiveMfrOutput(val);
                setHistoryMfr(prev => [...prev, val].slice(-24));
              }
            }
            if (receivedData.density) {
              const val = parseFloat(String(receivedData.density));
              if (!isNaN(val) && isFinite(val)) {
                setLiveDensityOutput(val);
                setHistoryDensity(prev => [...prev, val].slice(-24));
              }
            }
            if (receivedData.modulus) {
              const val = parseFloat(String(receivedData.modulus));
              if (!isNaN(val) && isFinite(val)) {
                setLiveModulusOutput(val);
                setHistoryModulus(prev => [...prev, val].slice(-24));
              }
            }

            // Check alarm limits
            const outOfMfr = (receivedData.mfr || 0) < mfrWarningRange.min || (receivedData.mfr || 0) > mfrWarningRange.max;
            const outOfDensity = (receivedData.density || 0) < densityWarningRange.min || (receivedData.density || 0) > densityWarningRange.max;
            const outOfModulus = (receivedData.modulus || 0) < modulusWarningRange.min || (receivedData.modulus || 0) > modulusWarningRange.max;

            if (outOfMfr || outOfDensity || outOfModulus) {
              setTotalAlarmsTriggered(c => c + 1);
              if (!isAlarmMuted) {
                if (outOfMfr && receivedData.mfr) {
                  logsToAppend.push(
                    t('wsMfrRangeAlarm')
                      .replace('{mfr}', String(receivedData.mfr))
                      .replace('{min}', String(mfrWarningRange.min))
                      .replace('{max}', String(mfrWarningRange.max))
                  );
                }
                if (outOfDensity && receivedData.density) {
                  logsToAppend.push(
                    t('wsDensityRangeAlarm')
                      .replace('{density}', String(receivedData.density))
                      .replace('{min}', String(densityWarningRange.min))
                      .replace('{max}', String(densityWarningRange.max))
                  );
                }
                if (outOfModulus && receivedData.modulus) {
                  logsToAppend.push(
                    t('wsModulusRangeAlarm')
                      .replace('{modulus}', String(receivedData.modulus))
                      .replace('{min}', String(modulusWarningRange.min))
                      .replace('{max}', String(modulusWarningRange.max))
                  );
                }
              }
            }

            if (targetLotId && targetLotId !== 'none') {
              setNestedProducts(prev => prev.map(p => ({
                ...p,
                lots: p.lots.map(l => {
                  if (l.id !== targetLotId) return l;

                  setHighlightedLots(prevH => ({
                    ...prevH,
                    [targetLotId]: {
                      mfr: !!receivedData.mfr,
                      density: !!receivedData.density,
                      modulus: !!receivedData.modulus
                    }
                  }));

                  setTimeout(() => {
                    setHighlightedLots(prevH => {
                      const copy = { ...prevH };
                      delete copy[targetLotId];
                      return copy;
                    });
                  }, 450);

                  return {
                    ...l,
                    mfr: receivedData.mfr || l.mfr,
                    density: receivedData.density || l.density,
                    modulus: receivedData.modulus || l.modulus
                  };
                })
              })));

              if (logFilterLevel === 'ALL' || logFilterLevel === 'SWAP') {
                logsToAppend.push(
                  t('wsHotSwapMapped').replace('{id}', targetLotId)
                );
              }
            }
          }

          if (logsToAppend.length > 0) {
            setTelemetryLogs(prev => [...prev, ...logsToAppend].slice(-100));
          }
        };

        // Automatic stream transmitting loop over real websockets
        const hz = Math.max(0.1, isNaN(streamHz) || !isFinite(streamHz) ? 1 : streamHz);
      const intervalDelay = 1000 / hz;
        const streamTimer = setInterval(() => {
          if (wsClient.readyState !== WebSocket.OPEN) return;

          // Packet Loss simulation over network
          if (simPacketLossRate > 0 && Math.random() * 100 < simPacketLossRate) {
            const lossStamp = new Date().toLocaleTimeString();
            if (logFilterLevel === 'ALL' || logFilterLevel === 'ALERT') {
              setTelemetryLogs(prev => [
                t('wsRetransmitFailure').replace('{stamp}', lossStamp).replace('{rate}', String(simPacketLossRate)),
                ...prev
              ].slice(-100));
            }
            return;
          }

          // Compute high-fidelity values using base values + physical fluctuations based on selected signal profile
          let mfrDelta = 0;
          let denDelta = 0;
          let modDelta = 0;

          const timeFactor = Date.now() / 15000;

          if (signalProfile === 'mild') {
            mfrDelta = (Math.random() - 0.5) * 0.15;
            denDelta = (Math.random() - 0.5) * 0.003;
            modDelta = Math.floor((Math.random() - 0.5) * 40);
          } else if (signalProfile === 'drift') {
            mfrDelta = Math.sin(timeFactor) * 0.6 + (Math.random() - 0.5) * 0.05;
            denDelta = Math.cos(timeFactor) * 0.012 + (Math.random() - 0.5) * 0.001;
            modDelta = Math.floor(Math.sin(timeFactor) * 220 + (Math.random() - 0.5) * 15);
          } else if (signalProfile === 'spike') {
            mfrDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 2.2 : -1.6) : (Math.random() - 0.5) * 0.08);
            denDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 0.018 : -0.015) : (Math.random() - 0.5) * 0.001);
            modDelta = (Math.random() > 0.82 ? (Math.random() > 0.5 ? 580 : -420) : Math.floor((Math.random() - 0.5) * 15));
          } else {
            mfrDelta = 0;
            denDelta = 0;
            modDelta = 0;
          }

          const rawMfr = Math.max(0.01, parseFloat((simBaseMfr + mfrDelta).toFixed(3)));
          const rawDensity = Math.max(0.85, parseFloat((simBaseDensity + denDelta).toFixed(4)));
          const rawModulus = Math.max(100, Math.floor(simBaseModulus + modDelta));

          // APPLY CALIBRATION COEFFICIENTS (应用数字校准偏置与增益)
          const mfrVal = parseFloat((rawMfr * mfrCalibrationGain + mfrCalibrationOffset).toFixed(3));
          const denVal = parseFloat((rawDensity * densityCalibrationGain + densityCalibrationOffset).toFixed(4));
          const modVal = Math.max(0, Math.floor(rawModulus * modulusCalibrationGain + modulusCalibrationOffset));

          const txPacket = {
            _senderPing: Date.now(),
            device: selectedDevice,
            timestamp: Date.now(),
            data: {
              mfr: mfrVal,
              density: denVal,
              modulus: modVal,
              crystallinity: selectedDevice === 'DMA-700' ? 68.2 : 51.4
            }
          };

          const txStr = JSON.stringify(txPacket);
          wsClient.send(txStr);
          remoteTx++;
          setTxFrames(remoteTx);

          const txStamp = new Date().toLocaleTimeString();
          if (logFilterLevel === 'ALL') {
            setTelemetryLogs(prev => [
              ...prev,
              t('wsFrameTransmitted')
                .replace('{stamp}', txStamp)
                .replace('{packet}', txStr.substring(0, 110))
            ].slice(-100));
          }

        }, intervalDelay);

        return () => {
          clearInterval(streamTimer);
          wsClient.close();
        };

      } catch (wsInitErr) {
        setWsStatus('error');
        console.error("Constructing WebSocket interface raised exception:", wsInitErr);
      }
    }
  }, [
    telemetryActive,
    useVirtualSocket,
    wsUrl,
    selectedDevice,
    streamHz,
    simBaseMfr,
    simBaseDensity,
    simBaseModulus,
    targetLotId,
    signalProfile,
    mfrWarningRange,
    densityWarningRange,
    modulusWarningRange,
    mfrCalibrationGain,
    mfrCalibrationOffset,
    densityCalibrationGain,
    densityCalibrationOffset,
    modulusCalibrationGain,
    modulusCalibrationOffset,
    simPacketLossRate,
    logFilterLevel,
    simJitterMs,
    isAlarmMuted,
    t,
    language,
    DEVICES
  ]);

  // Handle hand-typed terminal packet injections
  const handleSendCustomFrame = () => {
    if (!customTermCommand.trim()) return;
    const stamp = new Date().toLocaleTimeString();

    let parsedBody: TelemetryPacket | null = null;
    try {
      parsedBody = JSON.parse(customTermCommand) as TelemetryPacket;
    } catch (parseSyntaxErr) {
      addToast('error', t('jsonMalformed'));
      setTelemetryLogs(prev => [
        ...prev,
        t('wsTermSyntaxError').replace('{stamp}', stamp).replace('{error}', String(parseSyntaxErr))
      ].slice(-80));
      return;
    }

    setTelemetryLogs(prev => [
      ...prev,
      t('wsTermExecute').replace('{stamp}', stamp)
    ].slice(-80));

    // If connected to a real WebSocket, let's actually send it!
    if (telemetryActive && !useVirtualSocket && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Inject standard ping if missing to calculate real roundtrip
      if (!parsedBody._senderPing) {
        parsedBody._senderPing = Date.now();
      }
      socketRef.current.send(JSON.stringify(parsedBody));
      setTxFrames(prev => prev + 1);
      setCustomTermCommand('');
      return;
    }

    // In Virtual or disconnected mode, we directly evaluate and inject local proxy response
    setTimeout(() => {
      const respStamp = new Date().toLocaleTimeString();
      const okLogs = [
        t('wsConsoleRxManual').replace('{stamp}', respStamp)
      ];

      if (parsedBody && parsedBody.data) {
        const receivedData = parsedBody.data;
        let finalMfr: number | undefined;
        let finalDensity: number | undefined;
        let finalModulus: number | undefined;

        if (receivedData.mfr !== undefined && receivedData.mfr !== null) {
          const val = parseFloat(String(receivedData.mfr));
          if (!isNaN(val) && isFinite(val)) {
            setLiveMfrOutput(val);
            finalMfr = val;
          }
        }
        if (receivedData.density !== undefined && receivedData.density !== null) {
          const val = parseFloat(String(receivedData.density));
          if (!isNaN(val) && isFinite(val)) {
            setLiveDensityOutput(val);
            finalDensity = val;
          }
        }
        if (receivedData.modulus !== undefined && receivedData.modulus !== null) {
          const val = parseFloat(String(receivedData.modulus));
          if (!isNaN(val) && isFinite(val)) {
            setLiveModulusOutput(val);
            finalModulus = val;
          }
        }

        if (targetLotId && targetLotId !== 'none') {
          setNestedProducts(prev => prev.map(p => ({
            ...p,
            lots: p.lots.map(l => {
              if (l.id !== targetLotId) return l;

              setHighlightedLots(prevH => ({
                ...prevH,
                [targetLotId]: {
                  mfr: finalMfr !== undefined,
                  density: finalDensity !== undefined,
                  modulus: finalModulus !== undefined
                }
              }));

              setTimeout(() => {
                setHighlightedLots(prevH => {
                  const copy = { ...prevH };
                  delete copy[targetLotId];
                  return copy;
                });
              }, 450);

              return {
                ...l,
                mfr: finalMfr !== undefined ? finalMfr : l.mfr,
                density: finalDensity !== undefined ? finalDensity : l.density,
                modulus: finalModulus !== undefined ? finalModulus : l.modulus
              };
            })
          })));
          okLogs.push(t('swappedInjected').replace('{target}', targetLotId));
        }
      } else {
        okLogs.push(`⚠️ [INTERPRETATION WARNING] Payload lacked standard {"data": {"mfr": ...}} keys. No direct row injection performed.`);
      }

      setRxFrames(prev => prev + 1);
      setTelemetryLogs(prev => [...prev, ...okLogs].slice(-80));
      setCustomTermCommand('');
      addToast('success', t('telemetryInjected'));
    }, 120);
  };

  // Keep logs scrolled down
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [telemetryLogs]);


  // ==========================================
  // 3. GEMINI MULTI-MODAL PROCESSOR STATE
  // ==========================================
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    extractedGrade: string;
    extractedFormula: string;
    extractedDensity: number;
    extractedMfr: number;
    extractedModulus: number;
    matchCertainty: string;
  } | null>(null);

  const scanTemplates = [
    {
      id: 'template-dsc',
      title: 'DSC Endothermic scan graph (差示量热结晶熔体谱)',
      thumb: '📈',
      color: 'from-blue-600/30 to-blue-900/30',
      gradeName: 'HDPE-DSC-X41',
      formula: 'CH2=CH2 + 1-Butene Copolymer',
      density: 0.942,
      mfr: 1.15,
      modulus: 1350,
      confidence: '98.5%'
    },
    {
      id: 'template-zn',
      title: 'Ziegler-Natta Catalysis sketch (高效催化中心纸质彩绘)',
      thumb: '🧬',
      color: 'from-emerald-600/30 to-emerald-900/30',
      gradeName: 'PP-ZN-LotA2',
      formula: 'Stereoregular Polypropylene Isotactic',
      density: 0.905,
      mfr: 3.42,
      modulus: 1480,
      confidence: '95.2%'
    },
    {
      id: 'template-formula',
      title: 'Handwritten Formula notebook photo (手写墨水工艺配方纸)',
      thumb: '📝',
      color: 'from-purple-600/30 to-purple-900/30',
      gradeName: 'EX-PE-REINFORCED',
      formula: 'Metallocene PE + 30% Nanoclay Composite',
      density: 1.152,
      mfr: 0.45,
      modulus: 3820,
      confidence: '91.8%'
    }
  ];

  const handleScanTemplate = (tpl: typeof scanTemplates[0]) => {
    setIsScanning(true);
    setScanningImage(tpl.id);
    setScanResult(null);

    // Simulated vision model pipeline
    setTimeout(() => {
      setIsScanning(false);
      setScanResult({
        success: true,
        extractedGrade: tpl.gradeName,
        extractedFormula: tpl.formula,
        extractedDensity: tpl.density,
        extractedMfr: tpl.mfr,
        extractedModulus: tpl.modulus,
        matchCertainty: tpl.confidence
      });
      addToast('success', `Gemini Multi-modal extracted specs for [${tpl.gradeName}]!`);
    }, 2200);
  };

  const handleInjectScannedLot = () => {
    if (!scanResult) return;
    const isPP = scanResult.extractedGrade.toLowerCase().includes('pp');
    const parentId = isPP ? 'parent-2' : 'parent-1';
    
    const injectedNum = nextInjectedLotIdRef.current;
    nextInjectedLotIdRef.current = injectedNum + 1;

    const newLot: SampleLot = {
      id: `lot-injected-${injectedNum}`,
      name: `AI: ${scanResult.extractedGrade}`,
      mfr: scanResult.extractedMfr,
      density: scanResult.extractedDensity,
      modulus: scanResult.extractedModulus,
      crystallinity: isPP ? 50.8 : 65.4
    };

    setNestedProducts(prev => prev.map(p => {
      if (p.id !== parentId) return p;
      return {
        ...p,
        lots: [newLot, ...p.lots]
      };
    }));

    setActiveTab('grid');
    setExpandedParents(prev => ({ ...prev, [parentId]: true }));
    addToast('success', `Successfully injected [${scanResult.extractedGrade}] into evaluation matrix!`);
  };


  // ==========================================
  // 4. NESTED GRID & MATH PARSING
  // ==========================================
  const [nestedProducts, setNestedProducts] = useState<ParentProduct[]>([
    {
      id: 'parent-1',
      name: 'High Density Polyethylene PE',
      category: 'HDPE',
      baseDensity: 0.950,
      lots: [
        { id: 'lot-1-1', name: 'Lot 26A-01', mfr: 0.85, density: 0.951, modulus: 1120, crystallinity: 67.5 },
        { id: 'lot-1-2', name: 'Lot 26A-02', mfr: 0.92, density: 0.949, modulus: 1080, crystallinity: 66.8 },
        { id: 'lot-1-3', name: 'Lot 26A-03', mfr: 0.88, density: 0.950, modulus: 1100, crystallinity: 67.1 }
      ]
    },
    {
      id: 'parent-2',
      name: 'Metallocene Copolymer PP',
      category: 'm-PP',
      baseDensity: 0.900,
      lots: [
        { id: 'lot-2-1', name: 'Lot 26B-04', mfr: 3.12, density: 0.901, modulus: 1450, crystallinity: 51.2 },
        { id: 'lot-2-2', name: 'Lot 26B-05', mfr: 3.55, density: 0.899, modulus: 1390, crystallinity: 50.4 }
      ]
    }
  ]);

  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({ 'parent-1': true });
  const [customFormulaExpr, setCustomFormulaExpr] = useState<string>('[density] * 1200 + [modulus] * 0.4');

  const toggleParent = (pId: string) => {
    setExpandedParents(prev => ({
      ...prev,
      [pId]: !prev[pId]
    }));
  };

  const handleUpdateLotProperty = (
    parentId: string,
    lotId: string,
    field: 'mfr' | 'density' | 'modulus' | 'crystallinity',
    value: string
  ) => {
    if (value === '') {
      setNestedProducts(prev => prev.map(p => {
        if (p.id !== parentId) return p;
        return {
          ...p,
          lots: p.lots.map(l => {
            if (l.id !== lotId) return l;
            return { ...l, [field]: null };
          })
        };
      }));
      return;
    }
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setNestedProducts(prev => prev.map(p => {
        if (p.id !== parentId) return p;
        return {
          ...p,
          lots: p.lots.map(l => {
            if (l.id !== lotId) return l;
            return { ...l, [field]: num };
          })
        };
      }));
    }
  };

  // --- DATA QUALITY AUDITING LOGIC & QUICK CONTROLS ---
  interface LotAnomaly {
    field: 'mfr' | 'density' | 'modulus' | 'crystallinity';
    type: 'missing' | 'out_of_range';
    value: number | null;
    message: string;
  }

  const getLotAnomalies = React.useCallback((lot: SampleLot): LotAnomaly[] => {
    const anomalies: LotAnomaly[] = [];
    
    // MFR
    if (lot.mfr === null || lot.mfr === undefined || isNaN(lot.mfr)) {
      anomalies.push({ field: 'mfr', type: 'missing', value: null, message: t('missingMfr') });
    } else if (lot.mfr < mfrWarningRange.min || lot.mfr > mfrWarningRange.max) {
      anomalies.push({ field: 'mfr', type: 'out_of_range', value: lot.mfr, message: `MFR: ${lot.mfr} (${mfrWarningRange.min} - ${mfrWarningRange.max})` });
    }

    // Density
    if (lot.density === null || lot.density === undefined || isNaN(lot.density)) {
      anomalies.push({ field: 'density', type: 'missing', value: null, message: t('missingDensity') });
    } else if (lot.density < densityWarningRange.min || lot.density > densityWarningRange.max) {
      anomalies.push({ field: 'density', type: 'out_of_range', value: lot.density, message: `Density: ${lot.density} (${densityWarningRange.min} - ${densityWarningRange.max})` });
    }

    // Modulus
    if (lot.modulus === null || lot.modulus === undefined || isNaN(lot.modulus)) {
      anomalies.push({ field: 'modulus', type: 'missing', value: null, message: t('missingModulus') });
    } else if (lot.modulus < modulusWarningRange.min || lot.modulus > modulusWarningRange.max) {
      anomalies.push({ field: 'modulus', type: 'out_of_range', value: lot.modulus, message: `Modulus: ${lot.modulus} (${modulusWarningRange.min} - ${modulusWarningRange.max})` });
    }

    // Crystallinity
    if (lot.crystallinity === null || lot.crystallinity === undefined || isNaN(lot.crystallinity)) {
      anomalies.push({ field: 'crystallinity', type: 'missing', value: null, message: t('missingCrystal') });
    } else if (lot.crystallinity < crystallinityWarningRange.min || lot.crystallinity > crystallinityWarningRange.max) {
      anomalies.push({ field: 'crystallinity', type: 'out_of_range', value: lot.crystallinity, message: `Crystallinity: ${lot.crystallinity}% (${crystallinityWarningRange.min}% - ${crystallinityWarningRange.max}%)` });
    }

    return anomalies;
  }, [mfrWarningRange, densityWarningRange, modulusWarningRange, crystallinityWarningRange, t]);

  const handleAutoRepairMissing = () => {
    setNestedProducts(prev => prev.map(p => ({
      ...p,
      lots: p.lots.map(l => ({
        ...l,
        mfr: (l.mfr === null || l.mfr === undefined || isNaN(l.mfr)) ? 2.50 : l.mfr,
        density: (l.density === null || l.density === undefined || isNaN(l.density)) ? 0.925 : l.density,
        modulus: (l.modulus === null || l.modulus === undefined || isNaN(l.modulus)) ? 1420 : l.modulus,
        crystallinity: (l.crystallinity === null || l.crystallinity === undefined || isNaN(l.crystallinity)) ? 55.4 : l.crystallinity,
      }))
    })));
    addToast('success', t('missingRepaired'));
  };

  const handleClampOutliers = () => {
    setNestedProducts(prev => prev.map(p => ({
      ...p,
      lots: p.lots.map(l => {
        let m = l.mfr;
        if (m !== null && !isNaN(m)) {
          m = Math.max(mfrWarningRange.min, Math.min(mfrWarningRange.max, m));
        }
        let d = l.density;
        if (d !== null && !isNaN(d)) {
          d = Math.max(densityWarningRange.min, Math.min(densityWarningRange.max, d));
        }
        let md = l.modulus;
        if (md !== null && !isNaN(md)) {
          md = Math.max(modulusWarningRange.min, Math.min(modulusWarningRange.max, md));
        }
        let cry = l.crystallinity;
        if (cry !== null && !isNaN(cry)) {
          cry = Math.max(crystallinityWarningRange.min, Math.min(crystallinityWarningRange.max, cry));
        }
        return {
          ...l,
          mfr: m,
          density: d,
          modulus: md,
          crystallinity: cry
        };
      })
    })));
    addToast('success', t('boundsClamped'));
  };

  const handleInjectAnomalies = () => {
    setNestedProducts(prev => prev.map(p => {
      if (p.id === 'parent-1') {
        const id1 = `lot-inj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const id2 = `lot-inj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        return {
          ...p,
          lots: [
            ...p.lots,
            { id: id1, name: 'Lot PE-DQA-09', mfr: null, density: 0.952, modulus: null, crystallinity: 68.2 },
            { id: id2, name: 'Lot PE-DQA-10', mfr: 12.5, density: 0.985, modulus: 4200, crystallinity: 91.5 }
          ]
        };
      }
      if (p.id === 'parent-2') {
        const id3 = `lot-inj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        return {
          ...p,
          lots: [
            ...p.lots,
            { id: id3, name: 'Lot PP-DQA-11', mfr: 0.25, density: 0.840, modulus: 120, crystallinity: 12.5 }
          ]
        };
      }
      return p;
    }));
    addToast('info', t('anomalyInjected'));
  };

  // Compute real-time data grid audit statistics
  const auditStats = useMemo(() => {
    let totalLots = 0;
    let anomalousLots = 0;
    let totalMissing = 0;
    let totalOutOfRange = 0;
    let totalFieldsChecked = 0;

    nestedProducts.forEach(parent => {
      parent.lots.forEach(lot => {
        totalLots++;
        const anomalies = getLotAnomalies(lot);
        if (anomalies.length > 0) {
          anomalousLots++;
          anomalies.forEach(a => {
            if (a.type === 'missing') totalMissing++;
            if (a.type === 'out_of_range') totalOutOfRange++;
          });
        }
        totalFieldsChecked += 4; // MFR, density, modulus, crystallinity
      });
    });

    const totalAnomalies = totalMissing + totalOutOfRange;
    const qualityScore = totalFieldsChecked > 0 
      ? Math.max(0, Math.round(((totalFieldsChecked - totalAnomalies) / totalFieldsChecked) * 100))
      : 100;

    return {
      totalLots,
      anomalousLots,
      totalMissing,
      totalOutOfRange,
      qualityScore
    };
  }, [nestedProducts, getLotAnomalies]);

  return (
    <div className={`h-full w-full flex flex-col bg-[#070a13] text-slate-100 font-sans relative transition-all duration-350 select-none overflow-hidden ${
      isCompact ? 'p-1.5 sm:p-2.5 space-y-2' : 'p-3 sm:p-4.5 space-y-4'
    }`}>
      
      {/* 🔮 ADVANCED LAB HUD CONSOLE HEADER */}
      <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5 shrink-0 ${
        isCompact ? 'mb-0.5 pb-2' : 'mb-2'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`relative bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0 ${
            isCompact ? 'p-1.5' : 'p-2.5'
          }`}>
            <Cpu className="text-white w-4.5 h-4.5 animate-[spin_4s_linear_infinite]" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight bg-gradient-to-r from-slate-50 via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                {t("sandboxTitle")}
              </h1>
              <span className="text-[8px] uppercase tracking-widest font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                AI / WASM Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              {t("sandboxSubtitle")}
            </p>
          </div>
        </div>

        {/* CONTROLS (DENSITY SWITCHER + ACTIVE DEVIATIONS TABS) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
          {/* Density Toggle Standard */}
          <div className="flex bg-slate-950/90 border border-slate-800/80 p-0.5 rounded-lg text-slate-400 font-mono text-[9px] shadow-inner">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsCompact(true);
                safeStorage.local.setItem("resindb-compact", "true");
                addToast("info", t("gridHighDensity"));
              }}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                isCompact ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-slate-200'
              }`}
            >
              {t('viewCompact')}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsCompact(false);
                safeStorage.local.setItem("resindb-compact", "false");
                addToast("info", t("gridRelaxedDensity"));
              }}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                !isCompact ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-slate-200'
              }`}
            >
              {t('viewRelaxed')}
            </motion.button>
          </div>

          {/* ACTIVE TABS SELECT PANEL */}
          <div className="flex bg-slate-950/90 border border-slate-800/85 p-0.5 rounded-lg shrink-0 overflow-x-auto custom-scrollbar shadow-inner">
            {[
              { id: 'wasm' as const, icon: Cpu, name: t('sandboxWasmSolver') },
              { id: 'telemetry' as const, icon: Wifi, name: t('sandboxTelemetry') },
              { id: 'gemini' as const, icon: Scan, name: t('sandboxGemini') },
              { id: 'grid' as const, icon: TableProperties, name: t('sandboxGrid') }
            ].map(tab => (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <tab.icon size={11} className={activeTab === tab.id ? "text-indigo-400" : "text-slate-500"} />
                <span>{tab.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* WORKSPACE MAIN AREA */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          
          {/* ======================================================== */}
          {/* TAB 1: RUST WEBASSEMBLY CARREAU-YASUDA FITTER */}
          {/* ======================================================== */}
          {activeTab === 'wasm' && (
            <motion.div
              key="wasm-tab"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.15 }}
              className={`grid grid-cols-1 lg:grid-cols-12 ${isCompact ? 'gap-2.5' : 'gap-4'}`}
            >
              {/* Controls and Stats Column */}
              <div className="lg:col-span-5 flex flex-col space-y-2.5">
                <div className={`bg-slate-950/60 border border-slate-800/70 rounded-xl relative overflow-hidden backdrop-blur-md shadow-lg ${
                  isCompact ? 'p-3 space-y-2.5' : 'p-4 space-y-3.5'
                }`}>
                  <div className="absolute top-0 right-0 p-4 opacity-[0.02] text-indigo-400 pointer-events-none">
                    <Cpu size={120} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold tracking-wider font-mono uppercase text-indigo-400 flex items-center gap-1.5">
                      <Sliders size={13} className="text-indigo-400" />
                      {t('rheologyTuner')}
                    </h3>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0 text-[8px] font-mono shadow-inner">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setSolverMode('js')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          solverMode === 'js' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        V8 JS
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setSolverMode('wasm')}
                        className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition-all ${
                          solverMode === 'wasm' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Cpu size={7} /> WASM
                      </motion.button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal leading-relaxed">
                    <span>{t('rheologyTunerDesc')}</span>
                  </p>

                  {/* Sliders in visual grid */}
                  <div className={`grid ${isCompact ? 'grid-cols-2 gap-x-3 gap-y-2' : 'grid-cols-1 gap-y-3'} pt-1.5 border-t border-slate-900`}>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{t('shearRate')}</span>
                        <span className="text-indigo-400 font-bold">{shearRate} s⁻¹</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="500"
                        value={shearRate}
                        onChange={(e) => setShearRate(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{t('zeroShearViscosity')}</span>
                        <span className="text-indigo-400 font-bold">{etaZero} Pa·s</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="5000"
                        step="50"
                        value={etaZero}
                        onChange={(e) => setEtaZero(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{t('relaxationTime')}</span>
                        <span className="text-indigo-400 font-bold">{lambda} s</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="1.50"
                        step="0.01"
                        value={lambda}
                        onChange={(e) => setLambda(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{t('shearExponent')}</span>
                        <span className="text-indigo-400 font-bold">{nParameter}</span>
                      </div>
                      <input
                        type="range"
                        min="0.10"
                        max="0.95"
                        step="0.02"
                        value={nParameter}
                        onChange={(e) => setNParameter(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Solver Fire Action */}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={runFittingSolver}
                    disabled={isSolving}
                    className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-750 text-white font-mono font-bold py-2 px-3 rounded-lg shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer text-[10px] uppercase tracking-wider mt-2.5"
                  >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isSolving ? (
                      <RefreshCw size={11} className="animate-spin text-indigo-300" />
                    ) : (
                      <Calculator size={11} className="text-indigo-200" />
                    )}
                    <span>{t('runNewtonSolver')}</span>
                  </motion.button>

                  {/* Timings Scoreboard */}
                  <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] shadow-sm">
                    <div className="border-r border-slate-900 pr-1.5">
                      <div className="text-slate-550 uppercase font-black tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full" />
                        <span>{t('jsV8Engine')}</span>
                      </div>
                      <div className="text-xs font-bold text-amber-500 mt-1">~ 0.85 {t('msUnit')}</div>
                      <div className="text-[8px] text-slate-600 mt-0.5 leading-none">
                        {t('v8HeapPause')}
                      </div>
                    </div>
                    <div className="pl-1.5">
                      <div className="text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span>{t('rustWasm')}</span>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-1">~ 0.04 {t('msUnit')}</div>
                      <div className="text-[8px] text-slate-600 mt-0.5 leading-none">
                        {t('exclusiveHeap')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Theoretical Equation Sandbox */}
                <div className="bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 font-mono text-[9px] text-indigo-300/80 space-y-1.5 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-300 border-b border-indigo-950 pb-1.5 uppercase flex items-center justify-between">
                    <span>Mathematical Physics Formula</span>
                    <span className="text-[8px] text-slate-500">Rheology Core v3.1.0</span>
                  </div>
                  <div>
                    <span className="text-teal-400 font-semibold"># Carreau-Yasuda Model:</span>
                    <br />
                    η(γ̇) = η0 * [1 + (λ * γ̇)²] ^ ((n - 1) / 2)
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold"># Newton-Raphson Solver:</span>
                    <br />
                    x_(k+1) = x_k - f(x_k) / f&apos;(x_k)
                  </div>
                </div>
              </div>

              {/* Advanced Real-time Graph Visualizer */}
              <div className="lg:col-span-7 flex flex-col space-y-2.5">
                <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-4 flex flex-col h-[330px] backdrop-blur-md shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Cpu className="text-emerald-400" size={13} />
                      {t("wasmStressCurve")}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>JIT STREAM ACTIVE</span>
                    </div>
                  </div>

                  {/* Draw simulated Plot using SVG */}
                  <div className="flex-1 bg-slate-950 rounded-lg border border-slate-900 relative overflow-hidden p-3 flex items-end">
                    {/* SVG background grids and coordinates */}
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 pointer-events-none opacity-[0.02]">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className="border-t border-l border-slate-500 w-full h-full" />
                      ))}
                    </div>

                    <div className="absolute top-2.5 left-2.5 font-mono text-[9px] text-slate-500 space-y-0.5 pointer-events-none">
                      <div>{t("viscosityUpperLimit")} <span className="text-indigo-400 font-bold">{etaZero} Pa·s</span></div>
                      <div>Relaxation constant (λ): <span className="text-indigo-400 font-bold">{lambda} s</span></div>
                    </div>

                    <div className="absolute top-2.5 right-2.5 bg-slate-900/60 border border-slate-800/80 rounded px-2 py-0.5 text-[9px] font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>Viscometry Curve Fit</span>
                    </div>

                    {/* SVG Graphic Element */}
                    <div className="w-full h-full relative pt-8 pb-5 px-7 flex items-end">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                        {/* Axes */}
                        <line x1="0" y1="200" x2="500" y2="200" stroke="#1e293b" strokeWidth="1.5" />
                        <line x1="0" y1="0" x2="0" y2="200" stroke="#1e293b" strokeWidth="1.5" />
                        
                        {/* Labels */}
                        <text x="475" y="195" fill="#475569" className="text-[9px] font-mono font-bold">γ̇</text>
                        <text x="5" y="12" fill="#475569" className="text-[9px] font-mono font-bold" transform="rotate(90, 5, 12)">Pa·s</text>

                        {/* Generated Newton Fit Curve */}
                        <path
                          d={`M ${fitterCurvePath}`}
                          fill="none"
                          stroke="url(#gradient-fitter)"
                          strokeWidth="3.5"
                          className="transition-all duration-300"
                          strokeLinecap="round"
                        />

                        {/* Interactive Dot */}
                        {(() => {
                          const normX = (shearRate / 500) * 500;
                          const normY = 200 - (calculatedViscosity / 5000) * 200;
                          return (
                            <>
                              <circle cx={normX} cy={normY} r="7" fill="#6366f1" className="animate-ping" opacity="0.3" />
                              <circle cx={normX} cy={normY} r="4" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="2" />
                              <line x1={normX} y1={normY} x2={normX} y2="200" stroke="#4f46e5/50" strokeDasharray="3 3" opacity="0.4" strokeWidth="1" />
                              <line x1="0" y1={normY} x2={normX} y2={normY} stroke="#4f46e5/50" strokeDasharray="3 3" opacity="0.4" strokeWidth="1" />
                            </>
                          );
                        })()}

                        {/* Gradient */}
                        <defs>
                          <linearGradient id="gradient-fitter" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#c084fc" />
                            <stop offset="50%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Performance Live Logs */}
                <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3 flex flex-col h-[145px] backdrop-blur-md shadow-lg">
                  <div className="text-[10px] font-mono font-bold text-slate-400 border-b border-slate-900 pb-2 mb-1.5 flex items-center justify-between uppercase">
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Terminal size={12} /> {t("dampingSpectrum")}
                    </span>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setWasmPerformanceLog([])}
                      className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors uppercase"
                    >
                      Clear
                    </motion.button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[9px] leading-relaxed custom-scrollbar text-slate-300 pr-1">
                    {wasmPerformanceLog.length === 0 ? (
                      <div className="text-slate-600 italic h-full flex flex-col items-center justify-center gap-1">
                        <span>{t("fitViscosityPrompt")}</span>
                      </div>
                    ) : (
                      wasmPerformanceLog.map((log, index) => (
                        <div key={index} className={`pl-2 border-l-2 py-0.5 ${
                          log.includes('🚀') 
                            ? 'text-emerald-400 font-bold border-emerald-500 bg-emerald-500/5' 
                            : log.includes('[TIMING]') 
                            ? 'text-teal-400 border-teal-500' 
                            : 'text-slate-400 border-slate-800'
                        }`}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: LIVE LABORATORY TELEMETRY WORKFLOWS */}
          {/* ======================================================== */}
          {activeTab === 'telemetry' && (
            <motion.div
              key="telemetry-tab"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.15 }}
              className={`grid grid-cols-1 lg:grid-cols-12 ${isCompact ? 'gap-2.5' : 'gap-4'}`}
            >
              {/* Left Column: Sockets Control Panel */}
              <div className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-3">
                <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-4 space-y-3.5 shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                    <h3 className="text-[11px] font-bold tracking-wider font-mono uppercase text-teal-400 flex items-center gap-1.5">
                      <Wifi size={13} className="text-teal-400 animate-pulse" />
                      {t("telemetryGateway")}
                    </h3>
                    
                    {/* Status badge */}
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                        wsStatus === 'connecting' ? 'bg-amber-500 animate-spin' :
                        wsStatus === 'error' ? 'bg-rose-500' : 'bg-slate-600'
                      }`} />
                      <span className={`text-[8.5px] uppercase tracking-wider font-mono font-bold ${
                        wsStatus === 'connected' ? 'text-emerald-400' :
                        wsStatus === 'connecting' ? 'text-amber-400' :
                        wsStatus === 'error' ? 'text-rose-400' : 'text-slate-500'
                      }`}>
                        {wsStatus === 'connected' ? t("connected") :
                         wsStatus === 'connecting' ? t("connecting") :
                         wsStatus === 'error' ? t("statusError") : t("disconnected")}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Establish high-frequency real-time physical telemetry pipelines directly into the experimental data spreadsheet.
                    <br />
                    <span className="text-teal-400/80 font-mono text-[9px]">建立高频理化分析探针 of real-time fluid telemetry pipelines into target lot spreadsheets.</span>
                  </p>

                  {/* Sockets Sub Tabs Navigation */}
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-900">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setSocketSubTab('conn')}
                      className={`py-1.5 px-1 text-center font-mono text-[9px] rounded font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${
                        socketSubTab === 'conn'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                          : 'text-slate-500 hover:text-slate-355'
                      }`}
                    >
                      <Database size={10} className={socketSubTab === 'conn' ? 'text-teal-400' : 'text-slate-600'} />
                      <span>{t("connTopology")}</span>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setSocketSubTab('calib')}
                      className={`py-1.5 px-1 text-center font-mono text-[9px] rounded font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${
                        socketSubTab === 'calib'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                          : 'text-slate-500 hover:text-slate-355'
                      }`}
                    >
                      <Sliders size={10} className={socketSubTab === 'calib' ? 'text-teal-400' : 'text-slate-600'} />
                      <span>{t("telemetryCalib")}</span>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setSocketSubTab('sim')}
                      className={`py-1.5 px-1 text-center font-mono text-[9px] rounded font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${
                        socketSubTab === 'sim'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                          : 'text-slate-500 hover:text-slate-355'
                      }`}
                    >
                      <Activity size={10} className={socketSubTab === 'sim' ? 'text-teal-400' : 'text-slate-600'} />
                      <span>{t("jitterSim")}</span>
                    </motion.button>
                  </div>

                  {/* ==================== SUB-TAB 1: CONNECTION TOPO ==================== */}
                  {socketSubTab === 'conn' && (
                    <div className="space-y-3.5 animate-fadeIn">
                      {/* Preset Profile */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">
                          WS Connection Profile / 套接字通信信道
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-900">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setUseVirtualSocket(true);
                              if (telemetryActive) {
                                setTelemetryActive(false);
                                addToast('info', 'Switched to Virtual Loopback mode / 已切换至环回仿真通道');
                              }
                            }}
                            className={`py-1 text-[9px] font-mono rounded font-bold cursor-pointer transition-all ${
                              useVirtualSocket 
                                ? 'bg-slate-805 text-teal-300 border border-teal-500/20' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {t("virtualLoopback")}
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setUseVirtualSocket(false);
                              if (telemetryActive) {
                                setTelemetryActive(false);
                                addToast('info', 'Switched to Physical WebSockets / 已切换至物理通讯通道');
                              }
                            }}
                            className={`py-1 text-[9px] font-mono rounded font-bold cursor-pointer transition-all ${
                              !useVirtualSocket 
                                ? 'bg-slate-805 text-teal-300 border border-teal-500/20' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {t("physicalWebSockets")}
                          </motion.button>
                        </div>
                      </div>

                      {/* URL Config or Loopback Banner */}
                      {!useVirtualSocket ? (
                        <div className="space-y-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                          <label className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Remote WebSockets Endpoint / 远程物理套接字</span>
                            <span className="text-teal-500 text-[7px] font-normal">WSS over Secure Context</span>
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={wsUrl}
                              onChange={(e) => setWsUrl(e.target.value)}
                              placeholder="wss://echo.websocket.org"
                              className="flex-1 bg-slate-900 border border-slate-850 text-[10.5px] font-mono px-2 py-1 rounded text-teal-300 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setWsUrl('wss://echo.websocket.org');
                                addToast('info', 'Reset endpoint profile with echo backup');
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded text-[9px] font-mono cursor-pointer transition-colors"
                            >
                              Reset / 重置
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[9px] font-mono text-slate-400 bg-slate-950 px-3 py-2.5 rounded-lg border border-slate-900 flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping shrink-0 mt-1" />
                          <div>
                            <span className="font-bold text-slate-300">Local isolation virtual telemetry pipeline runs offline.</span>
                            <div className="text-slate-550 text-[8px] mt-0.5 leading-normal">
                              环回变送通道完全在本地安全沙箱内闭环，排除不安全 WSS 拦截。由于浏览器混合内容同源策略，请优先使用本地环回避免 SSL 阻断。
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sockets Mapping and Device config */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                        <div className="space-y-1">
                          <span className="text-slate-500 uppercase font-black">Sensory Node / 采样仪器探头</span>
                          <select
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 focus:outline-none focus:border-teal-500 text-slate-200 py-1 px-1.5 rounded"
                          >
                            {DEVICES.map(d => (
                              <option key={d.id} value={d.id}>{d.name.split(' ')[0]} ({d.id})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-500 uppercase font-black">Tx Frequency / 变送刷新频率</span>
                          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 border border-slate-900 rounded h-[23px] items-center">
                            {[1, 2, 5, 10].map(hz => (
                              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                key={hz}
                                onClick={() => {
                                  setStreamHz(hz);
                                  addToast('info', `Frequency adjusted to ${hz} Hz`);
                                }}
                                className={`text-center rounded font-extrabold text-[8px] cursor-pointer h-full transition-colors ${
                                  streamHz === hz 
                                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/25' 
                                    : 'text-slate-600 hover:text-slate-455'
                                }`}
                              >
                                {hz}Hz
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Waveform Selector */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-mono text-slate-500 uppercase font-black flex items-center justify-between">
                          <span>Raw Waveform Profiler / 发生器信号特征</span>
                          <span className="text-[8px] text-teal-400 capitalize">{signalProfile} profiling</span>
                        </span>
                        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-900">
                          {[
                            { id: 'mild' as const, label_en: 'Mild', label_cn: '温和波动' },
                            { id: 'drift' as const, label_en: 'Drift', label_cn: '温漂正弦' },
                            { id: 'spike' as const, label_en: 'Spikes', label_cn: '瞬态尖峰' },
                            { id: 'calib' as const, label_en: 'Calib', label_cn: '零漂基线' }
                          ].map(profile => (
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              key={profile.id}
                              onClick={() => {
                                setSignalProfile(profile.id);
                                addToast('info', `Signal Profile shifted to ${profile.label_en}`);
                              }}
                              className={`py-1 text-center font-mono text-[8px] rounded transition-all cursor-pointer ${
                                signalProfile === profile.id
                                  ? 'bg-teal-500/15 text-teal-350 border border-teal-500/30'
                                  : 'text-slate-500 hover:text-slate-350 bg-transparent border border-transparent'
                              }`}
                            >
                              <div className="font-bold text-[8.5px]">{profile.label_en}</div>
                              <div className="text-[7.5px] opacity-75 scale-90">{profile.label_cn}</div>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Base sliders */}
                      <div className="space-y-2 bg-slate-950/80 p-2 rounded-lg border border-slate-900">
                        <span className="text-[8px] font-mono text-slate-500 uppercase font-bold tracking-wider">Nominal Physical Wave Origin / 基准物理量中心值</span>
                        
                        {/* MFR */}
                        <div className="space-y-0.5 text-[9px] font-mono">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>MFR 基点值</span>
                            <span className="text-teal-400 font-bold">{simBaseMfr.toFixed(2)} g/10min</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="15.0"
                            step="0.05"
                            value={simBaseMfr}
                            onChange={(e) => setSimBaseMfr(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-teal-500"
                          />
                        </div>

                        {/* Density */}
                        <div className="space-y-0.5 text-[9px] font-mono">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Density 结晶密度基点</span>
                            <span className="text-sky-400 font-bold">{simBaseDensity.toFixed(4)} g/cm³</span>
                          </div>
                          <input
                            type="range"
                            min="0.860"
                            max="1.150"
                            step="0.001"
                            value={simBaseDensity}
                            onChange={(e) => setSimBaseDensity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-teal-500"
                          />
                        </div>

                        {/* Elastic Modulus */}
                        <div className="space-y-0.5 text-[9px] font-mono">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Modulus 弹性模量基数</span>
                            <span className="text-indigo-400 font-bold">{simBaseModulus} MPa</span>
                          </div>
                          <input
                            type="range"
                            min="150"
                            max="4500"
                            step="50"
                            value={simBaseModulus}
                            onChange={(e) => setSimBaseModulus(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================== SUB-TAB 2: CALIBRATION PANEL ==================== */}
                  {socketSubTab === 'calib' && (
                    <div className="space-y-3.5 animate-fadeIn">
                      <div className="text-[9px] font-mono text-slate-400 bg-slate-905 p-2 rounded border border-slate-900 flex items-start gap-1.5 leading-relaxed">
                        <Sliders size={13} className="text-teal-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-slate-200 font-bold">智能硬件数字标定与测量补偿通道</div>
                          <span>标定增益与零偏对传感器反馈的物理原始信号进行变换，变换公式：</span>
                          <code className="text-teal-400 block mt-0.5 font-bold">最终输出值 = (物理量原始值 * 标定增益 Gain) + 零偏补偿 Offset</code>
                        </div>
                      </div>

                      {/* MFR Calibrator Slider Group */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                          <span className="text-[9px] font-mono font-bold text-teal-400 tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            {t("mfrCalibration")}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>{t("mfrGain")}</span>
                              <span className="text-slate-300 font-bold">{mfrCalibrationGain.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={mfrCalibrationGain}
                              onChange={(e) => setMfrCalibrationGain(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>MFR 零偏补偿 (Δ)</span>
                              <span className="text-slate-300 font-bold">{(mfrCalibrationOffset >= 0 ? '+' : '')}{mfrCalibrationOffset.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min="-2.0"
                              max="2.0"
                              step="0.1"
                              value={mfrCalibrationOffset}
                              onChange={(e) => setMfrCalibrationOffset(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-450"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Density Calibrator Slider Group */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                          <span className="text-[9px] font-mono font-bold text-sky-400 tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            Density (分子密度) 与结晶度校准
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>密度标定增益 (x)</span>
                              <span className="text-slate-300 font-bold">{densityCalibrationGain.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.8"
                              max="1.2"
                              step="0.01"
                              value={densityCalibrationGain}
                              onChange={(e) => setDensityCalibrationGain(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-450"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>密度补偿偏置 (Δ)</span>
                              <span className="text-slate-300 font-bold">{(densityCalibrationOffset >= 0 ? '+' : '')}{densityCalibrationOffset.toFixed(4)}</span>
                            </div>
                            <input
                              type="range"
                              min="-0.04"
                              max="0.04"
                              step="0.001"
                              value={densityCalibrationOffset}
                              onChange={(e) => setDensityCalibrationOffset(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-450"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Elastic Modulus Calibrator Slider Group */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                          <span className="text-[9px] font-mono font-bold text-indigo-400 tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            Elastic Modulus (弯曲模量) 对线补偿
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>杨氏模量增益 (x)</span>
                              <span className="text-slate-300 font-bold">{modulusCalibrationGain.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={modulusCalibrationGain}
                              onChange={(e) => setModulusCalibrationGain(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-450"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>模量补偿段 (MPa)</span>
                              <span className="text-slate-300 font-bold">{(modulusCalibrationOffset >= 0 ? '+' : '')}{modulusCalibrationOffset}</span>
                            </div>
                            <input
                              type="range"
                              min="-600"
                              max="600"
                              step="20"
                              value={modulusCalibrationOffset}
                              onChange={(e) => setModulusCalibrationOffset(parseInt(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-450"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Reset Calibration button */}
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setMfrCalibrationGain(1.0);
                          setMfrCalibrationOffset(0.0);
                          setDensityCalibrationGain(1.0);
                          setDensityCalibrationOffset(0.0);
                          setModulusCalibrationGain(1.0);
                          setModulusCalibrationOffset(0);
                          addToast('info', 'All digital calibration channels reset to unity default / 标定参数全复位成功');
                        }}
                        className="w-full py-1 text-center font-mono text-[8.5px] uppercase font-bold tracking-wider text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-900 rounded hover:border-slate-800 transition-all cursor-pointer"
                      >
                        Reset Calibration Channels / 复位传感器标定通道
                      </motion.button>
                    </div>
                  )}

                  {/* ==================== SUB-TAB 3: SIMULATION CONFIG & ALARMS ==================== */}
                  {socketSubTab === 'sim' && (
                    <div className="space-y-3.5 animate-fadeIn">
                      {/* Physical Network simulation: jitter and dropouts */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-2.5">
                        <span className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider block border-b border-slate-950 pb-1 flex items-center justify-between">
                          <span>Physical Link Emulation / 传输介质物理仿真</span>
                          <span className="text-[7.5px] text-teal-400">HIGH-FIDELITY</span>
                        </span>

                        {/* Jitter */}
                        <div className="space-y-1 text-[9px] font-mono">
                          <div className="flex justify-between text-slate-500">
                            <span>链路延迟波动抖动 Jitter</span>
                            <span className="text-slate-300 font-bold">{simJitterMs} ms</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="150"
                            step="2"
                            value={simJitterMs}
                            onChange={(e) => setSimJitterMs(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-500"
                          />
                        </div>

                        {/* Packet drops out */}
                        <div className="space-y-1 text-[9px] font-mono">
                          <div className="flex justify-between text-slate-500">
                            <span>高频瞬态丢包、通信断流率</span>
                            <span className={`font-bold ${simPacketLossRate > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{simPacketLossRate} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="45"
                            step="5"
                            value={simPacketLossRate}
                            onChange={(e) => setSimPacketLossRate(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-500"
                          />
                        </div>
                      </div>

                      {/* Alert parameters tuning boundaries */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-2">
                        <span className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider block border-b border-slate-950 pb-1 flex items-center justify-between">
                          <span>Alarm Boundaries Limits / 安全警报告警阈值范围</span>
                          <span className="text-[7.5px] text-amber-400 uppercase">Alert tuning</span>
                        </span>

                        <div className="space-y-1.5 text-[8.5px] font-mono text-slate-400">
                          {/* MFR Limits */}
                          <div className="flex items-center justify-between">
                            <span>MFR 指数安全上限 - 下限:</span>
                            <div className="flex items-center gap-1 text-[9px]">
                              <input
                                type="number"
                                step="0.1"
                                value={mfrWarningRange.min}
                                onChange={e => setMfrWarningRange(p => ({ ...p, min: parseFloat(e.target.value) || 0 }))}
                                className="w-10 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                              <span>-</span>
                              <input
                                type="number"
                                step="0.1"
                                value={mfrWarningRange.max}
                                onChange={e => setMfrWarningRange(p => ({ ...p, max: parseFloat(e.target.value) || 0 }))}
                                className="w-10 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                            </div>
                          </div>

                          {/* Density Limits */}
                          <div className="flex items-center justify-between">
                            <span>Density 密度安全极限范围:</span>
                            <div className="flex items-center gap-1 text-[9px]">
                              <input
                                type="number"
                                step="0.005"
                                value={densityWarningRange.min}
                                onChange={e => setDensityWarningRange(p => ({ ...p, min: parseFloat(e.target.value) || 0 }))}
                                className="w-12 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                              <span>-</span>
                              <input
                                type="number"
                                step="0.005"
                                value={densityWarningRange.max}
                                onChange={e => setDensityWarningRange(p => ({ ...p, max: parseFloat(e.target.value) || 0 }))}
                                className="w-12 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                            </div>
                          </div>

                          {/* Modulus Limits */}
                          <div className="flex items-center justify-between">
                            <span>Modulus 杨氏阻力安全界限:</span>
                            <div className="flex items-center gap-1 text-[9px]">
                              <input
                                type="number"
                                step="50"
                                value={modulusWarningRange.min}
                                onChange={e => setModulusWarningRange(p => ({ ...p, min: parseInt(e.target.value) || 0 }))}
                                className="w-10 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                              <span>-</span>
                              <input
                                type="number"
                                step="50"
                                value={modulusWarningRange.max}
                                onChange={e => setModulusWarningRange(p => ({ ...p, max: parseInt(e.target.value) || 0 }))}
                                className="w-10 bg-slate-950 border border-slate-800 text-[8px] text-center text-teal-300 rounded py-0.5"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Alarms diagnostics state and Muting controllers */}
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-900 flex items-center justify-between text-[9px] font-mono leading-none">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <AlertTriangle size={12} className={totalAlarmsTriggered > 0 && !isAlarmMuted ? 'text-amber-400 animate-pulse' : 'text-slate-600'} />
                          <span>历史累计告警: <strong className="text-rose-400 font-bold">{totalAlarmsTriggered}</strong> 次</span>
                        </div>
                        
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => setIsAlarmMuted(!isAlarmMuted)}
                          className={`px-2.5 py-1 text-[8.5px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                            isAlarmMuted
                              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-950 hover:bg-slate-900 text-slate-400'
                          }`}
                        >
                          {isAlarmMuted ? (
                            <>
                              <VolumeX size={10} />
                              <span>已静音 Muted</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={10} />
                              <span>有频警报 Alert Active</span>
                            </>
                          )}
                        </motion.button>
                      </div>

                      {/* Logger log level filter */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-mono text-slate-500 uppercase font-black">Diagnostic Logger Log Filter / 终端日志级别过滤</span>
                        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 rounded border border-slate-900">
                          {[
                            { id: 'ALL' as const, label: 'ALL (全部)' },
                            { id: 'INFO' as const, label: 'INFO (普通)' },
                            { id: 'ALERT' as const, label: 'WARN (告警)' },
                            { id: 'SWAP' as const, label: 'GRID (注入)' }
                          ].map(item => (
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              key={item.id}
                              onClick={() => {
                                setLogFilterLevel(item.id);
                                addToast('info', `Terminal filter configured: ${item.id}`);
                              }}
                              className={`py-0.5 text-center text-[8.5px] font-mono rounded cursor-pointer transition-colors ${
                                logFilterLevel === item.id
                                  ? 'bg-slate-800 text-teal-300 font-bold'
                                  : 'text-slate-500 hover:text-slate-350'
                              }`}
                            >
                              {item.id}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Matrix Direct Binding Dropdown - Connect Telemetry to Data Matrix */}
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-905 space-y-1.5 flex flex-col pt-2.5 border-t border-slate-900">
                    <label className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center justify-between">
                      <span>实时配方数字网格映射 / Formula Grid Integration</span>
                      <span className="text-[7.5px] bg-teal-500/10 border border-teal-500/20 px-1 py-0.2 rounded text-teal-300 font-bold">MATRIX DIRECT SYNC</span>
                    </label>
                    <div className="flex gap-2">
                       <select
                        value={targetLotId}
                        onChange={(e) => {
                          setTargetLotId(e.target.value);
                          if (e.target.value !== 'none') {
                            addToast('info', `Sockets telemetry mapped onto Formulation lot: ${e.target.value} / 已成功绑定高频数据热注入表格的目标批次！`);
                          } else {
                            addToast('info', 'Sockets unbound / 实测流变映射断开，仪表盘仅保持就地监测 / Sockets unbound from matrix');
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-805 focus:outline-none focus:border-teal-500 text-[10px] font-mono font-bold py-1 px-2 rounded cursor-pointer text-slate-200"
                      >
                        <option value="none" className="text-slate-500">-- SUSPEND MATRIX MAPPING / 仅作设备遥测检测，暂挂表格动态注入 --</option>
                        {nestedProducts.flatMap(p => p.lots).map(lot => (
                          <option key={lot.id} value={lot.id} className="text-slate-200">
                            数据注入目标批次 / Target Lot: {lot.name} ({nestedProducts.find(parent => parent.lots.includes(lot))?.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[8px] text-slate-500 text-left leading-tight font-mono leading-relaxed">
                      * 绑定配方批次后，网关活动的套接字物理流将以所设 Hz 刷新率<b>直接覆写下方表格选中行及相关公式</b>，触发动态实时收敛模型计算与数字重绘渲染。
                    </p>
                  </div>

                  {/* Control Button */}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setTelemetryActive(!telemetryActive);
                      addToast(
                        telemetryActive ? 'info' : 'success',
                        telemetryActive 
                          ? 'Closed active WebSocket session / 已断开物理或虚拟传感器网关' 
                          : 'Streaming real-time telemetry frames over socket pipeline / 传感器高速采样管道已上线，开始实时捕获传输！'
                      );
                    }}
                    className={`w-full font-mono font-bold py-2 px-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] uppercase tracking-wider ${
                      telemetryActive
                        ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30'
                        : 'bg-teal-600/20 text-teal-300 border border-teal-500/30 shadow-[0_0_10px_rgba(20,184,166,0.1)]'
                    }`}
                  >
                    {telemetryActive ? (
                      <>
                        <StopCircle size={12} className="text-rose-455" />
                        <span>断开物性遥测连接 Disconnect Sockets / Suspend Pipeline</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} className="text-teal-400 animate-pulse" />
                        <span>连接实验室仪表网关 Establish Sockets / Active Handshake</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Right Column: Dynamic Gauges and Logs Console */}
              <div className="lg:col-span-12 xl:col-span-7 flex flex-col space-y-2.5 h-full">
                
                {/* Visualizer gauges and stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Gauge 1: MFR */}
                  {(() => {
                    const isMfrAlert = liveMfrOutput < mfrWarningRange.min || liveMfrOutput > mfrWarningRange.max;
                    return (
                      <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
                        isMfrAlert 
                          ? 'bg-rose-950/40 border-rose-800 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse'
                          : 'bg-slate-950/60 border-slate-800/70'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[8.5px] font-mono font-black text-slate-500 uppercase tracking-widest leading-none">
                            实测熔指 MFR (γ)
                          </span>
                          {isMfrAlert && (
                            <span className="text-[7.5px] text-rose-450 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 animate-bounce">
                              ALERT 越界
                            </span>
                          )}
                        </div>
                        <div className={`text-base font-mono font-black my-1 truncate flex items-baseline gap-1 ${isMfrAlert ? 'text-rose-400' : 'text-teal-400'}`}>
                          <span>{liveMfrOutput.toFixed(3)}</span>
                          <span className="text-[8px] text-slate-500 font-normal">g/10m</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${isMfrAlert ? 'bg-rose-500' : 'bg-teal-500'}`} style={{ width: `${Math.max(0, Math.min(100, (liveMfrOutput / 15) * 100))}%` }} />
                        </div>

                        {/* Mini Sparkline Visualization */}
                        {historyMfr.length > 1 && (
                          <div className="h-6 w-full mt-2 opacity-80">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 24">
                              <defs>
                                <linearGradient id="mfr-spark-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="mfr-spark-grad-alert" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M ${historyMfr.map((val, idx) => {
                                  const x = (idx / (historyMfr.length - 1)) * 100;
                                  const y = 24 - ((val - historyMfrMin) / historyMfrDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')}`}
                                fill="none"
                                stroke={isMfrAlert ? '#f43f5e' : '#14b8a6'}
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d={`M 0,24 L ${historyMfr.map((val, idx) => {
                                  const x = (idx / (historyMfr.length - 1)) * 100;
                                  const y = 24 - ((val - historyMfrMin) / historyMfrDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')} L 100,24 Z`}
                                fill={isMfrAlert ? 'url(#mfr-spark-grad-alert)' : 'url(#mfr-spark-grad)'}
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Gauge 2: Density */}
                  {(() => {
                    const isDenAlert = liveDensityOutput < densityWarningRange.min || liveDensityOutput > densityWarningRange.max;
                    return (
                      <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
                        isDenAlert 
                          ? 'bg-rose-950/40 border-rose-800 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse'
                          : 'bg-slate-950/60 border-slate-800/70'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[8.5px] font-mono font-black text-slate-500 uppercase tracking-widest leading-none">
                            结晶密度 Density (ρ)
                          </span>
                          {isDenAlert && (
                            <span className="text-[7.5px] text-rose-450 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 animate-bounce">
                              ALERT 越界
                            </span>
                          )}
                        </div>
                        <div className={`text-base font-mono font-black my-1 truncate flex items-baseline gap-1 ${isDenAlert ? 'text-rose-400' : 'text-sky-400'}`}>
                          <span>{liveDensityOutput.toFixed(4)}</span>
                          <span className="text-[8px] text-slate-500 font-normal">g/cm³</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${isDenAlert ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${Math.max(0, Math.min(100, ((liveDensityOutput - 0.85) / 0.3) * 100))}%` }} />
                        </div>

                        {/* Mini Sparkline Visualization */}
                        {historyDensity.length > 1 && (
                          <div className="h-6 w-full mt-2 opacity-80">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 24">
                              <defs>
                                <linearGradient id="den-spark-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="den-spark-grad-alert" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M ${historyDensity.map((val, idx) => {
                                  const x = (idx / (historyDensity.length - 1)) * 100;
                                  const y = 24 - ((val - historyDenMin) / historyDenDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')}`}
                                fill="none"
                                stroke={isDenAlert ? '#f43f5e' : '#38bdf8'}
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d={`M 0,24 L ${historyDensity.map((val, idx) => {
                                  const x = (idx / (historyDensity.length - 1)) * 100;
                                  const y = 24 - ((val - historyDenMin) / historyDenDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')} L 100,24 Z`}
                                fill={isDenAlert ? 'url(#den-spark-grad-alert)' : 'url(#den-spark-grad)'}
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Gauge 3: Elastic Modulus */}
                  {(() => {
                    const isModAlert = liveModulusOutput < modulusWarningRange.min || liveModulusOutput > modulusWarningRange.max;
                    return (
                      <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
                        isModAlert 
                          ? 'bg-rose-950/40 border-rose-800 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse'
                          : 'bg-slate-950/60 border-slate-800/70'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[8.5px] font-mono font-black text-slate-500 uppercase tracking-widest leading-none">
                            杨氏弯曲模量 Modulus (E)
                          </span>
                          {isModAlert && (
                            <span className="text-[7.5px] text-rose-450 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 animate-bounce">
                              ALERT 越界
                            </span>
                          )}
                        </div>
                        <div className={`text-base font-mono font-black my-1 truncate flex items-baseline gap-1 ${isModAlert ? 'text-rose-450' : 'text-indigo-400'}`}>
                          <span>{liveModulusOutput}</span>
                          <span className="text-[8px] text-slate-500 font-normal">MPa</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${isModAlert ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(0, Math.min(100, (liveModulusOutput / 4500) * 100))}%` }} />
                        </div>

                        {/* Mini Sparkline Visualization */}
                        {historyModulus.length > 1 && (
                          <div className="h-6 w-full mt-2 opacity-80">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 24">
                              <defs>
                                <linearGradient id="mod-spark-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="mod-spark-grad-alert" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M ${historyModulus.map((val, idx) => {
                                  const x = (idx / (historyModulus.length - 1)) * 100;
                                  const y = 24 - ((val - historyModMin) / historyModDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')}`}
                                fill="none"
                                stroke={isModAlert ? '#f43f5e' : '#818cf8'}
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d={`M 0,24 L ${historyModulus.map((val, idx) => {
                                  const x = (idx / (historyModulus.length - 1)) * 100;
                                  const y = 24 - ((val - historyModMin) / historyModDen) * 18 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')} L 100,24 Z`}
                                fill={isModAlert ? 'url(#mod-spark-grad-alert)' : 'url(#mod-spark-grad)'}
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Gauge 4: Network status */}
                  <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3 flex flex-col justify-between shadow-md backdrop-blur-md">
                    <span className="text-[8.5px] font-mono font-black text-slate-500 uppercase tracking-widest leading-none">
                      通信状态 Net Stats / handshakes
                    </span>
                    <div className="grid grid-cols-2 gap-x-1.5 text-[9px] font-mono pt-1 text-slate-400 leading-tight">
                      <div className="truncate">播发 Tx: <span className="text-white font-bold">{txFrames}</span></div>
                      <div className="truncate">重入 Rx: <span className="text-white font-bold">{rxFrames}</span></div>
                      <div className="truncate">延迟 Ping: <span className="text-teal-400 font-bold">{pingTime !== null ? `${pingTime}ms` : '--'}</span></div>
                      <div className="truncate">流速 Rate: <span className="text-sky-400 font-bold">{dataRate}KB</span></div>
                    </div>
                  </div>
                </div>

                {/* Sockets Output Terminal */}
                <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl flex flex-col flex-1 h-[255px] shadow-lg backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.015] pointer-events-none text-teal-400 font-mono">
                    <Terminal size={150} />
                  </div>
                  
                  <div className="flex items-center justify-between border-b border-slate-900/80 px-4 py-2 uppercase text-[9.5px] font-mono bg-slate-950 shrink-0">
                    <span className="flex items-center gap-1.5 text-teal-400 font-bold font-black">
                      <Terminal size={12} className="text-teal-400 animate-pulse" /> Sockets Diagnostic Stream Logs 诊断反馈信息流
                    </span>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setTelemetryLogs([]);
                        addToast('info', 'Console logs cleared');
                      }}
                      className="text-[8px] text-slate-650 hover:text-slate-300 tracking-wider transition-colors uppercase font-bold"
                    >
                      {t('clearTerminal')}
                    </motion.button>
                  </div>

                  {/* Terminal text field */}
                  <div
                    ref={logContainerRef}
                    className="flex-1 bg-slate-950/90 font-mono text-[9px] text-slate-400 p-3.5 space-y-1.5 overflow-y-auto custom-scrollbar border-b border-slate-900 select-text"
                  >
                    {telemetryLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-1.5 italic text-center">
                        <Terminal size={22} className="text-slate-850" />
                        <span className="max-w-[280px] text-[8.5px] leading-relaxed uppercase tracking-wider">
                          {t('readyMessage')}
                        </span>
                      </div>
                    ) : (
                      telemetryLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`pl-2.5 border-l border-slate-900 break-all select-text font-mono ${
                            log.includes('🚨') || log.includes('⚠️') ? 'text-rose-450 bg-rose-500/[0.04] border-rose-500/40 font-bold' :
                            log.includes('🚀') ? 'text-emerald-400 font-bold bg-emerald-505/[0.03]' :
                            log.includes('🖥️') ? 'text-indigo-400 font-bold' :
                            log.includes('☄️') ? 'text-teal-400 font-semibold' :
                            log.includes('❌') ? 'text-rose-400 font-medium' :
                            log.includes('[VIRTUAL WS TX') || log.includes('[WS MESSAGE TRANSMITTED') ? 'text-slate-500' :
                            log.includes('[VIRTUAL WS RX') || log.includes('[WS MESSAGE RECEIVED') ? 'text-sky-305 bg-sky-500/[0.01]' :
                            'text-slate-450'
                          }`}
                        >
                          {log}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Command transmitter entry box */}
                  <div className="bg-slate-950 p-2 shrink-0 border-t border-slate-900 bg-[#070a13]/80">
                    <div className="flex bg-slate-900 p-1 border border-slate-800 rounded-lg shadow-inner gap-2 items-center">
                      <span className="text-[8.5px] font-mono text-slate-500 select-none pl-1.5 font-bold uppercase shrink-0">
                        Inbound Frame / 自定义收包:
                      </span>
                      <input
                        type="text"
                        value={customTermCommand}
                        onChange={(e) => setCustomTermCommand(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendCustomFrame();
                        }}
                        placeholder='e.g. {"data": {"mfr": 4.15, "density": 0.941, "modulus": 1850}}'
                        className="flex-1 bg-transparent text-[10px] font-mono text-indigo-300 focus:outline-none placeholder-slate-650"
                      />
                      
                      {/* Prepopulated Payload Fast Snippet Injectors */}
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setCustomTermCommand(
                            JSON.stringify({
                              data: {
                                mfr: parseFloat((Math.random() * 8 + 0.5).toFixed(2)),
                                density: parseFloat((Math.random() * 0.1 + 0.89).toFixed(4)),
                                modulus: Math.floor(Math.random() * 2000 + 800)
                              }
                            })
                          );
                        }}
                        className="text-[7.5px] bg-slate-850 hover:bg-slate-750 text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded border border-slate-700/80 transition-colors cursor-pointer shrink-0 font-bold uppercase"
                        title="Randomize payload template"
                      >
                        Random / 随机
                      </motion.button>

                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleSendCustomFrame}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] font-bold py-1 px-3 rounded inline-block shrink-0 shadow-sm transition-colors cursor-pointer uppercase"
                      >
                        Send Frame / 发送套接字
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: GEMINI MULTI-MODAL PROCESSOR */}
          {/* ======================================================== */}
          {activeTab === 'gemini' && (
            <motion.div
              key="gemini-tab"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.15 }}
              className={`grid grid-cols-1 lg:grid-cols-12 ${isCompact ? 'gap-2.5' : 'gap-4'}`}
            >
              {/* Scan Templates list */}
              <div className="lg:col-span-4 flex flex-col space-y-3">
                <div className={`bg-slate-950/60 border border-slate-800/70 rounded-xl shadow-lg ${
                  isCompact ? 'p-3 space-y-2.5' : 'p-4 space-y-3.5'
                }`}>
                  <h3 className="text-[11px] font-bold tracking-wider font-mono uppercase text-purple-400 flex items-center gap-1.5">
                    <Scan size={13} className="text-purple-400" />
                    Gemini Multimodal Spec Feed 机器视觉输入
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal leading-relaxed">
                    选择任一光谱图或检测报告模板。多模态大模型可即时解析分子曲线、峰值特征或手写试样记录，生成精确的物性结构化参数特征描述。 / Choose a spectroscopy template. The multimodal LLM parses the molecular curves or handwritten test books, generating structural specifications under zero shot logic.
                  </p>

                  <div className={`space-y-2 pt-1 overflow-y-auto custom-scrollbar ${isCompact ? 'max-h-[220px]' : 'max-h-[300px]'}`}>
                    {scanTemplates.map(tpl => (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        key={tpl.id}
                        onClick={() => handleScanTemplate(tpl)}
                        disabled={isScanning}
                        className={`w-full text-left flex items-start gap-2.5 transition-all active:scale-[0.99] border rounded-lg cursor-pointer ${
                          isCompact ? 'p-2' : 'p-3'
                        } ${
                          scanningImage === tpl.id
                            ? 'bg-gradient-to-br from-purple-950/20 to-slate-900 border-purple-500/70 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                            : 'bg-slate-950 border-slate-900 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-lg p-1.5 bg-slate-900 border border-slate-800 rounded shrink-0">
                          {tpl.thumb}
                        </span>
                        <div className="space-y-0.5">
                          <div className="text-[10.5px] font-mono font-bold text-slate-200">光谱图 / Sample Spec: {tpl.title}</div>
                          <div className="text-[8px] font-mono text-purple-400 bg-purple-500/5 px-1 py-0.5 rounded border border-purple-500/10 inline-block">目标材料 / Target Lot: {tpl.gradeName}</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scanning visual area & Extracted Struct Code */}
              <div className="lg:col-span-8 flex flex-col space-y-3">
                <div className={`bg-slate-950/60 border border-slate-800/70 rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 shadow-lg ${
                  isCompact ? 'h-[320px]' : 'h-[390px]'
                }`}>
                  
                  {/* Visually Scanning Stage */}
                  <div className="bg-slate-950 rounded-lg border border-slate-900 relative overflow-hidden flex flex-col items-center justify-center p-4 text-center">
                    {/* Viewfinder crosshairs */}
                    <div className="absolute top-2 left-2 border-t-2 border-l-2 border-slate-800 w-3 h-3 pointer-events-none" />
                    <div className="absolute top-2 right-2 border-t-2 border-r-2 border-slate-800 w-3 h-3 pointer-events-none" />
                    <div className="absolute bottom-2 left-2 border-b-2 border-l-2 border-slate-800 w-3 h-3 pointer-events-none" />
                    <div className="absolute bottom-2 right-2 border-b-2 border-r-2 border-slate-800 w-3 h-3 pointer-events-none" />

                    <AnimatePresence mode="wait">
                      {isScanning ? (
                        <motion.div
                          key="scanner"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full flex flex-col items-center justify-center relative"
                        >
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 opacity-25 animate-pulse relative flex items-center justify-center">
                            <Scan className="text-purple-400 w-8 h-8 animate-ping" />
                          </div>
                          
                          {/* Laser Beam scan effect */}
                          <motion.div
                            animate={{ y: [0, 110, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                            className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent pointer-events-none shadow-[0_0_8px_rgba(168,85,247,0.7)]"
                            style={{ top: '15%' }}
                          />
                          <div className="text-[8px] font-mono text-purple-400 mt-3.5 animate-pulse tracking-widest">
                            GEMINI 机器视觉光谱扫描中... / GEMINI SCAN SPECTROSCOPE ACTIVE...
                          </div>
                        </motion.div>
                      ) : scanResult ? (
                        <motion.div
                          key="scan-success"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-2 w-full h-full flex flex-col items-center justify-center"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm animate-bounce shrink-0">
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <div className="text-[11px] font-mono font-bold text-white uppercase">多模态特征提取完成 / Vision Extraction Unified</div>
                            <p className="text-[9px] text-slate-500 mt-0.5 font-mono">配对型号 / Matched: {scanResult.extractedGrade}</p>
                          </div>
                          <div className="bg-slate-900 border border-slate-800/80 p-2 rounded-lg w-full text-left font-mono text-[9px] space-y-0.5 text-slate-350">
                            <div>材料分类 Classification: <span className="text-indigo-400">{scanResult.extractedGrade}</span></div>
                            <div>微观结构 Structure: <span className="text-indigo-400">{scanResult.extractedFormula}</span></div>
                            <div>可信度 Certainty Level: <span className="text-emerald-400">{scanResult.matchCertainty} prob</span></div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="space-y-2 text-slate-600">
                          <FileSearch size={24} className="mx-auto text-slate-800 animate-pulse" />
                          <p className="text-[8px] font-mono leading-relaxed uppercase tracking-wider max-w-[160px] mx-auto">
                            请在左方提交光谱或检测文档模板以开启多模态人工智能分析。 / Submit a chemical spec document template on the left to activate Gemini Vision extraction.
                          </p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
 
                  {/* Extracted JSON Struct / Action Controls */}
                  <div className="flex flex-col h-full justify-between overflow-hidden">
                    <div className="flex flex-col min-h-0 flex-1">
                      <div className="text-[9px] font-mono font-bold text-slate-500 border-b border-slate-900 pb-1.5 mb-1.5 flex items-center justify-between uppercase shrink-0">
                        <span>提取得到的 JSON 数据负载 / Extracted JSON payload</span>
                        {scanResult && (
                          <span className="text-[7px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20 font-bold">
                            VALID COMPILED
                          </span>
                        )}
                      </div>
 
                      <div className="flex-1 bg-slate-950 rounded-lg border border-slate-900 p-2 font-mono text-[9px] text-indigo-300 overflow-y-auto leading-normal custom-scrollbar select-all">
                        {scanResult ? (
                          <pre className="text-emerald-400">
{`{
  "operation": "GEMINI_SPECTRUM_INVERSE",
  "result": {
    "gradeId": "${scanResult.extractedGrade.toLowerCase()}",
    "scientificName": "${scanResult.extractedGrade}",
    "formulationType": "${scanResult.extractedFormula}",
    "extractedProperties": {
      "Density": ${scanResult.extractedDensity},
      "MeltFlowRate": ${scanResult.extractedMfr},
      "FlexuralModulus": ${scanResult.extractedModulus}
    },
    "confidenceLevel": "${scanResult.matchCertainty}"
  }
}`}
                          </pre>
                        ) : (
                          <div className="text-slate-800 h-full flex items-center justify-center font-mono">
                            -- 等待绑定光谱数据进行推理提取 -- / -- WAITING FOR SPECTROSCOPY BINDING --
                          </div>
                        )}
                      </div>
                    </div>
 
                    {/* Bridge Action to grid */}
                    {scanResult && (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleInjectScannedLot}
                        className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-[9px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all cursor-pointer uppercase shrink-0"
                      >
                        <TableProperties size={10} />
                        <span>数据热注入下方评估矩阵 / Inject into Evaluation Formula Grid</span>
                      </motion.button>
                    )}
                  </div>
 
                </div>
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: TANSTACK GRID V5 FORMULA MATRIX EVALUATOR */}
          {/* ======================================================== */}
          {activeTab === 'grid' && (
            <motion.div
              key="grid-tab"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Formula and Description Card */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/70 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center shadow-lg">
                <div className="lg:col-span-4 space-y-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1 font-mono">
                    <Layers size={13} className="text-indigo-400" /> Nested Batch-Lots Grid Matrix 配方评估矩阵
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal leading-relaxed">
                    展开下方数据行即可查看各材料批次的流变测定历史。您可在上方输入栏中自定义数学关联公式并实时获得整张电子网格的单元格重算数据。 / Expand rows below to view chronological batch lot historical lists. Modify formula tags in the input bar and trigger live cell calculations.
                  </p>
                </div>

                <div className="lg:col-span-8">
                  <div className="flex bg-slate-950 p-1.5 rounded-lg border border-slate-900 gap-2 items-center shadow-inner">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase pb-0.5 shrink-0 pl-1.5">
                      Equation 自定义关联公式:
                    </span>
                    <input
                      type="text"
                      value={customFormulaExpr}
                      onChange={(e) => setCustomFormulaExpr(e.target.value)}
                      placeholder="e.g. [density] * 1200 + [modulus]"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-2 py-1 font-mono text-[10.5px] text-indigo-200 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <div className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-mono text-[8px] font-bold px-2 py-1 rounded inline-block shrink-0">
                      LIVE GRID ENGINE
                    </div>
                  </div>
                  {/* Variable click-injector system */}
                  <div className="flex flex-wrap items-center justify-between text-[8px] text-slate-500 font-mono mt-1 px-1 gap-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-slate-600">点击包含对应参数以快速计算: / Click to append:</span>
                      {[
                        { label: '[density]', val: ' [density]' },
                        { label: '[mfr]', val: ' [mfr]' },
                        { label: '[modulus]', val: ' [modulus]' },
                        { label: '[crystallinity]', val: ' [crystallinity]' }
                      ].map(item => (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          key={item.label}
                          onClick={() => {
                            setCustomFormulaExpr(prev => prev + item.val);
                            addToast('info', `Appended ${item.label} to equation`);
                          }}
                          className="bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/25 transition-colors cursor-pointer"
                        >
                          {item.label}
                        </motion.button>
                      ))}
                    </div>
                    <span>支持标准算术运算符 (`+`, `-`, `*`, `/`) / Supports arithmetic operators</span>
                  </div>
                </div>
              </div>

              {/* DATA QUALITY AUDIT CONTROL OVERLAY PANEL */}
              <div className="bg-slate-950/40 border border-slate-800/70 rounded-xl p-3 shadow-md backdrop-blur-md space-y-2.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-900">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/25">
                      <AlertTriangle size={14} className="text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-[10.5px] font-black uppercase text-slate-200 tracking-wider">数据品质智能审计中心 / Lab Data Quality Audit Center</h4>
                      <p className="text-[8.5px] text-slate-500">智能筛查缺失测值（Null / Empty）并且基于工艺规章（Warning ranges）实时侦测数据溢出野值。 / Scans for missing fields and out-of-range anomalies.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAuditModeActive(!isAuditModeActive)}
                      className={`px-2 py-1 rounded font-mono text-[8.5px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                        isAuditModeActive 
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${isAuditModeActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                      {isAuditModeActive ? '审计校验已激活 / Audit Display ACTIVE' : '激活质量审计 / Enable Quality Audit'}
                    </motion.button>
                    {isAuditModeActive && (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setHideNormalLots(!hideNormalLots)}
                        className={`px-2 py-1 rounded font-mono text-[8.5px] font-bold transition-all border cursor-pointer ${
                          hideNormalLots 
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/35' 
                            : 'bg-slate-900 text-slate-455 border-slate-800 hover:border-slate-750'
                        }`}
                      >
                        {hideNormalLots ? '🔍 仅看异常批次开启 / Anomalous Only' : '🔍 显示所有批次 / Show All'}
                      </motion.button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg flex flex-col justify-between">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">实测样本总量 / TOTAL SAMPLES</span>
                    <div className="text-sm font-black text-slate-200 leading-none pt-1">{auditStats.totalLots} <span className="text-[9px] text-slate-500 font-normal">批次 / lots</span></div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg flex flex-col justify-between">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">异常样本批次 / ANOMALOUS LOTS</span>
                    <div className="text-sm font-black text-rose-400 leading-none pt-1">{auditStats.anomalousLots} <span className="text-[9px] text-rose-500/50 font-normal">批次 / lots</span></div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg flex flex-col justify-between">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none font-bold text-amber-500">缺失单元格 / MISSING CELL VALUES</span>
                    <div className="text-sm font-black text-amber-400 leading-none pt-1">{auditStats.totalMissing} <span className="text-[9px] text-slate-500 font-normal">项 / empty</span></div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg flex flex-col justify-between">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">物理越界测样 / OUT OF RANGE CELL</span>
                    <div className="text-sm font-black text-orange-400 leading-none pt-1">{auditStats.totalOutOfRange} <span className="text-[9px] text-zinc-500 font-normal">项 / out-bounds</span></div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg flex flex-col justify-between col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">数据品质分 / INTEGRITY</span>
                      <span className={`text-[8px] font-bold px-1 rounded ${auditStats.qualityScore === 100 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'}`}>{auditStats.qualityScore}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1 rounded overflow-hidden mt-1.5 border border-slate-950">
                      <div 
                        className={`h-full rounded transition-all duration-300 ${
                          auditStats.qualityScore === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                          auditStats.qualityScore >= 80 ? 'bg-gradient-to-r from-amber-500 to-emerald-400' :
                          'bg-gradient-to-r from-rose-500 to-orange-400'
                        }`}
                        style={{ width: `${auditStats.qualityScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[8.5px] font-mono pt-1 text-slate-400 border-t border-slate-950">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">审计阀值指标 (Auditing Bounds):</span>
                    <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">MFR: {mfrWarningRange.min}-{mfrWarningRange.max} g/10m</span>
                    <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">Density: {densityWarningRange.min}-{densityWarningRange.max} g/cm³</span>
                    <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">Modulus: {modulusWarningRange.min}-{modulusWarningRange.max} MPa</span>
                    <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">Crystallinity: {crystallinityWarningRange.min}%-{crystallinityWarningRange.max}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5 sm:mt-0">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleInjectAnomalies}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-2 py-0.5 rounded text-[8px] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>⚡ 注入异常数据 / Inject Anomalies</span>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleAutoRepairMissing}
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[8px] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>🛠️ 自动填补缺失 / Fill Missing</span>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleClampOutliers}
                      className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded text-[8px] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>🛡️ 自动钳制越界 / Clamp Outliers</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Grid Matrix */}
              <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-[10px] text-left border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-950 text-slate-500 uppercase text-[9px] border-b border-slate-900">
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'} w-8`}></th>
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'}`}>聚物品类等级 / Polymer Classification / Lot Grade</th>
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'}`}>实测熔体流动速率 MFR (g/10m)</th>
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'}`}>标准晶体密度 Density ρ (g/cm³)</th>
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'}`}>杨氏弯曲模量 Elasticity Modulus (MPa)</th>
                        <th className={`${isCompact ? 'py-1 px-2.5' : 'py-2 px-3'}`}>相对结晶度 Crystallinity (χ%)</th>
                        <th className={`${isCompact ? 'py-1 px-2.5 text-indigo-400' : 'py-2 px-3 text-indigo-400'}`}>数据品质校验 / Quality Audit</th>
                        <th className={`${isCompact ? 'py-1 px-2.5 text-right text-indigo-400' : 'py-2 px-3 text-indigo-400 text-right'}`}>公式单元格计算值 / Computed Excel value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nestedProducts.map(parent => {
                        const isOpen = !!expandedParents[parent.id];
                        return (
                          <React.Fragment key={parent.id}>
                            {/* Parent Category Row */}
                            <tr
                              onClick={() => toggleParent(parent.id)}
                              className="border-b border-slate-900/60 hover:bg-slate-900/40 bg-slate-950/50 cursor-pointer select-none transition-all"
                            >
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'}`}>
                                {isOpen ? (
                                  <ChevronDown size={11} className="text-indigo-400 animate-pulse" />
                                ) : (
                                  <ChevronRight size={11} className="text-slate-600" />
                                )}
                              </td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} font-bold text-slate-200`}>
                                <div className="flex items-center gap-1.5">
                                  <span>{parent.name}</span>
                                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase font-bold text-[7.5px]">
                                    {parent.category}
                                  </span>
                                </div>
                              </td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} text-slate-600 italic`}>-- 均值聚合 aggregated --</td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} text-indigo-400/80 font-bold`}>-- {parent.baseDensity.toFixed(3)} --</td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} text-slate-600 italic`}>-- 宏观主样 macro --</td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} text-slate-600 italic`}>-- 级联测样 samples --</td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'} text-indigo-500/80 font-bold`}>
                                <span className="bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/40 text-[8.5px]">
                                  级联校验
                                </span>
                              </td>
                              <td className={`${isCompact ? 'py-1.5 px-2.5 text-right text-indigo-400' : 'py-2 px-3 text-right text-indigo-400/90'}`}>
                                <span className="bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 text-[8.5px]">
                                  已加载 {parent.lots.length} 个生产批次 / {parent.lots.length} lots loaded
                                </span>
                              </td>
                            </tr>

                            {/* Sub Child Rows */}
                            {isOpen && parent.lots
                              .map(lot => ({ lot, anomalies: getLotAnomalies(lot) }))
                              .filter(({ anomalies }) => !isAuditModeActive || !hideNormalLots || anomalies.length > 0)
                              .map(({ lot, anomalies }) => {
                                const matchesHighlight = highlightedLots[lot.id];

                                // MFR
                                const mfrAnoms = anomalies.filter(a => a.field === 'mfr');
                                const isMfrAnom = isAuditModeActive && mfrAnoms.length > 0;
                                const mfrAnomType = isMfrAnom ? mfrAnoms[0].type : null;

                                // Density
                                const densityAnoms = anomalies.filter(a => a.field === 'density');
                                const isDensityAnom = isAuditModeActive && densityAnoms.length > 0;
                                const densityAnomType = isDensityAnom ? densityAnoms[0].type : null;

                                // Modulus
                                const modulusAnoms = anomalies.filter(a => a.field === 'modulus');
                                const isModulusAnom = isAuditModeActive && modulusAnoms.length > 0;
                                const modulusAnomType = isModulusAnom ? modulusAnoms[0].type : null;

                                // Crystallinity
                                const crystallinityAnoms = anomalies.filter(a => a.field === 'crystallinity');
                                const isCrystallinityAnom = isAuditModeActive && crystallinityAnoms.length > 0;
                                const crystallinityAnomType = isCrystallinityAnom ? crystallinityAnoms[0].type : null;

                                return (
                                  <tr
                                    key={lot.id}
                                    className={`border-b border-slate-900 text-slate-350 transition-colors ${
                                      matchesHighlight 
                                        ? 'bg-teal-950/15' 
                                        : anomalies.length > 0 && isAuditModeActive
                                          ? 'bg-amber-950/5 hover:bg-amber-900/10'
                                          : 'bg-slate-950/40 hover:bg-slate-900/20'
                                    }`}
                                  >
                                    <td className={`${isCompact ? 'py-1 px-2.5 text-center' : 'py-1.5 px-3 text-center'}`}>
                                      <span className={`w-1.2 h-1.2 rounded-full inline-block transition-all ${
                                        isAuditModeActive && anomalies.length > 0
                                          ? 'bg-amber-500 scale-125 animate-ping'
                                          : matchesHighlight 
                                            ? 'bg-teal-400 scale-125 animate-ping' 
                                            : 'bg-indigo-500'
                                      }`} />
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5 pl-6 text-[10px] font-semibold text-slate-300' : 'py-1.5 px-3 pl-6 text-[10px] font-semibold text-slate-200'}`}>
                                      <div className="flex items-center gap-1">
                                        <span>{lot.name}</span>
                                        {isAuditModeActive && anomalies.length > 0 && (
                                          <span className="text-[7px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1 rounded animate-pulse">
                                            异常 Alert
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'}`}>
                                      <input
                                        type="number"
                                        step="0.05"
                                        value={lot.mfr ?? ''}
                                        onChange={(e) => handleUpdateLotProperty(parent.id, lot.id, 'mfr', e.target.value)}
                                        className={`bg-slate-900/95 border rounded px-1 w-14 text-[9.5px] text-slate-100 focus:outline-none focus:border-indigo-500 font-mono focus:ring-1 focus:ring-indigo-500/20 text-center ${isCompact ? 'py-0 h-5.5' : 'py-0.5 h-6.5'} transition-all duration-300 ${
                                          mfrAnomType === 'missing'
                                            ? 'border-dashed border-rose-500 bg-rose-950/20 text-rose-300 ring-2 ring-rose-500/40 animate-pulse'
                                            : mfrAnomType === 'out_of_range'
                                              ? 'border-orange-500 bg-orange-900/10 text-orange-300 ring-2 ring-orange-500/30'
                                              : matchesHighlight?.mfr 
                                                ? 'border-teal-400 bg-teal-950 text-teal-300 ring-2 ring-teal-400/50 scale-105 font-bold' 
                                                : 'border-slate-800'
                                        }`}
                                        title={isMfrAnom ? mfrAnoms[0].message : 'MFR (g/10m)'}
                                      />
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'}`}>
                                      <input
                                        type="number"
                                        step="0.001"
                                        value={lot.density ?? ''}
                                        onChange={(e) => handleUpdateLotProperty(parent.id, lot.id, 'density', e.target.value)}
                                        className={`bg-slate-900/95 border rounded px-1 w-18 text-[9.5px] text-slate-100 focus:outline-none focus:border-indigo-500 font-mono focus:ring-1 focus:ring-indigo-500/20 text-center ${isCompact ? 'py-0 h-5.5' : 'py-0.5 h-6.5'} transition-all duration-300 ${
                                          densityAnomType === 'missing'
                                            ? 'border-dashed border-rose-500 bg-rose-950/20 text-rose-300 ring-2 ring-rose-500/40 animate-pulse'
                                            : densityAnomType === 'out_of_range'
                                              ? 'border-orange-500 bg-orange-900/10 text-orange-300 ring-2 ring-orange-500/30'
                                              : matchesHighlight?.density 
                                                ? 'border-teal-400 bg-teal-950 text-teal-300 ring-2 ring-teal-400/50 scale-105 font-bold' 
                                                : 'border-slate-800'
                                        }`}
                                        title={isDensityAnom ? densityAnoms[0].message : 'Density (g/cm³)'}
                                      />
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'}`}>
                                      <input
                                        type="number"
                                        step="10"
                                        value={lot.modulus ?? ''}
                                        onChange={(e) => handleUpdateLotProperty(parent.id, lot.id, 'modulus', e.target.value)}
                                        className={`bg-slate-900/95 border rounded px-1 w-18 text-[9.5px] text-slate-100 focus:outline-none focus:border-indigo-500 font-mono focus:ring-1 focus:ring-indigo-500/20 text-center ${isCompact ? 'py-0 h-5.5' : 'py-0.5 h-6.5'} transition-all duration-300 ${
                                          modulusAnomType === 'missing'
                                            ? 'border-dashed border-rose-500 bg-rose-950/20 text-rose-300 ring-2 ring-rose-500/40 animate-pulse'
                                            : modulusAnomType === 'out_of_range'
                                              ? 'border-orange-500 bg-orange-900/10 text-orange-300 ring-2 ring-orange-500/30'
                                              : matchesHighlight?.modulus 
                                                ? 'border-teal-400 bg-teal-950 text-teal-300 ring-2 ring-teal-400/50 scale-105 font-bold' 
                                                : 'border-slate-800'
                                        }`}
                                        title={isModulusAnom ? modulusAnoms[0].message : 'Young Modulus (MPa)'}
                                      />
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'}`}>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={lot.crystallinity ?? ''}
                                        onChange={(e) => handleUpdateLotProperty(parent.id, lot.id, 'crystallinity', e.target.value)}
                                        className={`bg-slate-900/95 border rounded px-1 w-14 text-[9.5px] text-slate-100 focus:outline-none focus:border-indigo-500 font-mono focus:ring-1 focus:ring-indigo-500/20 text-center ${isCompact ? 'py-0 h-5.5' : 'py-0.5 h-6.5'} transition-all duration-300 ${
                                          crystallinityAnomType === 'missing'
                                            ? 'border-dashed border-rose-500 bg-rose-950/20 text-rose-300 ring-2 ring-rose-500/40 animate-pulse'
                                            : crystallinityAnomType === 'out_of_range'
                                              ? 'border-orange-500 bg-orange-900/10 text-orange-300 ring-2 ring-orange-500/30'
                                              : 'border-slate-800'
                                        }`}
                                        title={isCrystallinityAnom ? crystallinityAnoms[0].message : 'Crystallinity (χ%)'}
                                      />
                                    </td>
                                    <td className={`${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'}`}>
                                      {isAuditModeActive ? (
                                        (() => {
                                          if (anomalies.length === 0) {
                                            return (
                                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                                已校验 Pass
                                              </span>
                                            );
                                          }
                                          return (
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                              {anomalies.map((anom, idx) => (
                                                <span 
                                                  key={idx} 
                                                  title={anom.message}
                                                  className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border transition-all ${
                                                    anom.type === 'missing'
                                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse'
                                                      : 'bg-orange-500/10 text-orange-400 border-orange-500/25'
                                                  }`}
                                                >
                                                  {anom.field.toUpperCase()}:{anom.type === 'missing' ? '缺失' : '偏离'}
                                                </span>
                                              ))}
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-slate-650 text-[8px] italic select-none">-- 未开启审计 --</span>
                                      )}
                                    </td>
                                    <td className={`text-right font-bold bg-emerald-500/[0.015] ${isCompact ? 'py-1 px-2.5 text-emerald-400' : 'py-1.5 px-3 text-emerald-400'}`}>
                                      <ComputedCell lot={lot} formula={customFormulaExpr} />
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* FOOTER METRICS SYSTEM */}
      <div className="border-t border-slate-800/60 pt-2.5 flex items-center justify-between text-[9px] font-mono text-slate-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{t("telemetryGateway")} (Future Workspace Engine v3.1.0)</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span>{t("wasmStack")}</span>
          <span>{t("websocketBus")}</span>
        </div>
      </div>

    </div>
  );
};

// v3.1.0-sync
