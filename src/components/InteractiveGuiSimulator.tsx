import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Terminal,
  Sliders,
  CheckCircle2,
  Layers,
  MessageSquare,
  X
} from 'lucide-react';
import {
  ParsedGuiApplication,
  GUI_MODULES_REGISTRY,
  GuiLibraryModuleSpec,
  GuiDialogMessage
} from '../utils/guiRuntimeEngine';
import { SourceLanguage, LANGUAGE_LABELS } from '../utils/multiPlatformBuilder';

export interface GuiRuntimeStatePayload {
  values: Record<string, string | number | boolean>;
  triggerWidgetId?: string;
  triggerLabel?: string;
  canvasClick?: { x: number; y: number };
}

interface InteractiveGuiSimulatorProps {
  language: SourceLanguage;
  fileName: string;
  guiSpec: ParsedGuiApplication;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  isRunning?: boolean;
  onLoadGuiModuleSnippet: (mod: GuiLibraryModuleSpec) => void;
  onTriggerRunCode: (guiState?: GuiRuntimeStatePayload) => void;
}

export const InteractiveGuiSimulator: React.FC<InteractiveGuiSimulatorProps> = ({
  language,
  fileName,
  guiSpec,
  stdout,
  stderr,
  exitCode,
  durationMs,
  isRunning = false,
  onLoadGuiModuleSnippet,
  onTriggerRunCode
}) => {
  const [widgetValues, setWidgetValues] = useState<Record<string, string | number | boolean>>({});
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [lastActionBanner, setLastActionBanner] = useState<string | null>(null);
  const [activeDialogs, setActiveDialogs] = useState<GuiDialogMessage[]>([]);
  const [showConsoleBelow, setShowConsoleBelow] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasWaveFreq, setCanvasWaveFreq] = useState<number>(65);
  const [canvasPulseCount, setCanvasPulseCount] = useState<number>(0);

  // Sync widget values and dialogs whenever a new guiSpec arrives from Python 3 or code analyzer
  useEffect(() => {
    setWidgetValues((prev) => {
      const next: Record<string, string | number | boolean> = { ...prev };
      for (const w of guiSpec.widgets) {
        const incomingVal = w.value !== undefined ? w.value : w.defaultValue;
        if (incomingVal !== undefined) {
          next[w.id] = incomingVal;
        } else if (next[w.id] === undefined) {
          if (w.type === 'input') next[w.id] = '';
          else if (w.type === 'slider') next[w.id] = 65;
          else if (w.type === 'switch') next[w.id] = true;
          else if (w.type === 'progress') next[w.id] = 75;
          else if (w.type === 'select') next[w.id] = w.options?.[0] || '';
        }
        if (w.type === 'slider' && typeof next[w.id] === 'number') {
          setCanvasWaveFreq(Number(next[w.id]));
        }
      }
      return next;
    });

    if (guiSpec.dialogs && guiSpec.dialogs.length > 0) {
      setActiveDialogs(guiSpec.dialogs);
    }
  }, [guiSpec]);

  // Reset event log when switching files
  useEffect(() => {
    setEventLog([
      `[${new Date().toLocaleTimeString()}] Initialized ${guiSpec.detectedFrameworkName} (${fileName})`
    ]);
    setLastActionBanner(null);
    setActiveDialogs(guiSpec.dialogs || []);
  }, [fileName]);

  // Render real Python canvas draw commands (Tkinter Canvas, Pygame Surface, Python Turtle) OR 60fps interactive surface
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cmds = guiSpec.canvasCommands || [];

    if (cmds.length > 0) {
      // Render real vector/raster commands captured from Python (Tkinter Canvas, Pygame, or Turtle)
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, w, h);

      for (const cmd of cmds) {
        if (cmd.op === 'clear') {
          ctx.fillStyle = cmd.color || '#070B14';
          ctx.fillRect(0, 0, w, h);
        } else if (cmd.op === 'rect') {
          const rx = cmd.x ?? 0;
          const ry = cmd.y ?? 0;
          const rw = cmd.w ?? 20;
          const rh = cmd.h ?? 20;
          if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fillRect(rx, ry, rw, rh);
          }
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.width ?? 1.5;
            ctx.strokeRect(rx, ry, rw, rh);
          }
        } else if (cmd.op === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(
            cmd.cx ?? w / 2,
            cmd.cy ?? h / 2,
            Math.max(1, cmd.rx ?? 15),
            Math.max(1, cmd.ry ?? 15),
            0,
            0,
            Math.PI * 2
          );
          if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fill();
          }
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.width ?? 1.5;
            ctx.stroke();
          }
        } else if (cmd.op === 'line' && cmd.points && cmd.points.length >= 4) {
          ctx.beginPath();
          ctx.strokeStyle = cmd.color || '#10B981';
          ctx.lineWidth = cmd.width ?? 2;
          ctx.moveTo(cmd.points[0], cmd.points[1]);
          for (let i = 2; i < cmd.points.length; i += 2) {
            ctx.lineTo(cmd.points[i], cmd.points[i + 1]);
          }
          ctx.stroke();
        } else if (cmd.op === 'polygon' && cmd.points && cmd.points.length >= 6) {
          ctx.beginPath();
          ctx.moveTo(cmd.points[0], cmd.points[1]);
          for (let i = 2; i < cmd.points.length; i += 2) {
            ctx.lineTo(cmd.points[i], cmd.points[i + 1]);
          }
          ctx.closePath();
          if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fill();
          }
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.width ?? 1.5;
            ctx.stroke();
          }
        } else if (cmd.op === 'text' && cmd.text) {
          ctx.fillStyle = cmd.color || '#F8FAFC';
          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.fillText(cmd.text, cmd.x ?? 16, cmd.y ?? 24);
        }
      }
      return;
    }

    // Otherwise run 60fps interactive hardware canvas loop
    let animId = 0;
    let phase = 0;

    const renderFrame = () => {
      phase += 0.04 + canvasWaveFreq * 0.0012;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y =
          h / 2 +
          Math.sin(x * (0.02 + canvasWaveFreq * 0.0005) + phase) * (28 + (canvasWaveFreq % 25)) +
          Math.cos(x * 0.015 - phase * 0.7) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.cos(x * 0.03 - phase * 1.3) * (18 + (canvasPulseCount % 4) * 5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#A7F3D0';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(
        `60.0 FPS | Freq Parameter: ${canvasWaveFreq}% | Pulses: ${canvasPulseCount}`,
        12,
        20
      );

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [canvasWaveFreq, canvasPulseCount, guiSpec]);

  const appendLog = (msg: string) => {
    const stamp = new Date().toLocaleTimeString();
    setEventLog((prev) => [`[${stamp}] ${msg}`, ...prev.slice(0, 24)]);
    setLastActionBanner(msg);
  };

  const handleButtonClick = (widgetId: string, btnLabel: string) => {
    setCanvasPulseCount((c) => c + 1);
    appendLog(`Executing ${guiSpec.detectedFrameworkName} callback for "${btnLabel}"...`);
    onTriggerRunCode({
      values: widgetValues,
      triggerWidgetId: widgetId,
      triggerLabel: btnLabel
    });
  };

  const availableModulesForLang = GUI_MODULES_REGISTRY.filter((m) => m.language === language);

  return (
    <div className="flex flex-col h-[680px] bg-slate-100 overflow-hidden">
      {/* Top GUI Module & Library Selector Bar */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">
              {LANGUAGE_LABELS[language].badge} Real GUI Modules &amp; Libraries (
              {availableModulesForLang.length}):
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTriggerRunCode({ values: widgetValues })}
              disabled={isRunning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              {isRunning ? 'Executing...' : 'Re-Run GUI Script'}
            </button>
            <button
              type="button"
              onClick={() => setShowConsoleBelow((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              {showConsoleBelow ? 'Hide Console' : 'Show Console'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {availableModulesForLang.map((mod) => {
            const isDetected = guiSpec.detectedFrameworkId === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onLoadGuiModuleSnippet(mod)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                  isDetected
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title={mod.description}
              >
                {mod.name.split('(')[0].trim()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Native GUI Window Area */}
      <div className="flex-1 p-5 overflow-y-auto flex flex-col items-center justify-start gap-4">
        <div
          className={`w-full max-w-[600px] rounded-2xl border shadow-md overflow-hidden transition-colors ${
            guiSpec.darkMode
              ? 'bg-slate-900 text-slate-100 border-slate-700'
              : 'bg-white text-slate-900 border-slate-300'
          }`}
        >
          {/* OS / Framework Window Title Bar */}
          <div
            style={{
              backgroundColor: guiSpec.darkMode ? '#0F172A' : guiSpec.accentColor
            }}
            className="px-4 py-3 text-white flex items-center justify-between gap-3 border-b border-white/10"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              </div>
              <span className="text-xs font-bold truncate">{guiSpec.windowTitle}</span>
            </div>
            <span className="text-[10px] font-mono text-white/85 shrink-0">
              {guiSpec.detectedFrameworkName}
            </span>
          </div>

          {/* Live Interactive GUI Widgets Body */}
          <div className="p-5 space-y-4">
            {/* Native Messagebox / Dialog Popups triggered by Python callback */}
            {activeDialogs.length > 0 && (
              <div className="space-y-2">
                {activeDialogs.map((dlg, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-emerald-950 text-emerald-100 border border-emerald-700 flex items-start justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 text-xs">
                        <div className="font-bold text-white">{dlg.title}</div>
                        <div className="text-emerald-200 whitespace-pre-line font-mono text-[11px]">
                          {dlg.message}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDialogs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-emerald-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {lastActionBanner && (
              <div className="px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono text-emerald-600 dark:text-emerald-300 flex items-center justify-between gap-2">
                <span className="truncate">{lastActionBanner}</span>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              </div>
            )}

            {guiSpec.widgets.map((w) => {
              if (w.type === 'header') {
                return (
                  <div key={w.id} className="pb-2 border-b border-slate-200/30">
                    <h3 className="text-base font-bold tracking-tight">{w.label}</h3>
                  </div>
                );
              }

              if (w.type === 'label') {
                return (
                  <div
                    key={w.id}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                      guiSpec.darkMode
                        ? 'bg-slate-800/80 text-emerald-300 border border-slate-700'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {w.label}
                  </div>
                );
              }

              if (w.type === 'input') {
                const val = String(widgetValues[w.id] ?? w.value ?? w.defaultValue ?? '');
                return (
                  <div key={w.id} className="space-y-1">
                    <label className="block text-[11px] font-mono opacity-75">
                      {w.label}
                    </label>
                    <input
                      type="text"
                      value={val}
                      placeholder={w.placeholder || ''}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setWidgetValues((prev) => ({ ...prev, [w.id]: nextVal }));
                        appendLog(`Input "${w.label}" = "${nextVal}"`);
                      }}
                      className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none ${
                        guiSpec.darkMode
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-400'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-900'
                      }`}
                    />
                  </div>
                );
              }

              if (w.type === 'select') {
                const options = w.options && w.options.length > 0 ? w.options : ['Default Option'];
                const val = String(widgetValues[w.id] ?? w.value ?? w.defaultValue ?? options[0]);
                return (
                  <div key={w.id} className="space-y-1">
                    <label className="block text-[11px] font-mono opacity-75">
                      {w.label}
                    </label>
                    <select
                      value={val}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setWidgetValues((prev) => ({ ...prev, [w.id]: nextVal }));
                        appendLog(`Selected "${nextVal}"`);
                      }}
                      className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none ${
                        guiSpec.darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (w.type === 'slider') {
                const currentVal = Number(widgetValues[w.id] ?? w.value ?? w.defaultValue ?? 65);
                return (
                  <div key={w.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                        {w.label}
                      </span>
                      <span className="font-mono font-bold tabular-nums">{currentVal}</span>
                    </div>
                    <input
                      type="range"
                      min={w.min ?? 0}
                      max={w.max ?? 100}
                      value={currentVal}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setWidgetValues((prev) => ({ ...prev, [w.id]: val }));
                        setCanvasWaveFreq(val);
                        appendLog(`Slider "${w.label}" set to ${val}`);
                      }}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                );
              }

              if (w.type === 'switch') {
                const checked = Boolean(widgetValues[w.id] ?? w.value ?? w.defaultValue ?? true);
                return (
                  <label
                    key={w.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                      guiSpec.darkMode
                        ? 'bg-slate-800/60 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="text-xs font-medium">{w.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setWidgetValues((prev) => ({ ...prev, [w.id]: next }));
                        appendLog(
                          `Toggle "${w.label}" -> ${next ? 'ENABLED' : 'DISABLED'}`
                        );
                      }}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                );
              }

              if (w.type === 'progress') {
                const pct = Math.min(
                  100,
                  Math.max(0, Number(widgetValues[w.id] ?? w.value ?? w.defaultValue ?? 80))
                );
                return (
                  <div key={w.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono opacity-80">
                      <span>{w.label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className={`w-full h-2.5 rounded-full overflow-hidden ${
                        guiSpec.darkMode ? 'bg-slate-800' : 'bg-slate-200'
                      }`}
                    >
                      <div
                        className="h-full bg-emerald-500 transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }

              if (w.type === 'table' && w.tableHeaders) {
                return (
                  <div
                    key={w.id}
                    className="rounded-lg border border-slate-700 overflow-hidden text-xs font-mono"
                  >
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-slate-200">
                          {w.tableHeaders.map((th, i) => (
                            <th key={i} className="px-3 py-1.5 border-b border-slate-700">
                              {th}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(w.tableRows || []).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-800/50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              if (w.type === 'canvas') {
                return (
                  <div key={w.id} className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-mono opacity-75">{w.label}</div>
                    <canvas
                      ref={canvasRef}
                      width={guiSpec.canvasWidth || 500}
                      height={guiSpec.canvasHeight || 220}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        setCanvasPulseCount((c) => c + 1);
                        appendLog(`Canvas surface clicked at (${x}, ${y})`);
                        onTriggerRunCode({
                          values: widgetValues,
                          canvasClick: { x, y }
                        });
                      }}
                      className="w-full rounded-lg border border-slate-700 cursor-crosshair bg-[#070B14]"
                    />
                  </div>
                );
              }

              if (w.type === 'button') {
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleButtonClick(w.id, w.label)}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {w.label}
                  </button>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>

      {/* Companion Live Event & Stdout Console */}
      {showConsoleBelow && (
        <div className="h-44 bg-slate-950 text-slate-100 border-t border-slate-800 p-3.5 font-mono text-xs flex flex-col shrink-0">
          <div className="pb-2 mb-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
            <span>
              {guiSpec.detectedFrameworkName} Live Python / Native Event Loop &amp; Stdout (
              {fileName})
            </span>
            <span>
              Exit Code: {exitCode ?? 0}
              {durationMs !== null ? ` · ${durationMs} ms` : ''}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px] leading-relaxed">
            {stdout && (
              <pre className="text-emerald-300 whitespace-pre-wrap">{stdout}</pre>
            )}
            {stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap">{stderr}</pre>
            )}
            {eventLog.map((entry, idx) => (
              <div key={idx} className="text-cyan-300/90">
                {entry}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
