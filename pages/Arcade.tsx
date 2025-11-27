import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';

const Arcade = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameInstanceRef = useRef<any>(null);

    useEffect(() => {
        // Load Phaser from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.js';
        script.async = true;
        script.onload = () => {
            initGame();
        };
        document.body.appendChild(script);

        return () => {
            // Cleanup game instance on unmount
            if (gameInstanceRef.current) {
                gameInstanceRef.current.destroy(true);
            }
            document.body.removeChild(script);
        };
    }, []);

    const initGame = () => {
        if (gameInstanceRef.current) return;

        const config = {
            type: (window as any).Phaser.AUTO,
            width: 800,
            height: 400,
            backgroundColor: "#000000",
            parent: gameContainerRef.current,
            physics: {
                default: "arcade",
                arcade: { gravity: { y: 1000 }, debug: false }
            },
            scene: { preload, create, update }
        };

        let player: any, ground: any, cursors: any, obstacles: any, scoreText: any;
        let score = 0;
        let gameOver = false;

        function preload(this: any) {
            // Coalition-themed assets
            this.load.image("player", "/assets/arcade/coalition-runner.png");
            this.load.image("ground", "/assets/arcade/ground.png");
            this.load.image("obstacle", "/assets/arcade/obstacle.png");
        }

        function create(this: any) {
            // Ground
            ground = this.physics.add.staticGroup();
            ground.create(400, 390, "ground").setScale(2).refreshBody();

            // Player
            player = this.physics.add.sprite(100, 300, "player").setScale(0.5);
            player.setCollideWorldBounds(true);

            // Obstacles group
            obstacles = this.physics.add.group();

            // Collisions
            this.physics.add.collider(player, ground);
            this.physics.add.collider(player, obstacles, hitObstacle, null, this);

            // Controls
            cursors = this.input.keyboard.createCursorKeys();
            this.input.on("pointerdown", jump, this);

            // Score display - Coalition style
            scoreText = this.add.text(20, 20, "DISTANCE: 0m", {
                fontSize: "28px",
                color: "#FFFFFF",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 6
            });

            // Add Coalition branding
            this.add.text(400, 30, "COALITION RUNNER", {
                fontSize: "20px",
                color: "#FFD700",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 4
            }).setOrigin(0.5);

            // Spawn obstacles periodically
            this.time.addEvent({
                delay: 1500,
                callback: spawnObstacle,
                callbackScope: this,
                loop: true
            });
        }

        function update(this: any) {
            if (gameOver) return;

            // Auto-jump on input
            if ((cursors.space.isDown || cursors.up.isDown) && player.body.touching.down) {
                jump.call(this);
            }

            // Increment score
            score += 1;
            scoreText.setText("DISTANCE: " + Math.floor(score / 10) + "m");
        }

        function jump(this: any) {
            if (player.body.touching.down) {
                player.setVelocityY(-550);
            }
        }

        function spawnObstacle(this: any) {
            const obs = obstacles.create(830, 345, "obstacle").setVelocityX(-300);
            obs.setScale(0.4);
            obs.setCollideWorldBounds(false);
            obs.setImmovable(true);
        }

        function hitObstacle(this: any, player: any, obs: any) {
            gameOver = true;

            // Game Over text
            this.add.text(400, 160, "GAME OVER", {
                fontSize: "48px",
                color: "#FF4444",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 6
            }).setOrigin(0.5);

            // Final score
            this.add.text(400, 220, "FINAL DISTANCE: " + Math.floor(score / 10) + "m", {
                fontSize: "24px",
                color: "#FFFFFF",
                fontFamily: "Arial Black",
                stroke: "#000000",
                strokeThickness: 4
            }).setOrigin(0.5);

            // Restart instruction
            this.add.text(400, 270, "Refresh page to play again", {
                fontSize: "18px",
                color: "#AAAAAA",
                fontFamily: "Arial"
            }).setOrigin(0.5);

            this.physics.pause();
        }

        gameInstanceRef.current = new (window as any).Phaser.Game(config);
    };

    return (
        <div className="min-h-screen bg-black pt-20 pb-16">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-display font-bold text-white uppercase mb-4">
                        Coalition <span className="text-brand-accent">Arcade</span>
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Play Coalition Runner and compete for the highest score!
                    </p>
                </div>

                {/* Game Container */}
                <div className="bg-gray-900 rounded-xl p-8 mb-8">
                    <div className="flex justify-center">
                        <div
                            ref={gameContainerRef}
                            className="border-4 border-brand-accent rounded-lg overflow-hidden w-[800px] h-[400px]"
                        />
                    </div>
                </div>

                {/* Instructions */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                            How to Play
                        </h3>
                        <ul className="space-y-2 text-gray-400">
                            <li>• <strong className="text-white">SPACE</strong> or <strong className="text-white">UP ARROW</strong> to jump</li>
                            <li>• <strong className="text-white">CLICK/TAP</strong> anywhere to jump</li>
                            <li>• Avoid obstacles to increase your distance</li>
                            <li>• Challenge: Reach 100m!</li>
                        </ul>
                    </div>

                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-white mb-4">Coming Soon</h3>
                        <ul className="space-y-2 text-gray-400">
                            <li>• 🏆 Global Leaderboard</li>
                            <li>• 🎁 High Score Rewards</li>
                            <li>• 🎮 New Game Modes</li>
                            <li>• 🪙 SGCoin Integration</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Arcade;
