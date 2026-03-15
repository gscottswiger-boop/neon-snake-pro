/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trophy, Play, RotateCcw, Zap, Skull, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Configuration (Adjust these to tweak game feel) ---
const GRID_SIZE = 20;       // Size of each square in the grid (smaller = more squares)
const INITIAL_SPEED = 150;  // Starting interval in ms (higher = slower)
const MIN_SPEED = 60;       // Maximum speed cap (minimum interval in ms)
const SPEED_INCREMENT = 2;  // How many ms to subtract from interval per food eaten
const GOLDEN_APPLE_CHANCE = 0.1; // Probability (0-1) of spawning a golden apple
const POISON_CHANCE = 0.15;      // Probability (0-1) of spawning poison

// --- Colors & Aesthetics ---
const COLORS = {
  background: '#0a0a0c',
  snakeHead: '#00f2ff',
  snakeBody: '#00ff66',
  foodStandard: '#00ff66',
  foodGolden: '#ffcc00',
  foodPoison: '#ff3333',
  gridLines: 'rgba(255, 255, 255, 0.03)'
};

type Point = { x: number; y: number };
type FoodType = 'standard' | 'golden' | 'poison';
type Food = Point & { type: FoodType; expires?: number };

export default function App() {
  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const directionRef = useRef<Point>({ x: 1, y: 0 });
  const nextDirectionRef = useRef<Point>({ x: 1, y: 0 });
  const touchStartRef = useRef<Point | null>(null);

  // --- State ---
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('snake-high-score')) || 0);
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isShaking, setIsShaking] = useState(false);

  // --- Helper: Generate Random Point ---
  const getRandomPoint = useCallback((currentSnake: Point[], currentFoods: Food[]): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const cols = Math.floor(canvas.width / GRID_SIZE);
    const rows = Math.floor(canvas.height / GRID_SIZE);
    
    let point: Point;
    let isOccupied: boolean;
    
    do {
      point = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
      
      isOccupied = currentSnake.some(s => s.x === point.x && s.y === point.y) ||
                   currentFoods.some(f => f.x === point.x && f.y === point.y);
    } while (isOccupied);
    
    return point;
  }, []);

  // --- Helper: Spawn Food ---
  const spawnFood = useCallback((currentSnake: Point[], currentFoods: Food[]) => {
    const rand = Math.random();
    let type: FoodType = 'standard';
    let expires: number | undefined;

    if (rand < GOLDEN_APPLE_CHANCE) {
      type = 'golden';
      expires = Date.now() + 5000; // Golden apples last 5 seconds
    } else if (rand < GOLDEN_APPLE_CHANCE + POISON_CHANCE) {
      type = 'poison';
      expires = Date.now() + 7000; // Poison lasts 7 seconds
    }

    const newFood: Food = { ...getRandomPoint(currentSnake, currentFoods), type, expires };
    return newFood;
  }, [getRandomPoint]);

  // --- Game Logic: Start Game ---
  const startGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
    setFoods([{ ...getRandomPoint([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], []), type: 'standard' }]);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    setGameState('PLAYING');
    lastUpdateTimeRef.current = performance.now();
  };

  // --- Game Logic: End Game ---
  const gameOver = () => {
    setGameState('GAMEOVER');
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
    
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const currentDir = directionRef.current;

      if ((key === 'arrowup' || key === 'w') && currentDir.y === 0) {
        nextDirectionRef.current = { x: 0, y: -1 };
      } else if ((key === 'arrowdown' || key === 's') && currentDir.y === 0) {
        nextDirectionRef.current = { x: 0, y: 1 };
      } else if ((key === 'arrowleft' || key === 'a') && currentDir.x === 0) {
        nextDirectionRef.current = { x: -1, y: 0 };
      } else if ((key === 'arrowright' || key === 'd') && currentDir.x === 0) {
        nextDirectionRef.current = { x: 1, y: 0 };
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Mobile Swipe Handling ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStartRef.current.x;
    const dy = touchEnd.y - touchStartRef.current.y;
    
    const currentDir = directionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30 && currentDir.x === 0) nextDirectionRef.current = { x: 1, y: 0 };
      else if (dx < -30 && currentDir.x === 0) nextDirectionRef.current = { x: -1, y: 0 };
    } else {
      if (dy > 30 && currentDir.y === 0) nextDirectionRef.current = { x: 0, y: 1 };
      else if (dy < -30 && currentDir.y === 0) nextDirectionRef.current = { x: 0, y: -1 };
    }
    
    touchStartRef.current = null;
  };

  // --- Drawing Logic ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = COLORS.gridLines;
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw Foods
    foods.forEach(food => {
      ctx.shadowBlur = 15;
      switch (food.type) {
        case 'standard':
          ctx.fillStyle = COLORS.foodStandard;
          ctx.shadowColor = COLORS.foodStandard;
          break;
        case 'golden':
          ctx.fillStyle = COLORS.foodGolden;
          ctx.shadowColor = COLORS.foodGolden;
          break;
        case 'poison':
          ctx.fillStyle = COLORS.foodPoison;
          ctx.shadowColor = COLORS.foodPoison;
          break;
      }
      
      // Draw food as a rounded square or circle
      ctx.beginPath();
      ctx.arc(food.x * GRID_SIZE + GRID_SIZE / 2, food.y * GRID_SIZE + GRID_SIZE / 2, GRID_SIZE / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Snake
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      ctx.fillStyle = isHead ? COLORS.snakeHead : COLORS.snakeBody;
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.shadowColor = isHead ? COLORS.snakeHead : COLORS.snakeBody;
      
      // Rounded segments
      const padding = 2;
      const size = GRID_SIZE - padding * 2;
      const x = segment.x * GRID_SIZE + padding;
      const y = segment.y * GRID_SIZE + padding;
      
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 4);
      ctx.fill();
      
      // Eyes for the head
      if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        const eyeSize = 3;
        const dir = directionRef.current;
        
        // Position eyes based on direction
        if (dir.x === 1) { // Right
          ctx.fillRect(x + size - 6, y + 4, eyeSize, eyeSize);
          ctx.fillRect(x + size - 6, y + size - 7, eyeSize, eyeSize);
        } else if (dir.x === -1) { // Left
          ctx.fillRect(x + 3, y + 4, eyeSize, eyeSize);
          ctx.fillRect(x + 3, y + size - 7, eyeSize, eyeSize);
        } else if (dir.y === -1) { // Up
          ctx.fillRect(x + 4, y + 3, eyeSize, eyeSize);
          ctx.fillRect(x + size - 7, y + 3, eyeSize, eyeSize);
        } else if (dir.y === 1) { // Down
          ctx.fillRect(x + 4, y + size - 6, eyeSize, eyeSize);
          ctx.fillRect(x + size - 7, y + size - 6, eyeSize, eyeSize);
        }
      }
      ctx.shadowBlur = 0;
    });
  }, [snake, foods]);

  // --- Game Loop ---
  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    const deltaTime = time - lastUpdateTimeRef.current;

    if (deltaTime >= speed) {
      lastUpdateTimeRef.current = time;
      directionRef.current = nextDirectionRef.current;
      
      const head = snake[0];
      const newHead = {
        x: head.x + directionRef.current.x,
        y: head.y + directionRef.current.y
      };

      const canvas = canvasRef.current;
      if (!canvas) return;
      const cols = Math.floor(canvas.width / GRID_SIZE);
      const rows = Math.floor(canvas.height / GRID_SIZE);

      // Collision: Walls
      if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) {
        gameOver();
        return;
      }

      // Collision: Self
      if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        gameOver();
        return;
      }

      const newSnake = [newHead, ...snake];
      let didEat = false;
      let foodToRemoveIndex = -1;

      // Collision: Food
      foods.forEach((food, index) => {
        if (food.x === newHead.x && food.y === newHead.y) {
          didEat = true;
          foodToRemoveIndex = index;
          
          if (food.type === 'standard') {
            setScore(s => s + 10);
            setSpeed(prev => Math.max(MIN_SPEED, prev - SPEED_INCREMENT));
          } else if (food.type === 'golden') {
            setScore(s => s + 50);
            // Golden apple makes you grow twice
            newSnake.push({ ...snake[snake.length - 1] });
          } else if (food.type === 'poison') {
            setScore(s => Math.max(0, s - 10));
            // Shrink snake
            if (newSnake.length <= 2) {
              gameOver();
              return;
            }
            newSnake.pop();
            newSnake.pop();
          }
        }
      });

      if (didEat) {
        const updatedFoods = foods.filter((_, i) => i !== foodToRemoveIndex);
        // Spawn standard food if none left or randomly spawn extra
        if (updatedFoods.filter(f => f.type === 'standard').length === 0) {
          updatedFoods.push({ ...getRandomPoint(newSnake, updatedFoods), type: 'standard' });
        }
        // Random chance to spawn another food
        if (Math.random() < 0.2) {
          updatedFoods.push(spawnFood(newSnake, updatedFoods));
        }
        setFoods(updatedFoods);
      } else {
        newSnake.pop();
      }

      // Remove expired foods
      const now = Date.now();
      const nonExpiredFoods = foods.filter(f => !f.expires || f.expires > now);
      if (nonExpiredFoods.length !== foods.length) {
        setFoods(nonExpiredFoods);
      }

      setSnake(newSnake);
    }

    draw();
    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameState, snake, foods, speed, draw, getRandomPoint, spawnFood]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(update);
    } else {
      draw();
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, update, draw]);

  // --- Canvas Resizing ---
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const size = Math.min(window.innerWidth - 40, window.innerHeight - 200, 600);
      // Ensure size is a multiple of GRID_SIZE for perfect rendering
      const adjustedSize = Math.floor(size / GRID_SIZE) * GRID_SIZE;
      
      canvas.width = adjustedSize;
      canvas.height = adjustedSize;
      draw();
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 select-none ${isShaking ? 'shake' : ''}`}>
      
      {/* --- Header / HUD --- */}
      <div className="w-full max-w-[600px] flex items-center justify-between mb-6 px-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter neon-text-green uppercase italic">Neon Snake</h1>
          <div className="flex items-center gap-2 text-xs font-mono opacity-50 uppercase tracking-widest">
            <Zap size={12} className="text-cyan-400" />
            <span>System Active</span>
          </div>
        </div>
        
        <div className="flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Score</span>
            <span className="text-2xl font-mono font-bold text-cyan-400 leading-none">{score.toString().padStart(4, '0')}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Best</span>
            <div className="flex items-center gap-1 text-2xl font-mono font-bold text-yellow-400 leading-none">
              <Trophy size={16} />
              <span>{highScore.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Game Board Container --- */}
      <div className="relative neon-border-green rounded-lg overflow-hidden glass-panel">
        <canvas 
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="block cursor-none"
        />

        {/* --- Overlays --- */}
        <AnimatePresence>
          {gameState !== 'PLAYING' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 p-8 text-center"
            >
              {gameState === 'IDLE' ? (
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-full border-2 border-green-500 flex items-center justify-center mb-6 animate-pulse shadow-[0_0_20px_rgba(0,255,102,0.4)]">
                    <Play size={40} className="text-green-500 fill-green-500 ml-1" />
                  </div>
                  <h2 className="text-3xl font-black uppercase italic mb-2 tracking-tight">Ready to Hack?</h2>
                  <p className="text-sm opacity-60 mb-8 max-w-[280px]">Use WASD or Arrows to navigate. Swipe on mobile. Avoid walls and yourself.</p>
                  
                  <div className="grid grid-cols-3 gap-4 mb-8 text-[10px] uppercase tracking-tighter">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_#00ff66]" />
                      <span>Standard +10</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_#ffcc00]" />
                      <span>Golden +50</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ff3333]" />
                      <span>Poison -10</span>
                    </div>
                  </div>

                  <button 
                    onClick={startGame}
                    className="px-12 py-4 bg-green-500 text-black font-black uppercase italic tracking-widest rounded-full hover:bg-green-400 transition-all active:scale-95 shadow-[0_0_30px_rgba(0,255,102,0.3)]"
                  >
                    Initialize
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center"
                >
                  <Skull size={64} className="text-red-500 mb-4 animate-bounce" />
                  <h2 className="text-5xl font-black uppercase italic mb-2 tracking-tighter text-red-500">Connection Lost</h2>
                  <p className="text-xl font-mono mb-8 text-cyan-400">Final Score: {score}</p>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={startGame}
                      className="flex items-center gap-2 px-8 py-4 bg-white text-black font-black uppercase italic tracking-widest rounded-full hover:bg-cyan-400 transition-all active:scale-95"
                    >
                      <RotateCcw size={18} />
                      Retry
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Footer / Controls Info --- */}
      <div className="mt-8 flex flex-wrap justify-center gap-8 opacity-30 text-[10px] uppercase tracking-[0.2em] font-bold">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 border border-white rounded">WASD</div>
          <span>Move</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 border border-white rounded">ARROWS</div>
          <span>Move</span>
        </div>
        <div className="flex items-center gap-2">
          <Star size={12} />
          <span>Absolutions.io</span>
        </div>
      </div>
    </div>
  );
}
