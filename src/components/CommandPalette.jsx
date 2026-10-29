import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Search, ArrowRight, CornerDownLeft, Sparkles, X, History, Lightbulb } from 'lucide-react';
import { parseTradingCommand, COMMAND_PRESETS } from '../lib/commandEngine';

export default function CommandPalette({
  isOpen,
  onClose,
  onExecuteCommand,
  context = {},
}) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trader_command_history') || '[]');
    } catch {
      return [];
    }
  });
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setFeedback(null);
    }
  }, [isOpen]);

  // Global keyboard shortcut (Ctrl+K, Cmd+K, or '/')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onExecuteCommand({ type: 'OPEN_PALETTE' });
      } else if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        onExecuteCommand({ type: 'OPEN_PALETTE' });
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onExecuteCommand]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'clear') {
      setHistory([]);
      localStorage.removeItem('trader_command_history');
      setInput('');
      setFeedback('Command history cleared.');
      return;
    }

    // Save to history
    const updatedHistory = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, 15);
    setHistory(updatedHistory);
    try {
      localStorage.setItem('trader_command_history', JSON.stringify(updatedHistory));
    } catch {}

    // Parse command
    const parsed = parseTradingCommand(trimmed, context);
    setFeedback(parsed.feedback);

    if (onExecuteCommand) {
      onExecuteCommand(parsed);
    }

    if (parsed.type !== 'UNKNOWN') {
      setTimeout(() => {
        onClose();
        setInput('');
      }, 500);
    }
  };

  const handleSelectPreset = (cmdText) => {
    setInput(cmdText);
    const parsed = parseTradingCommand(cmdText, context);
    setFeedback(parsed.feedback);
    if (onExecuteCommand) {
      onExecuteCommand(parsed);
    }
    setTimeout(() => {
      onClose();
      setInput('');
    }, 400);
  };

  // Filter presets based on user input
  const filteredPresets = COMMAND_PRESETS.filter((p) =>
    p.command.toLowerCase().includes(input.toLowerCase()) ||
    p.desc.toLowerCase().includes(input.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] sm:shadow-[10px_10px_0px_#111111] overflow-hidden flex flex-col max-h-[88vh]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b-2 border-[#111111] bg-[#111111] text-[#F6F4EE]">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-serif font-bold text-xs uppercase tracking-wider truncate">
              Natural Trading Command Terminal
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400 shrink-0">
            <span className="hidden sm:inline">Context: {context.activeStock?.symbol || 'GLOBAL'}</span>
            <span className="text-neutral-600 hidden sm:inline">•</span>
            <span className="hidden sm:inline">Esc to close</span>
            {/* Prominent Mobile & Desktop Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close Terminal [Esc]"
              className="p-1 sm:p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center font-mono text-xs border border-neutral-700"
              aria-label="Close Command Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="flex items-center px-4 py-3 bg-white border-b border-[#111111]" data-no-popunder="true">
          <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a trading command (e.g. 'buy 10 AAPL', 'add rsi', 'screener', 'risk')..."
            className="w-full bg-transparent font-mono text-sm text-[#111111] focus:outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#111111] text-[#F6F4EE] text-xs font-mono font-bold hover:bg-neutral-800 ml-2 shrink-0"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </form>

        {/* Feedback Ribbon */}
        {feedback && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-300 font-mono text-xs text-amber-900 flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="p-0.5 text-neutral-500 hover:text-black">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Presets & Autocomplete List */}
        <div className="p-3 max-h-72 overflow-y-auto space-y-1 font-mono text-xs">
          <div className="text-[10px] uppercase font-bold text-neutral-500 px-2 py-1 flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span>Suggested Commands & Quick Tools</span>
          </div>

          {filteredPresets.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectPreset(item.command)}
              className="flex items-center justify-between p-2 rounded hover:bg-neutral-200 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#111111] group-hover:underline">
                  {item.command}
                </span>
                <span className="text-[11px] text-neutral-500 font-sans">
                  {item.desc}
                </span>
              </div>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
            </div>
          ))}

          {/* History */}
          {history.length > 0 && !input && (
            <div className="pt-2 border-t border-neutral-200 mt-2">
              <div className="text-[10px] uppercase font-bold text-neutral-500 px-2 py-1 flex items-center gap-1.5">
                <History className="w-3 h-3 text-neutral-400" />
                <span>Recent Command History</span>
              </div>
              {history.slice(0, 4).map((h, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPreset(h)}
                  className="flex items-center justify-between p-2 rounded hover:bg-neutral-200 cursor-pointer text-neutral-700"
                >
                  <span>{h}</span>
                  <span className="text-[10px] text-neutral-400 font-sans">Reuse</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2 border-t border-neutral-300 bg-neutral-100 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-neutral-500">
          <span className="truncate pr-2">Tip: Press <kbd className="px-1 border border-neutral-400 bg-white text-black font-bold">/</kbd> anywhere</span>
          <span className="hidden sm:inline">Zero Server Round-Trip • 0ms Execution</span>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden text-neutral-700 font-bold hover:underline cursor-pointer shrink-0"
          >
            Close ✕
          </button>
        </div>
      </div>
    </div>
  );
}
