import React, { useState } from 'react';
import { useBrewStore } from '../store/brewStore';
import { 
  FileText, 
  Download, 
  Copy, 
  Check, 
  X,
  FileSpreadsheet,
  Code2,
  Table,
  CheckCircle2,
  Calendar,
  Clock,
  Timer
} from 'lucide-react';
import {
  generateTelemetryJson,
  generateCsvReport,
  generateMarkdownReport,
  formatHourMinSec,
  formatDurationOnly,
  formatSecVariance,
  type TelemetryExportOptions
} from '../utils/telemetryExport';

interface SessionAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionAuditReportModal: React.FC<SessionAuditReportModalProps> = ({ isOpen, onClose }) => {
  const { 
    recipe, 
    stages, 
    measurements, 
    auditLogs, 
    sessionStartTime, 
    sessionEndTime, 
    finishedAt,
    strikeOffset 
  } = useBrewStore();

  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');
  const [copiedType, setCopiedType] = useState<'none' | 'md' | 'json'>('none');

  if (!isOpen) return null;

  const exportOptions: TelemetryExportOptions = {
    recipe,
    stages,
    measurements,
    auditLogs,
    sessionStartTime,
    sessionEndTime,
    finishedAt,
    strikeOffset
  };

  const dateStr = sessionStartTime ? new Date(sessionStartTime).toLocaleDateString() : 'Today';
  const sumStageDurationSec = stages.reduce((acc, s) => acc + (s.actualDurationSec || 0), 0);
  const lengthOfBrewDayFormatted = formatHourMinSec(sumStageDurationSec);
  const isComplete = finishedAt !== null || (stages.length > 0 && stages[stages.length - 1].status === 'completed');

  const getFileBasename = () => {
    const recipeSlug = (recipe?.name || 'BrewSession').replace(/[^a-zA-Z0-9]/g, '_');
    const dateSlug = sessionStartTime
      ? new Date(sessionStartTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    return `${recipeSlug}_${dateSlug}`;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (type: 'md' | 'json') => {
    const text = type === 'json' ? generateTelemetryJson(exportOptions) : generateMarkdownReport(exportOptions);
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType('none'), 2000);
  };

  const handleDownloadTelemetryJson = () => {
    downloadFile(generateTelemetryJson(exportOptions), `${getFileBasename()}_telemetry.json`, 'application/json;charset=utf-8');
  };

  const handleDownloadCsv = () => {
    downloadFile(generateCsvReport(exportOptions), `${getFileBasename()}_session_log.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadMarkdown = () => {
    downloadFile(generateMarkdownReport(exportOptions), `${getFileBasename()}_BrewLog.md`, 'text/markdown;charset=utf-8');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-[0_0_40px_rgba(15,23,42,0.9)] rounded-2xl p-3 sm:p-5 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-white font-mono uppercase tracking-wider leading-tight">
                  Session Audit & Telemetry Export
                </h3>
                {isComplete && (
                  <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>COMPLETE</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {recipe?.name} • {recipe?.batchSize}L • {dateStr} • Brew Day: {lengthOfBrewDayFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                  activeTab === 'summary'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Audit</span>
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                  activeTab === 'json'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Telemetry JSON</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 min-h-0">
          {activeTab === 'summary' ? (
            <>
              {/* Timing Delta Summary Table */}
              <div>
                <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Phase Timing Deltas (Planned vs Actual)
                </span>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-gray-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Stage</th>
                        <th className="py-2 px-2">Started</th>
                        <th className="py-2 px-2">Completed</th>
                        <th className="py-2 px-2">Planned</th>
                        <th className="py-2 px-2">Actual</th>
                        <th className="py-2 px-2">Delta</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-gray-200">
                      {stages.map((s) => {
                        const deltaSec = s.actualDurationSec - s.plannedDurationSec;
                        const isLonger = deltaSec > 60;
                        const isShorter = deltaSec < -60;

                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-sans font-semibold text-gray-100">{s.title}</td>
                            <td className="py-2 px-2 text-slate-400">
                              {s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '--'}
                            </td>
                            <td className="py-2 px-2 text-slate-400">
                              {s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : (s.status === 'completed' ? 'Done' : '--')}
                            </td>
                            <td className="py-2 px-2 text-gray-400">
                              {s.timerType === 'stopwatch' ? 'Stopwatch' : s.isTimed ? formatDurationOnly(s.plannedDurationSec) : 'Checklist'}
                            </td>
                            <td className="py-2 px-2 font-bold text-white">
                              {formatDurationOnly(s.actualDurationSec)}
                            </td>
                            <td className="py-2 px-2">
                              {s.timerType === 'stopwatch' ? (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-800/50">
                                  ⏱️ Recorded
                                </span>
                              ) : s.isTimed ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                    isLonger
                                      ? 'bg-amber-950/70 text-amber-400'
                                      : isShorter
                                      ? 'bg-blue-950/70 text-blue-400'
                                      : 'bg-emerald-950/70 text-emerald-400'
                                  }`}
                                >
                                  {deltaSec === 0 ? '±0s' : formatSecVariance(deltaSec)}
                                </span>
                              ) : (
                                <span className="text-gray-500">--</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  s.status === 'completed'
                                    ? 'bg-emerald-950 text-emerald-400'
                                    : s.status === 'active'
                                    ? 'bg-amber-950 text-amber-400 animate-pulse'
                                    : 'bg-slate-800 text-gray-500'
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Logged Measurements Summary Cards */}
              <div>
                <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Batch Session Metrics & Timings Recorded
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 block font-mono">Session Date</span>
                      <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono truncate block">
                        {dateStr}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <Timer className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 block font-mono">Length of Brew Day</span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono truncate block">
                        {lengthOfBrewDayFormatted}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 block font-mono">Strike Temp</span>
                      <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono truncate block">
                        {measurements.strikeTempActual !== undefined ? `${measurements.strikeTempActual}°C` : '--'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 block font-mono">Mash In Temp</span>
                      <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono truncate block">
                        {measurements.mashInTempActual !== undefined ? `${measurements.mashInTempActual}°C` : '--'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-gray-400 block font-mono">Mash pH</span>
                    <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono">
                      {measurements.mashPhActual !== undefined ? `${measurements.mashPhActual}` : '--'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-gray-400 block font-mono">Pre-Boil SG</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                      {measurements.preBoilGravityActual !== undefined ? `${measurements.preBoilGravityActual} SG` : '--'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-gray-400 block font-mono">Post-Boil SG</span>
                    <span className="text-xs sm:text-sm font-bold text-purple-400 font-mono">
                      {measurements.postBoilGravityActual !== undefined ? `${measurements.postBoilGravityActual} SG` : '--'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-gray-400 block font-mono">Lauter Time</span>
                    <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono">
                      {stages.find(s => s.id === 'LAUTER_SPARGE')?.actualDurationSec
                        ? formatDurationOnly(stages.find(s => s.id === 'LAUTER_SPARGE')!.actualDurationSec)
                        : '--'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-gray-400 block font-mono">Chill Time (60°C)</span>
                    <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono">
                      {stages.find(s => s.id === 'COOLING_RECIRC')?.actualDurationSec
                        ? formatDurationOnly(stages.find(s => s.id === 'COOLING_RECIRC')!.actualDurationSec)
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Telemetry JSON View
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                <span>Structured JSON ready for external tooling import:</span>
                <button
                  onClick={() => handleCopy('json')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 flex items-center space-x-1 font-bold"
                >
                  {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'json' ? 'Copied JSON!' : 'Copy Raw JSON'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-[48vh] leading-relaxed select-all">
                {generateTelemetryJson(exportOptions)}
              </pre>
            </div>
          )}
        </div>

        {/* Action Footer (Responsive Multi-Format Export) */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Quick Copy Pill Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCopy('json')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-800/50 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
              title="Copy telemetry JSON to clipboard"
            >
              {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" /> : <Code2 className="w-3.5 h-3.5" />}
              <span>{copiedType === 'json' ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={() => handleCopy('md')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
              title="Copy markdown report to clipboard"
            >
              {copiedType === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedType === 'md' ? 'Copied MD!' : 'Copy Markdown'}</span>
            </button>
          </div>

          {/* Download Buttons */}
          <div className="flex items-center space-x-2">
            {/* Download CSV */}
            <button
              onClick={handleDownloadCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-800/50 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
              title="Download CSV report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download CSV</span>
            </button>

            {/* Download Markdown */}
            <button
              onClick={handleDownloadMarkdown}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
              title="Download Markdown log file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.MD Log</span>
            </button>

            {/* Primary Action: Download Telemetry JSON */}
            <button
              onClick={handleDownloadTelemetryJson}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] touch-press"
              title="Download structured JSON telemetry file"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download Telemetry JSON</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
