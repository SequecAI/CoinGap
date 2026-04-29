import React from 'react';

export default function CoinPricePanel({ coin, coinName, coinVol }) {
  if (!coin) return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-center">
      <p className="text-slate-400 font-bold text-sm">로딩중...</p>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center relative overflow-hidden group h-full">
      <div className="relative z-10 w-full flex flex-col items-center">
        <h3 className="text-slate-500 font-black text-base uppercase tracking-widest mb-1">{coinName}</h3>
        <div className="flex items-baseline justify-center gap-1.5 mb-2">
          <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900 leading-none">
            {coin.trade_price.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400 font-black">KRW</span>
        </div>
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className={`flex items-center gap-1 font-black text-xl ${coin.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
            <span className="text-sm">{coin.change === 'RISE' ? '▲' : '▼'}</span>
            <span>{(coin.signed_change_rate * 100).toFixed(2)}%</span>
          </div>
          <div className="px-3 py-1 rounded-full text-[10px] font-black border bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-tight">
            24H VOL: {(coinVol / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억
          </div>
        </div>
      </div>
    </div>
  );
}
