import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowLeft, RotateCcw } from 'lucide-react';

const Arcade = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameInstanceRef = useRef<any>(null);
    const [highScore, setHighScore] = useState(() => {
        return parseInt(localStorage.getItem('coalitionHoopsHighScore') || '0');
    });

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.js';
        script.async = true;
        script.onload = () => {
            initGame();
        };
        document.body.appendChild(script);

        return () => {
            if (gameInstanceRef.current) {
                gameInstanceRef.current.destroy(true);
            }
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const initGame = () => {
        if (gameInstanceRef.current) return;

        const config = {
            type: (window as any).Phaser.AUTO,
            width: 600,
            height: 800,
            backgroundColor: "#1a1a1a",
            parent: gameContainerRef.current,
            physics: {
                default: "matter",
                matter: {
                    gravity: { y: 1.2 }, // Reduced gravity for better feel
                    debug: false
                }
            },
            scene: { preload, create, update }
        };

        let ball: any, hoop: any, backboard: any, net: any;
        let leftRim: any, rightRim: any;
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let score = 0, misses = 0;
        let scoreText: any, timeText: any, highScoreText: any;
        let gameTime = 60;
        let gameActive = true;
        let scored = false;
        let ballsShot = 0;
        let graphics: any;

        function preload(this: any) {
            this.load.image("ball", "/assets/arcade/coalition-basketball.png");
            this.load.image("hoop", "/assets/arcade/basketball-hoop.png");
            this.load.image("court", "/assets/arcade/basketball-court.png");
        }

        function create(this: any) {
            // Background
            const bg = this.add.image(300, 400, "court");
            bg.setDisplaySize(600, 800);

            // Graphics for drag line
            graphics = this.add.graphics();

            // Hoop and backboard
            hoop = this.add.image(300, 200, "hoop");
            hoop.setScale(0.6);

            // Backboard (invisible physics body)
            backboard = this.matter.add.rectangle(300, 160, 180, 10, {
                isStatic: true,
                label: 'backboard',
                friction: 0.5,
                restitution: 0.5
            });

            // Rim Colliders (Left and Right edges of the hoop)
            // Hoop is at 300, 200. Scale 0.6.
            // Adjust positions to match the visual hoop
            leftRim = this.matter.add.circle(255, 200, 5, {
                isStatic: true,
                label: 'rim',
                friction: 0.2,
                restitution: 0.8
            });

            rightRim = this.matter.add.circle(345, 200, 5, {
                isStatic: true,
                label: 'rim',
                friction: 0.2,
                restitution: 0.8
            });

            // Net sensor (score detection) - positioned below the rim
            net = this.matter.add.rectangle(300, 230, 60, 10, {
                isStatic: true,
                isSensor: true,
                label: 'net'
            });

            // Basketball
            resetBall.call(this);

            // UI - Title
            this.add.text(300, 40, "COALITION HOOPS", {
                fontSize: "32px",
                color: "#FFD700",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 4
            }).setOrigin(0.5);

            // Score
            scoreText = this.add.text(20, 80, "SCORE: 0", {
                fontSize: "24px",
                color: "#FFFFFF",
                fontFamily: "Arial Black"
            });

            // High Score
            const savedHighScore = parseInt(localStorage.getItem('coalitionHoopsHighScore') || '0');
            highScoreText = this.add.text(580, 80, `BEST: ${savedHighScore}`, {
                fontSize: "20px",
                color: "#FFD700",
                fontFamily: "Arial Black"
            }).setOrigin(1, 0);

            // Time
            timeText = this.add.text(300, 750, "TIME: 60", {
                fontSize: "28px",
                color: "#FF4444",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 4
            }).setOrigin(0.5);

            // Instructions
            this.add.text(300, 500, "DRAG & RELEASE TO SHOOT", {
                fontSize: "18px",
                color: "#AAAAAA",
                fontFamily: "Arial"
            }).setOrigin(0.5);

            // Mouse controls
            this.input.on('pointerdown', (pointer: any) => {
                if (!gameActive) return;
                const distance = Phaser.Math.Distance.Between(
                    pointer.x, pointer.y,
                    ball.x, ball.y
                );
                // Allow grabbing anywhere if ball is static, or near ball
                if (ball.isStatic || distance < 100) {
                    isDragging = true;
                    dragStartX = pointer.x;
                    dragStartY = pointer.y;
                    ball.setStatic(true);
                }
            });

            this.input.on('pointermove', (pointer: any) => {
                if (isDragging && gameActive) {
                    // Draw trajectory line
                    graphics.clear();
                    graphics.lineStyle(4, 0xFFD700, 0.8);
                    graphics.beginPath();
                    graphics.moveTo(ball.x, ball.y);
                    graphics.lineTo(ball.x + (dragStartX - pointer.x), ball.y + (dragStartY - pointer.y));
                    graphics.strokePath();
                }
            });

            this.input.on('pointerup', (pointer: any) => {
                if (!gameActive || !isDragging) return;
                isDragging = false;
                graphics.clear();

                // Increased velocity multiplier significantly
                const power = 0.18;
                const velocityX = (dragStartX - pointer.x) * power;
                const velocityY = (dragStartY - pointer.y) * power;

                ball.setStatic(false);
                ball.setVelocity(velocityX, velocityY);
                // Add some spin
                ball.setAngularVelocity(velocityX * 0.05);

                scored = false;
                ballsShot++;
            });

            // Collision detection
            this.matter.world.on('collisionstart', (event: any) => {
                event.pairs.forEach((pair: any) => {
                    if ((pair.bodyA.label === 'net' || pair.bodyB.label === 'net') && !scored) {
                        const ballBody = pair.bodyA.label === 'Circle Body' ? pair.bodyA : pair.bodyB;
                        // Check if ball is moving down
                        if (ballBody.velocity.y > 0) {
                            score += 2;
                            scored = true;
                            scoreText.setText("SCORE: " + score);

                            // Update high score
                            const currentHigh = parseInt(localStorage.getItem('coalitionHoopsHighScore') || '0');
                            if (score > currentHigh) {
                                localStorage.setItem('coalitionHoopsHighScore', score.toString());
                                highScoreText.setText(`BEST: ${score}`);
                                setHighScore(score);
                            }

                            // Flash effect
                            this.cameras.main.flash(200, 255, 215, 0);

                            // Floating text
                            const floatText = this.add.text(300, 250, "+2", {
                                fontSize: "40px",
                                color: "#FFD700",
                                fontFamily: "Arial Black",
                                stroke: "#000000",
                                strokeThickness: 4
                            }).setOrigin(0.5);

                            this.tweens.add({
                                targets: floatText,
                                y: 200,
                                alpha: 0,
                                duration: 1000,
                                onComplete: () => floatText.destroy()
                            });
                        }
                    }
                });
            });

            // Timer
            this.time.addEvent({
                delay: 1000,
                callback: () => {
                    if (gameActive) {
                        gameTime--;
                        timeText.setText("TIME: " + gameTime);
                        if (gameTime <= 0) {
                            endGame.call(this);
                        }
                    }
                },
                loop: true
            });
        }

        function update(this: any) {
            if (!gameActive) return;

            // Reset ball if it goes off screen
            if (ball.y > 850 || ball.x < -50 || ball.x > 650) {
                if (!scored && ballsShot > 0) {
                    misses++;
                }
                resetBall.call(this);
            }
        }

        function resetBall(this: any) {
            if (ball) ball.destroy();
            ball = this.matter.add.image(300, 650, "ball");
            ball.setCircle(25);
            ball.setMass(1);
            ball.setFriction(0.005);
            ball.setBounce(0.6);
            ball.setScale(0.15);
            scored = false;
        }

        function endGame(this: any) {
            gameActive = false;

            // Darken screen
            const overlay = this.add.rectangle(300, 400, 600, 800, 0x000000, 0.8);

            // Game Over
            this.add.text(300, 250, "GAME OVER", {
                fontSize: "48px",
                color: "#FF4444",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 6
            }).setOrigin(0.5).setDepth(100);

            // Final Score
            this.add.text(300, 330, `FINAL SCORE: ${score}`, {
                fontSize: "32px",
                color: "#FFFFFF",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);

            // Accuracy
            const accuracy = ballsShot > 0 ? ((score / 2) / ballsShot * 100).toFixed(0) : 0;
            this.add.text(300, 390, `Accuracy: ${accuracy}%`, {
                fontSize: "24px",
                color: "#FFD700",
                fontFamily: "Arial"
            }).setOrigin(0.5).setDepth(100);

            // High Score
            const finalHigh = parseInt(localStorage.getItem('coalitionHoopsHighScore') || '0');
            if (score >= finalHigh) {
                this.add.text(300, 450, "🏆 NEW HIGH SCORE! 🏆", {
                    fontSize: "28px",
                    color: "#FFD700",
                    fontFamily: "Arial Black"
                }).setOrigin(0.5).setDepth(100);
            }

            // Restart hint
            this.add.text(300, 550, "Refresh page to play again", {
                fontSize: "20px",
                color: "#AAAAAA",
                fontFamily: "Arial"
            }).setOrigin(0.5).setDepth(100);
        }

        gameInstanceRef.current = new (window as any).Phaser.Game(config);
    };

    const handleRestart = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-black pt-20 pb-16">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl md:text-6xl font-display font-bold text-white uppercase mb-2">
                                Coalition <span className="text-brand-accent">Hoops</span>
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Shoot as many baskets as you can in 60 seconds!
                            </p>
                        </div>
                        <button
                            onClick={handleRestart}
                            className="flex items-center gap-2 bg-brand-accent text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-400 transition"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Restart
                        </button>
                    </div>
                </div>

                {/* Game Container */}
                <div className="bg-gray-900 rounded-xl p-8 mb-8">
                    <div className="flex justify-center">
                        <div
                            ref={gameContainerRef}
                            className="border-4 border-brand-accent rounded-lg overflow-hidden w-[600px] h-[800px]"
                        />
                    </div>
                </div>

                {/* Instructions & Stats */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                            How to Play
                        </h3>
                        <ul className="space-y-2 text-gray-400 text-sm">
                            <li>• <strong className="text-white">DRAG</strong> the ball backward</li>
                            <li>• <strong className="text-white">RELEASE</strong> to shoot</li>
                            <li>• Each basket = <strong className="text-yellow-400">2 points</strong></li>
                            <li>• You have <strong className="text-red-400">60 seconds</strong></li>
                        </ul>
                    </div>

                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-white mb-4">Your Best</h3>
                        <div className="text-center">
                            <div className="text-5xl font-bold text-brand-accent mb-2">{highScore}</div>
                            <div className="text-gray-400 text-sm">High Score</div>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-white mb-4">Coming Soon</h3>
                        <ul className="space-y-2 text-gray-400 text-sm">
                            <li>• 🏆 Global Leaderboard</li>
                            <li>• 🎁 Score Rewards</li>
                            <li>• 🔥 Combo Multipliers</li>
                            <li>• 🪙 SGCoin Prizes</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Arcade;
