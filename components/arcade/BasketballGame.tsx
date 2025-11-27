import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Trophy, RotateCcw, Coins } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const HOOP_Y = 100;
const HOOP_X_CENTER = 0; // Relative to center
const BALL_START_Y = 400;

const BasketballGame = () => {
    const { user, updateUser } = useApp();
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
    const [ballPos, setBallPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [coinsEarned, setCoinsEarned] = useState(0);
    
    const controls = useAnimation();
    const containerRef = useRef<HTMLDivElement>(null);

    // Load high score from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('coalition_hoops_highscore');
        if (saved) setHighScore(parseInt(saved));
    }, []);

    const handleDragStart = () => {
        if (gameState !== 'playing') setGameState('playing');
        setIsDragging(true);
    };

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsDragging(false);
        
        // Calculate velocity based on drag
        // Invert drag to throw
        const velocityX = -info.offset.x * 2; 
        const velocityY = -info.offset.y * 2;

        // Animate the throw
        await controls.start({
            x: velocityX,
            y: -Math.abs(velocityY) - 200, // Arc up
            transition: { duration: 0.8, ease: "easeOut" }
        });

        // Simple collision check (very basic for MVP)
        // Check if ball landed near the hoop coordinates
        // We'd need more complex physics for a real "swish", but this works for a mini-game
        const landedX = velocityX;
        const landedY = -Math.abs(velocityY) - 200;

        // Hoop is roughly at x=0, y=-300 (relative to start)
        // Let's approximate success range
        const isHit = Math.abs(landedX) < 50 && landedY < -250 && landedY > -450;

        if (isHit) {
            handleScore();
            // Reset ball
            controls.set({ x: 0, y: 0 });
        } else {
            handleMiss();
            // Reset ball
            controls.set({ x: 0, y: 0 });
        }
    };

    const handleScore = () => {
        const newScore = score + 1;
        setScore(newScore);
        
        // Reward logic: 1 coin every 5 points
        if (newScore % 5 === 0) {
            const earned = coinsEarned + 1;
            setCoinsEarned(earned);
            if (user) {
                updateUser({ sgCoinBalance: (user.sgCoinBalance || 0) + 1 });
            }
        }

        if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('coalition_hoops_highscore', newScore.toString());
        }
    };

    const handleMiss = () => {
        setGameState('gameover');
    };

    const resetGame = () => {
        setScore(0);
        setCoinsEarned(0);
        setGameState('start');
        controls.set({ x: 0, y: 0 });
    };

    return (
        <div className="flex flex-col items-center justify-center w-full h-[600px] bg-gray-900 rounded-xl overflow-hidden relative select-none touch-none">
            {/* Score HUD */}
            <div className="absolute top-4 left-4 right-4 flex justify-between text-white z-10">
                <div className="bg-black/50 px-4 py-2 rounded-full border border-white/10">
                    <span className="text-2xl font-bold font-display">{score}</span>
                    <span className="text-xs text-gray-400 uppercase ml-2">Points</span>
                </div>
                <div className="flex gap-2">
                    <div className="bg-brand-accent/20 px-4 py-2 rounded-full border border-brand-accent/30 flex items-center">
                        <Coins className="w-4 h-4 text-brand-accent mr-2" />
                        <span className="font-bold text-brand-accent">{coinsEarned}</span>
                    </div>
                    <div className="bg-black/50 px-4 py-2 rounded-full border border-white/10 flex items-center">
                        <Trophy className="w-4 h-4 text-yellow-500 mr-2" />
                        <span className="font-bold">{highScore}</span>
                    </div>
                </div>
            </div>

            {/* The Hoop */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-32 h-32 flex flex-col items-center">
                <div className="w-24 h-2 bg-orange-500 rounded-sm mb-1"></div> {/* Backboard line */}
                <div className="w-32 h-24 border-4 border-white/20 rounded-lg relative bg-white/5 backdrop-blur-sm">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-4 border-orange-500 rounded-full"></div> {/* Rim */}
                    <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-14 h-20 border-x-2 border-b-2 border-white/30 rounded-b-xl skew-x-12"></div> {/* Net approximation */}
                </div>
            </div>

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                    <h2 className="text-4xl font-display font-bold text-white mb-2">GAME OVER</h2>
                    <p className="text-gray-400 mb-8">You scored {score} points!</p>
                    
                    {coinsEarned > 0 && (
                        <div className="mb-8 bg-brand-accent/10 p-4 rounded-lg border border-brand-accent/30 animate-pulse">
                            <p className="text-brand-accent font-bold flex items-center justify-center">
                                <Coins className="w-5 h-5 mr-2" />
                                You earned {coinsEarned} SGCoin!
                            </p>
                        </div>
                    )}

                    <button 
                        onClick={resetGame}
                        className="bg-white text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-gray-200 flex items-center"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                    </button>
                </div>
            )}

            {/* Start Screen */}
            {gameState === 'start' && (
                <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-white font-bold text-xl animate-bounce">Drag & Release to Shoot!</p>
                </div>
            )}

            {/* The Ball */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing">
                <motion.div
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    dragElastic={0.2}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    animate={controls}
                    whileDrag={{ scale: 1.1 }}
                    className="w-16 h-16 bg-orange-600 rounded-full shadow-lg relative overflow-hidden border-2 border-black/20"
                >
                    {/* Ball Lines */}
                    <div className="absolute inset-0 border-2 border-black/30 rounded-full"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-black/30"></div>
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-0.5 bg-black/30"></div>
                </motion.div>
                
                {/* Drag Indicator / Trajectory Hint (Static for now) */}
                {isDragging && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4">
                        <div className="w-1 h-8 bg-white/20 rounded-full mx-auto"></div>
                    </div>
                )}
            </div>
            
            {/* Floor */}
            <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black to-transparent opacity-50 pointer-events-none"></div>
        </div>
    );
};

export default BasketballGame;
