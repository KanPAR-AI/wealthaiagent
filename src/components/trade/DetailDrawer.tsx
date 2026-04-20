// components/trade/DetailDrawer.tsx

import { useState } from 'react';
import { useTradeStore } from '@/store/trade';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DetailDrawer() {
  const {
    recommendations,
    selectedTicker,
    drawerOpen,
    setDrawerOpen,
  } = useTradeStore();

  const [investmentAmount, setInvestmentAmount] = useState<string>('10000');

  const selected = recommendations.find(r => r.ticker === selectedTicker);

  if (!selected) return null;

  // Calculate potential returns
  const investment = parseFloat(investmentAmount) || 0;
  const currentPrice = selected.price || 0;
  const shares = currentPrice > 0 ? Math.floor(investment / currentPrice) : 0;
  
  // Projected return based on score (conservative estimate: score * 0.1% to 0.5%)
  // Higher score = higher potential return
  const projectedReturnPercent = Math.min(selected.score * 0.15, 30); // Cap at 30%
  const projectedPrice = currentPrice * (1 + projectedReturnPercent / 100);
  const projectedValue = shares * projectedPrice;
  const potentialProfit = projectedValue - investment;
  const potentialProfitPercent = investment > 0 ? (potentialProfit / investment) * 100 : 0;

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
              <div className="w-1.5 h-8 bg-[#25D366] rounded-full" />
              <h3 className="text-xl font-bold text-white">
                Explanation
              </h3>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-base text-white leading-relaxed whitespace-pre-wrap break-words">
                {selected.explainSummary || 'No explanation available.'}
              </p>
              <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap break-words mt-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.
              </p>
            </div>
          </div>

          {/* Potential Returns Calculator */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-8 bg-[#2ED573] rounded-full" />
              <h3 className="text-xl font-bold text-white">
                Potential Returns Calculator
              </h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="investment" className="text-white/90">
                  Investment Amount ($)
                </Label>
                <Input
                  id="investment"
                  type="number"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  placeholder="10000"
                  min="0"
                  step="100"
                />
              </div>
              
              {investment > 0 && currentPrice > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/20">
                  <div className="space-y-2">
                    <div className="text-sm text-white/70">Current Price</div>
                    <div className="text-lg font-semibold text-white">
                      ${currentPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-white/70">Shares You Can Buy</div>
                    <div className="text-lg font-semibold text-white">
                      {shares.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-white/70">Projected Return</div>
                    <div className="text-lg font-semibold text-[#2ED573]">
                      {projectedReturnPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-white/70">Projected Price</div>
                    <div className="text-lg font-semibold text-white">
                      ${projectedPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="text-sm text-white/70">Potential Value</div>
                    <div className="text-2xl font-bold text-[#2ED573]">
                      ${projectedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2 pt-2 border-t border-white/10">
                    <div className="text-sm text-white/70">Potential Profit</div>
                    <div className={`text-2xl font-bold ${potentialProfit >= 0 ? 'text-[#2ED573]' : 'text-red-400'}`}>
                      {potentialProfit >= 0 ? '+' : ''}${potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      <span className="text-lg ml-2">
                        ({potentialProfitPercent >= 0 ? '+' : ''}{potentialProfitPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {investment > 0 && currentPrice === 0 && (
                <div className="text-sm text-white/70 pt-2">
                  Current price data unavailable. Please try again later.
                </div>
              )}
            </div>
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
                      className="h-full bg-gradient-to-r from-[#25D366] to-[#2ED573] transition-all duration-300"
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
                      <span className="text-xs font-semibold text-[#25D366]">
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

