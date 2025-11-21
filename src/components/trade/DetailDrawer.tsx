// components/trade/DetailDrawer.tsx

import { useTradeStore } from '@/store/trade';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '../ui/scroll-area';

export function DetailDrawer() {
  const {
    recommendations,
    selectedTicker,
    drawerOpen,
    setDrawerOpen,
  } = useTradeStore();

  const selected = recommendations.find(r => r.ticker === selectedTicker);

  if (!selected) return null;

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="bottom">
      <DrawerContent
        className="no-handle bg-white/5 backdrop-blur-xl border-t border-white/20 px-4 sm:px-6 py-6 !gap-0"
      >
        <ScrollArea className="h-[75vh]">
        <div className="space-y-6 pb-6 max-w-4xl mx-auto w-full">
          {/* Explanation - Most Important Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-8 bg-[#4EA8F5] rounded-full" />
              <h3 className="text-xl font-bold text-white">
                Explanation
              </h3>
            </div>
            <p className="text-base text-white leading-relaxed">
              {selected.explainSummary}
            </p>
          </div>

          {/* Signals Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">
              Signal Breakdown
            </h3>
            <div className="space-y-4">
              {selected.signals.map((signal, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{signal.name}</span>
                    <span className="text-xs text-white/50">{signal.weight}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#4EA8F5] to-[#2ED573] transition-all duration-300"
                      style={{ width: `${signal.weight}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">{signal.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation Events Timeline */}
          {selected.recommendationEvents && selected.recommendationEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">
                Recommendation History
              </h3>
              <div className="space-y-3">
                {selected.recommendationEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#4EA8F5]">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-white/80">
                        Score: {event.score.toFixed(1)}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-xs text-white/70 leading-relaxed">{event.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

