import React from 'react';
import { useBrewStore } from '../store/brewStore';

// Recorded telemetry summary and live activity timeline (Session Log tab, and the menu's Session Log sheet)
export const SessionLogPanel: React.FC = () => {
  const stages = useBrewStore(state => state.stages);
  const measurements = useBrewStore(state => state.measurements);
  const auditLogs = useBrewStore(state => state.auditLogs);
  const recipe = useBrewStore(state => state.recipe);

  const lauterStage = stages.find(s => s.id === 'LAUTER_SPARGE');
  const coolingStage = stages.find(s => s.id === 'CHILL');
  const knockoutStage = stages.find(s => s.id === 'KNOCKOUT_TRANSFER');

  return (
    <div className="space-y-2">
      {/* Summary Bar of Recorded Telemetry */}
      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 shrink-0">
        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase block mb-1">
          Recorded Telemetry Summary
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Strike Temp</span>
            <span className="text-amber-400 font-bold">
              {measurements.strikeTempActual !== undefined
                ? `${measurements.strikeTempActual.toFixed(1)}°C`
                : `${(stages.find(s => s.id === 'WATER_PREP')?.parameters.targetTemp ?? 71.5).toFixed(1)}°C (target)`}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Mash In Temp</span>
            <span className="text-amber-400 font-bold">
              {measurements.mashInTempActual !== undefined
                ? `${measurements.mashInTempActual.toFixed(1)}°C`
                : `${(recipe?.mash?.steps?.[0]?.stepTemp ?? 65).toFixed(1)}°C (target)`}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Mash pH</span>
            <span className="text-cyan-400 font-bold">
              {measurements.mashPhActual !== undefined ? `${measurements.mashPhActual.toFixed(2)}` : '5.25 (target)'}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Pre-Boil SG</span>
            <span className="text-emerald-400 font-bold">
              {measurements.preBoilGravityActual !== undefined
                ? `${measurements.preBoilGravityActual.toFixed(3)}`
                : `${recipe?.preBoilGravity ? recipe.preBoilGravity.toFixed(3) : '1.039'} (target)`}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">OG</span>
            <span className="text-purple-400 font-bold">
              {measurements.postBoilGravityActual !== undefined
                ? `${measurements.postBoilGravityActual.toFixed(3)}`
                : `${recipe?.og ? recipe.og.toFixed(3) : '1.045'} (target)`}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Exit Temp</span>
            <span className="text-amber-400 font-bold">
              {measurements.knockoutTempActual !== undefined
                ? `${measurements.knockoutTempActual.toFixed(1)}°C`
                : `${(recipe?.primaryTemp ?? 19).toFixed(1)}°C (target)`}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Sparge Time</span>
            <span className={lauterStage?.actualDurationSec !== undefined && lauterStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
              {lauterStage?.actualDurationSec !== undefined && lauterStage.actualDurationSec > 0
                ? `⏱️ ${Math.floor(lauterStage.actualDurationSec / 60)}m ${(lauterStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Chill Time (60°C)</span>
            <span className={coolingStage?.actualDurationSec !== undefined && coolingStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
              {coolingStage?.actualDurationSec !== undefined && coolingStage.actualDurationSec > 0
                ? `⏱️ ${Math.floor(coolingStage.actualDurationSec / 60)}m ${(coolingStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-gray-400">Knockout Time</span>
            <span className={knockoutStage?.actualDurationSec !== undefined && knockoutStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
              {knockoutStage?.actualDurationSec !== undefined && knockoutStage.actualDurationSec > 0
                ? `⏱️ ${Math.floor(knockoutStage.actualDurationSec / 60)}m ${(knockoutStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Activity Timeline */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase block px-1">
          Live Session Timeline ({auditLogs.length} events)
        </span>
        {auditLogs.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs font-mono">
            No activity recorded yet.
          </div>
        ) : (
          auditLogs.slice().reverse().map((log, idx) => (
            <div
              key={idx}
              className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex items-start space-x-2"
            >
              <span className="text-[10px] text-gray-500 shrink-0 mt-0.5">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <div className="min-w-0 flex-1">
                <span className={`text-[10px] font-bold px-1 rounded mr-1.5 ${
                  log.type === 'ADDITION_CONFIRMED'
                    ? 'bg-emerald-950 text-emerald-400'
                    : log.type === 'MEASUREMENT_RECORDED'
                    ? 'bg-cyan-950 text-cyan-400'
                    : log.type === 'STAGE_START' || log.type === 'STAGE_END'
                    ? 'bg-amber-950 text-amber-400'
                    : 'bg-slate-800 text-gray-300'
                }`}>
                  {log.type.replace('_', ' ')}
                </span>
                <span className="text-gray-300 text-[11px] leading-snug">
                  {log.message}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
