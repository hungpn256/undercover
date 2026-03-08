/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Ghost, 
  ShieldAlert, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff,
  ChevronRight,
  Trophy,
  Info,
  User
} from 'lucide-react';
import { Role, Player, GameState, WordPair, Type } from './types';
import { WORD_PAIRS } from './constants';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [gameState, setGameState] = useState<GameState>('SETUP');
  const [playerCount, setPlayerCount] = useState(4);
  const [spyCount, setSpyCount] = useState(1);
  const [mrWhiteCount, setMrWhiteCount] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isWordVisible, setIsWordVisible] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<Player | null>(null);
  const [winner, setWinner] = useState<Role | 'DRAW' | null>(null);
  const [currentWordPair, setCurrentWordPair] = useState<WordPair | null>(null);
  const [isAiMode, setIsAiMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [revealCount, setRevealCount] = useState(0);
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [mrWhiteGuessWrong, setMrWhiteGuessWrong] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') ?? '');
  const [showApiKey, setShowApiKey] = useState(false);

  const hasKey = apiKey.trim().length > 0;

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem('gemini_api_key', value);
  };

  const generateAiWordPair = async (): Promise<WordPair> => {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() || process.env.API_KEY || process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Generate a word pair for the game 'Undercover' (Ai là gián điệp). The pair should be two related but different Vietnamese words. Example: 'Bánh mì' and 'Bánh bao'. Return only the JSON.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              civilian: { type: Type.STRING },
              spy: { type: Type.STRING }
            },
            required: ["civilian", "spy"]
          }
        }
      });
      
      if (!response.text) throw new Error("No response text");
      return JSON.parse(response.text);
    } catch (error: unknown) {
      console.error("AI Generation failed:", error);
      
      if (error instanceof Error && (error.message?.includes("entity was not found") || error.message?.includes("API key"))) {
        alert("Lỗi API Key. Vui lòng kiểm tra lại key của bạn.");
      }
      
      return WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    }
  };

  // Bước 1: Validate setup → chạy game
  const startGame = async () => {
    const totalSpecial = spyCount + mrWhiteCount;
    if (totalSpecial >= playerCount) {
      alert('Số lượng Gián điệp và Mũ trắng phải ít hơn tổng số người chơi!');
      return;
    }
    if (isAiMode && !hasKey) {
      alert("Vui lòng nhập Gemini API Key để dùng chế độ AI.");
      return;
    }

    setIsGenerating(true);
    let wordPair: WordPair;
    if (isAiMode) {
      wordPair = await generateAiWordPair();
    } else {
      wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    }
    setCurrentWordPair(wordPair);
    setIsGenerating(false);

    const roles: Role[] = [
      ...Array(playerCount - spyCount - mrWhiteCount).fill(Role.CIVILIAN),
      ...Array(spyCount).fill(Role.SPY),
      ...Array(mrWhiteCount).fill(Role.MR_WHITE),
    ];

    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);

    const basePlayers: Player[] = shuffledRoles.map((role, index) => ({
      id: index,
      name: `Người chơi ${index + 1}`,
      role,
      word: role === Role.CIVILIAN ? wordPair.civilian : (role === Role.SPY ? wordPair.spy : ''),
      isEliminated: false,
      isRevealed: false,
    }));

    // Rotate vòng tròn tại vị trí ngẫu nhiên (b,c,d,a hoặc c,d,a,b ...)
    const offset = Math.floor(Math.random() * basePlayers.length);
    const rotatedPlayers = [
      ...basePlayers.slice(offset),
      ...basePlayers.slice(0, offset),
    ];

    setPlayers(rotatedPlayers);
    setCurrentPlayerIndex(0);
    setCurrentPlayerName('');
    setGameState('REVEAL');
    setIsWordVisible(false);
  };

  const nextPlayerReveal = () => {
    const savedName = currentPlayerName.trim();
    setPlayers(prev => prev.map((p, i) =>
      i === currentPlayerIndex ? { ...p, name: savedName } : p
    ));

    if (currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(prev => prev + 1);
      setCurrentPlayerName('');
      setIsWordVisible(false);
    } else {
      setGameState('DISCUSSION');
    }
  };

  const handleEliminate = (player: Player) => {
    const updatedPlayers = players.map(p => 
      p.id === player.id ? { ...p, isEliminated: true } : p
    );
    setPlayers(updatedPlayers);
    setEliminatedPlayer(player);
    setGameState('RESULT');
  };

  const checkWinCondition = () => {
    const activePlayers = players.filter(p => !p.isEliminated);
    const civilians = activePlayers.filter(p => p.role === Role.CIVILIAN);
    const spies = activePlayers.filter(p => p.role === Role.SPY);
    const mrWhites = activePlayers.filter(p => p.role === Role.MR_WHITE);

    if (spies.length === 0 && mrWhites.length === 0) {
      setWinner(Role.CIVILIAN);
      setGameState('GAME_OVER');
      return;
    }

    if (activePlayers.length <= 2) {
      if (spies.length > 0) {
        setWinner(Role.SPY);
      } else if (mrWhites.length > 0) {
        setWinner(Role.MR_WHITE);
      }
      setGameState('GAME_OVER');
      return;
    }

    setGameState('DISCUSSION');
  };

  // Mũ trắng đoán từ
  const handleMrWhiteGuess = () => {
    const guess = mrWhiteGuess.trim().toLowerCase();
    const correct = currentWordPair?.civilian.trim().toLowerCase();
    if (guess === correct) {
      setWinner(Role.MR_WHITE);
      setGameState('GAME_OVER');
    } else {
      setMrWhiteGuessWrong(true);
    }
  };

  const resetGame = () => {
    setGameState('SETUP');
    setWinner(null);
    setEliminatedPlayer(null);
    setPlayers([]);
    setCurrentPlayerName('');
    setRevealCount(0);
    setMrWhiteGuess('');
    setMrWhiteGuessWrong(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white">
      <div className="max-w-md mx-auto px-6 py-12 min-h-screen flex flex-col">
        
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-serif font-bold tracking-tight mb-2"
          >
            Mũ Trắng
          </motion.h1>
          <p className="text-sm uppercase tracking-widest text-[#5A5A40] font-semibold opacity-70">
            Undercover Mystery
          </p>
        </header>

        <main className="flex-grow flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* SETUP SCREEN */}
            {gameState === 'SETUP' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <Users size={18} className="text-[#5A5A40]" />
                        Tổng số người chơi
                      </span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setPlayerCount(Math.max(3, playerCount - 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >-</button>
                        <span className="w-4 text-center font-bold">{playerCount}</span>
                        <button 
                          onClick={() => setPlayerCount(Math.min(12, playerCount + 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >+</button>
                      </div>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <Ghost size={18} className="text-red-600" />
                        Số Gián điệp
                      </span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSpyCount(Math.max(1, spyCount - 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >-</button>
                        <span className="w-4 text-center font-bold">{spyCount}</span>
                        <button 
                          onClick={() => setSpyCount(Math.min(3, spyCount + 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >+</button>
                      </div>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <ShieldAlert size={18} className="text-[#5A5A40]" />
                        Số Mũ trắng
                      </span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setMrWhiteCount(Math.max(0, mrWhiteCount - 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >-</button>
                        <span className="w-4 text-center font-bold">{mrWhiteCount}</span>
                        <button 
                          onClick={() => setMrWhiteCount(Math.min(1, mrWhiteCount + 1))}
                          className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                        >+</button>
                      </div>
                    </label>

                    <div className="pt-4 border-t border-black/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setIsAiMode(!isAiMode)}
                          className={`flex-grow p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            isAiMode 
                            ? 'bg-purple-50 border-purple-200 text-purple-700' 
                            : 'bg-white border-black/5 text-gray-500'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isAiMode ? 'bg-purple-100' : 'bg-gray-100'}`}>
                              <RotateCcw size={16} className={isAiMode ? 'text-purple-600' : 'text-gray-400'} />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold">Chế độ AI thông minh</p>
                              <p className="text-[10px] opacity-70">Tự động tạo cặp từ mới lạ</p>
                            </div>
                          </div>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${isAiMode ? 'bg-purple-600' : 'bg-gray-200'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAiMode ? 'left-6' : 'left-1'}`} />
                          </div>
                        </button>
                      </div>

                      {isAiMode && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <label className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                            <ShieldAlert size={12} />
                            Gemini API Key
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={apiKey}
                              onChange={(e) => handleApiKeyChange(e.target.value)}
                              placeholder="Nhập API key của bạn..."
                              className={`w-full pr-10 pl-3 py-2.5 rounded-xl border text-xs font-mono outline-none transition-all ${
                                hasKey
                                  ? 'border-green-200 bg-green-50 text-green-800 focus:border-green-400'
                                  : 'border-amber-200 bg-amber-50 text-amber-800 focus:border-amber-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          {hasKey && (
                            <p className="text-[10px] text-green-600 flex items-center gap-1">
                              <CheckCircle2 size={10} /> API Key đã được lưu
                            </p>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    disabled={isGenerating}
                    className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-semibold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang tạo từ...
                      </div>
                    ) : (
                      <>
                        <Play size={18} fill="currentColor" />
                        Bắt đầu chơi
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#5A5A40]/5 rounded-2xl p-4 flex gap-3 items-start">
                  <Info size={18} className="text-[#5A5A40] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#5A5A40]/80 leading-relaxed">
                    Mỗi người sẽ nhận một từ khóa. Gián điệp nhận từ gần giống, Mũ trắng không có từ. Hãy mô tả và tìm ra kẻ lạc loài!
                  </p>
                </div>
              </motion.div>
            )}

            {/* NAME INPUT SCREEN */}
            {gameState === 'NAME_INPUT' && (
              <></>  
            )}

            {/* REVEAL SCREEN */}
            {gameState === 'REVEAL' && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 text-center"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-widest text-[#5A5A40] font-bold">Lượt {currentPlayerIndex + 1} / {players.length}</p>
                    <h2 className="text-2xl font-serif">Đến lượt bạn xem từ</h2>
                  </div>

                  {/* Name input — bắt buộc */}
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={currentPlayerName}
                        onChange={(e) => setCurrentPlayerName(e.target.value)}
                        placeholder="Nhập tên của bạn..."
                        autoFocus
                        className={`w-full px-4 py-3 rounded-2xl border text-center text-base font-medium outline-none transition-all ${
                          currentPlayerName.trim()
                            ? 'border-[#5A5A40] bg-white'
                            : 'border-amber-300 bg-amber-50 focus:border-amber-500'
                        }`}
                      />
                      <User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/30" />
                    </div>
                    {!currentPlayerName.trim() && (
                      <p className="text-[11px] text-amber-600 text-center">Nhập tên trước khi xem từ</p>
                    )}
                  </div>

                  <div className="relative aspect-square max-w-[200px] mx-auto flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {!isWordVisible ? (
                        <motion.button
                          key="hidden"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.1 }}
                          onClick={() => currentPlayerName.trim() && setIsWordVisible(true)}
                          className={`w-full h-full rounded-3xl flex flex-col items-center justify-center gap-3 shadow-xl transition-all ${
                            currentPlayerName.trim()
                              ? 'bg-[#5A5A40] text-white cursor-pointer'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <EyeOff size={48} />
                          <span className="font-semibold">
                            {currentPlayerName.trim() ? 'Nhấn để xem' : 'Nhập tên trước'}
                          </span>
                        </motion.button>
                      ) : (
                        <motion.div
                          key="visible"
                          initial={{ opacity: 0, scale: 1.1 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-full h-full bg-white border-4 border-[#5A5A40] rounded-3xl flex flex-col items-center justify-center gap-4"
                        >
                          <div className="text-[#5A5A40]">
                            {players[currentPlayerIndex].role === Role.MR_WHITE ? <ShieldAlert size={48} /> : <Eye size={48} />}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase font-bold opacity-50">Từ khóa của bạn:</p>
                            <p className="text-3xl font-serif font-bold text-[#5A5A40]">
                              {players[currentPlayerIndex].role === Role.MR_WHITE ? '???' : players[currentPlayerIndex].word}
                            </p>
                            {players[currentPlayerIndex].role === Role.MR_WHITE && (
                              <p className="text-xs text-red-500 font-bold mt-2">BẠN LÀ MŨ TRẮNG!</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {isWordVisible && (
                    <button
                      onClick={nextPlayerReveal}
                      className="w-full py-4 border-2 border-[#5A5A40] text-[#5A5A40] rounded-full font-semibold flex items-center justify-center gap-2 hover:bg-[#5A5A40] hover:text-white transition-all"
                    >
                      Xong, chuyển máy <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* DISCUSSION SCREEN */}
            {gameState === 'DISCUSSION' && (
              <motion.div
                key="discussion"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2 mb-4">
                  <h2 className="text-2xl font-serif font-bold">Thảo luận & Mô tả</h2>
                  <p className="text-sm text-[#5A5A40]">Mỗi người nói 1 câu mô tả từ của mình.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[...players].sort((a, b) => a.id - b.id).map((player) => (
                    <div 
                      key={player.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        player.isEliminated 
                        ? 'bg-black/5 border-transparent opacity-40 grayscale' 
                        : 'bg-white border-black/5 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          player.isEliminated ? 'bg-gray-300' : 'bg-[#5A5A40] text-white'
                        }`}>
                          {player.id + 1}
                        </div>
                        <span className="font-medium text-sm">{player.name}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setGameState('VOTING')}
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  Đến phần Bỏ phiếu
                </button>
              </motion.div>
            )}

            {/* VOTING SCREEN */}
            {gameState === 'VOTING' && (
              <motion.div
                key="voting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2 mb-4">
                  <h2 className="text-2xl font-serif font-bold">Ai là Gián điệp?</h2>
                  <p className="text-sm text-[#5A5A40]">Chọn người bị nghi ngờ nhiều nhất.</p>
                </div>

                <div className="space-y-3">
                  {players.filter(p => !p.isEliminated).map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleEliminate(player)}
                      className="w-full p-5 bg-white rounded-2xl border border-black/5 shadow-sm flex items-center justify-between hover:border-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] font-bold group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
                          {player.id + 1}
                        </div>
                        <span className="font-semibold">{player.name}</span>
                      </div>
                      <RotateCcw size={18} className="opacity-0 group-hover:opacity-40" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* RESULT SCREEN */}
            {gameState === 'RESULT' && eliminatedPlayer && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="bg-white rounded-[32px] p-10 shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-widest font-bold opacity-50">Kết quả bỏ phiếu</p>
                    <h2 className="text-3xl font-serif font-bold">{eliminatedPlayer.name} bị loại!</h2>
                  </div>

                  <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg ${
                    eliminatedPlayer.role === Role.CIVILIAN 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-green-100 text-green-600'
                  }`}>
                    {eliminatedPlayer.role === Role.CIVILIAN ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
                    {eliminatedPlayer.role === Role.CIVILIAN ? 'Dân thường' : (eliminatedPlayer.role === Role.SPY ? 'Gián điệp' : 'Mũ trắng')}
                  </div>

                  <div className="pt-4 space-y-1">
                    <p className="text-sm opacity-50">Từ của họ là:</p>
                    <p className="text-2xl font-serif font-bold italic">
                      {eliminatedPlayer.role === Role.MR_WHITE ? '(Không có từ)' : eliminatedPlayer.word}
                    </p>
                  </div>

                  {eliminatedPlayer.role === Role.MR_WHITE ? (
                    // Mũ trắng đoán từ
                    <div className="space-y-3">
                      {mrWhiteGuessWrong ? (
                        // Thông báo sai
                        <>
                          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
                            <p className="text-base font-bold text-red-700">❌ Sai rồi!</p>
                            <p className="text-sm text-red-600">
                              &ldquo;<span className="font-semibold">{mrWhiteGuess}</span>&rdquo; không phải từ của dân thường.
                            </p>
                            <p className="text-xs text-red-500 mt-1">Mũ trắng bị loại khỏi trò chơi.</p>
                          </div>
                          <button
                            onClick={() => { setMrWhiteGuessWrong(false); setMrWhiteGuess(''); checkWinCondition(); }}
                            className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-semibold"
                          >
                            Tiếp tục
                          </button>
                        </>
                      ) : (
                        // Form nhập từ
                        <>
                          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-1">
                            <p className="text-sm font-bold text-purple-700">Cơ hội cuối cùng!</p>
                            <p className="text-xs text-purple-600">Mũ trắng đoán đúng từ của dân thường sẽ thắng!</p>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={mrWhiteGuess}
                              onChange={(e) => setMrWhiteGuess(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && mrWhiteGuess.trim() && handleMrWhiteGuess()}
                              placeholder="Nhập từ của dân thường..."
                              className="flex-1 px-4 py-3 rounded-2xl border border-purple-200 bg-purple-50 text-sm font-medium outline-none focus:border-purple-400 focus:bg-white transition-all"
                              autoFocus
                            />
                            <button
                              onClick={handleMrWhiteGuess}
                              disabled={!mrWhiteGuess.trim()}
                              className="px-5 py-3 bg-purple-600 text-white rounded-2xl font-semibold hover:bg-purple-700 transition-all disabled:opacity-40"
                            >
                              Đoán
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={checkWinCondition}
                      className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-semibold"
                    >
                      Tiếp tục
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* GAME OVER SCREEN */}
            {gameState === 'GAME_OVER' && (
              <motion.div
                key="game-over"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-8"
              >
                <div className="bg-white rounded-[32px] p-10 shadow-sm border border-black/5 space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                        <Trophy size={48} />
                      </div>
                    </div>
                    <h2 className="text-4xl font-serif font-bold">
                      {winner === Role.CIVILIAN ? 'Dân thường thắng!' : (winner === Role.SPY ? 'Gián điệp thắng!' : 'Mũ trắng thắng!')}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-[#F5F5F0] rounded-2xl text-left space-y-2">
                      <p className="text-xs font-bold uppercase opacity-50">Từ khóa vòng này:</p>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs">Dân thường</p>
                          <p className="font-bold text-[#5A5A40]">{currentWordPair?.civilian}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs">Gián điệp</p>
                          <p className="font-bold text-red-600">{currentWordPair?.spy}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[...players].sort((a, b) => a.id - b.id).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-black/5">
                          <span className="flex items-center gap-2">
                            <User size={14} className={p.isEliminated ? 'opacity-30' : ''} />
                            {p.name}
                          </span>
                          <span className={`font-bold ${
                            p.role === Role.CIVILIAN ? 'text-[#5A5A40]' : (p.role === Role.SPY ? 'text-red-600' : 'text-purple-600')
                          }`}>
                            {p.role === Role.CIVILIAN ? 'Dân' : (p.role === Role.SPY ? 'Gián điệp' : 'Mũ trắng')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={resetGame}
                    className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-semibold flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} /> Chơi lại
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Footer Info */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A40] opacity-40 font-bold">
            © 2026 Undercover Mystery Game
          </p>
        </footer>
      </div>
    </div>
  );
}
