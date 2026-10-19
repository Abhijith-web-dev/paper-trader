import React, { useState } from 'react';
import { 
  GraduationCap, 
  HelpCircle
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  content: string;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

const MODULES: Module[] = [
  {
    id: 'mod_1',
    title: 'Market Mechanics & Order Types',
    description: 'Learn the differences between Market, Limit, Stop, and Stop-Limit orders and how matching engines prioritize fills.',
    category: 'Fundamentals',
    readTime: '4 min',
    content: `When you trade financial assets, execution priority depends on the order type:
• Market Orders: Execute immediately against the best available ask (when buying) or bid (when selling). You sacrifice price precision for speed.
• Limit Orders: Specify the maximum price you are willing to pay (Buy Limit) or the minimum price you will accept (Sell Limit). Fills are not guaranteed if the market never touches your limit.
• Stop Orders: Dormant orders that activate into market orders only after a predetermined price threshold (Stop Price) is crossed. Frequently used for loss prevention.`,
    quiz: {
      question: 'Which order guarantees immediate execution, regardless of price fluctuations?',
      options: ['Limit Order', 'Market Order', 'Stop-Limit Order', 'Trailing Stop'],
      correctIndex: 1,
      explanation: 'Market orders prioritize immediate execution over price certainty, filling at current available market quotes.'
    }
  },
  {
    id: 'mod_2',
    title: 'Risk Management & The 2% Rule',
    description: 'Protect virtual capital through disciplined position sizing and maximum loss controls.',
    category: 'Risk Strategy',
    readTime: '5 min',
    content: `Professional quantitative traders prioritize capital preservation over speculative returns.
• The 2% Capital Rule: Never risk more than 1% to 2% of your total account equity on any single trade. If your virtual account holds $100,000, your maximum stop-loss dollar loss should not exceed $2,000.
• Risk-to-Reward Ratio: Seek trade setups offering at least a 1:2 or 1:3 risk-to-reward ratio. This allows overall profitability even with a 40% win rate.
• Diversification: Avoid allocating over 25% of virtual capital to a single asset class or sector.`,
    quiz: {
      question: 'Under the 2% risk management rule on a $100,000 account, what is the maximum permissible loss on a trade?',
      options: ['$10,000', '$2,000', '$500', '$20,000'],
      correctIndex: 1,
      explanation: '2% of $100,000 equals $2,000. If your stop loss is hit, your total account should lose no more than $2,000.'
    }
  },
  {
    id: 'mod_3',
    title: 'Technical Indicators: SMA & RSI',
    description: 'Understand momentum and trend-following technical indicators used by institutional algorithms.',
    category: 'Technical Analysis',
    readTime: '6 min',
    content: `Technical indicators provide statistical mathematical transformations of price and volume:
• Simple Moving Average (SMA): A smoothing filter calculating average closing price over N periods (e.g., 20 or 50 days). A "Golden Cross" occurs when a short-term SMA crosses above a long-term SMA.
• Relative Strength Index (RSI): A momentum oscillator bounded between 0 and 100. Values above 70 indicate potentially overbought conditions, while values below 30 indicate oversold conditions.`,
    quiz: {
      question: 'An RSI reading above 70 traditionally signifies what market condition?',
      options: ['Oversold condition', 'Overbought condition', 'Market is closed', 'Zero volatility'],
      correctIndex: 1,
      explanation: 'An RSI above 70 indicates strong upward momentum that has reached historically extended or overbought levels.'
    }
  }
];

export const LearnPage: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<Module>(MODULES[0]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const handleOptionSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
  };

  const isCorrect = selectedAnswer === selectedModule.quiz.correctIndex;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1B222D]">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
            <GraduationCap className="w-5 h-5" />
          </span>
          <span>Financial Market Academy</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Master international market mechanics, order types, risk controls, and technical indicators
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module List (1 Col) */}
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">Curriculum Modules</h2>
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedModule(m);
                setSelectedAnswer(null);
                setShowExplanation(false);
              }}
              className={`w-full p-5 rounded-3xl text-left transition-all border ${
                selectedModule.id === m.id
                  ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-white shadow-lg shadow-[#CCFF00]/10'
                  : 'bg-[#0B0F14] border-[#1B222D] text-slate-300 hover:bg-[#10151C]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#10151C] text-[#CCFF00] font-bold border border-[#1B222D]">{m.category}</span>
                <span className="font-mono">{m.readTime}</span>
              </div>
              <h3 className="font-extrabold text-sm text-white">{m.title}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{m.description}</p>
            </button>
          ))}
        </div>

        {/* Selected Lesson Reader & Quiz (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1B222D] pb-4">
              <span className="font-extrabold text-[#CCFF00] uppercase tracking-wider">{selectedModule.category}</span>
              <span className="font-mono">{selectedModule.readTime} read</span>
            </div>

            <h2 className="text-2xl font-black text-white">{selectedModule.title}</h2>

            <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-line font-sans space-y-2">
              {selectedModule.content}
            </div>

            {/* Interactive Knowledge Quiz */}
            <div className="mt-8 pt-6 border-t border-[#1B222D] space-y-4">
              <div className="flex items-center gap-2 text-white font-extrabold text-base">
                <HelpCircle className="w-5 h-5 text-[#CCFF00]" />
                <span>Knowledge Check</span>
              </div>

              <p className="text-xs text-slate-200 font-bold">{selectedModule.quiz.question}</p>

              <div className="space-y-2.5">
                {selectedModule.quiz.options.map((opt, idx) => {
                  let btnStyle = 'bg-[#10151C] border-[#1B222D] text-slate-300 hover:border-slate-600';
                  if (showExplanation) {
                    if (idx === selectedModule.quiz.correctIndex) {
                      btnStyle = 'bg-[#CCFF00]/15 border-[#CCFF00] text-[#CCFF00] font-bold';
                    } else if (idx === selectedAnswer) {
                      btnStyle = 'bg-red-500/20 border-red-500/50 text-red-300';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={showExplanation}
                      className={`w-full p-4 rounded-2xl border text-xs text-left transition-all ${btnStyle}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <div className={`p-4 rounded-2xl text-xs space-y-1 ${
                  isCorrect 
                    ? 'bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00]'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                }`}>
                  <p className="font-black">{isCorrect ? 'Correct Answer!' : 'Review Concept'}</p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{selectedModule.quiz.explanation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
