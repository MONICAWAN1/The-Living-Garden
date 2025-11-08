import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type p5 from 'p5';

import { socket } from '../socket';
import { WorldState, Spirit, Archetype, ActivityState } from '../types';
import { ActivityMonitor } from '../lib/activityMonitor';
import { renderAnimal } from '../render/renderAnimal';
import { renderCloud } from '../render/renderCloud';
import { renderPlant } from '../render/renderPlant';
import { getAverageColor } from '../lib/colormaps';

// Input coming from your quiz/AI step
export interface SpiritParameters {
  Type: 'Plant' | 'Animal' | 'Cloud';
  Keywords: string;        // e.g., "vibrant, curious"
  ColorCode: string;       // e.g., "#FF6347"
  SizeParam: number;       // 1..100
  MotionSpeed: number;     // 0..1+ (your motion intensity)
  isAwake: boolean;        // maps to ActivityState
}


const P5Sketch: React.FC<{ world: WorldState }> = ({ world }) => {
    const sketchRef = useRef<HTMLDivElement>(null);
    const p5InstanceRef = useRef<p5 | null>(null);
    const spiritsRef = useRef<{ [id: string]: Spirit }>({});

    useEffect(() => {
        // Update ref without causing re-render
        spiritsRef.current = world.spirits;
    }, [world]);

    useEffect(() => {
        const Sketch = (p: p5) => {
            p.setup = () => {
                if (sketchRef.current) {
                    p.createCanvas(sketchRef.current.offsetWidth, sketchRef.current.offsetHeight).parent(sketchRef.current);
                    p.frameRate(30);
                    p.imageMode(p.CENTER);   
                    p.pixelDensity(2);       
                    p.smooth();
                }
            };

            p.draw = () => {
                // FIX: Explicitly type `currentSpirits` to avoid `unknown` type from `Object.values`.
                const currentSpirits: Spirit[] = Object.values(spiritsRef.current);
                
                // Dynamic background based on average spirit color
                const allPalettes = currentSpirits.map(s => s.colorPalette);
                const avgColor = getAverageColor(p, allPalettes);
                const bgColor = p.lerpColor(p.color(avgColor), p.color(10, 10, 20), 0.7);
                p.background(bgColor);

                for (const spirit of currentSpirits) {
                    // Initialize position if not set
                    if (spirit.x === undefined || spirit.y === undefined) {
                        spirit.x = p.random(p.width * 0.1, p.width * 0.9);
                        spirit.y = p.random(p.height * 0.1, p.height * 0.9);
                        spirit.size = p.random(40, 80);
                        spirit.phase = p.random(p.TWO_PI);
                    }

                    switch (spirit.archetype) {
                        case 'animal':
                            renderAnimal(p, spirit);
                            break;
                        case 'cloud':
                            renderCloud(p, spirit);
                            break;
                        case 'plant':
                            renderPlant(p, spirit);
                            break;
                    }
                }
            };

            p.windowResized = () => {
                if (sketchRef.current) {
                    p.resizeCanvas(sketchRef.current.offsetWidth, sketchRef.current.offsetHeight);
                }
            };
        };

        import('p5').then(p5Module => {
            if (sketchRef.current && !p5InstanceRef.current) {
                p5InstanceRef.current = new p5Module.default(Sketch);
            }
        });

        return () => {
            p5InstanceRef.current?.remove();
            p5InstanceRef.current = null;
        };
    }, []);

    return <div ref={sketchRef} className="absolute top-0 left-0 w-full h-full -z-10" />;
};


const Garden: React.FC = () => {
    const [worldState, setWorldState] = useState<WorldState>({ spirits: {} });
    const [spiritId, setSpiritId] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleReborn = () => {
        // Clear local storage to start fresh
        localStorage.removeItem('spiritProfile');
        localStorage.removeItem('spiritId');
        socket.disconnect();
        navigate('/quiz');
    };

    const onStateChange = useCallback((newState: ActivityState) => {
        if (spiritId) {
            socket.emit('spirit:state', { id: spiritId, activityState: newState });
        }
    }, [spiritId]);

    useEffect(() => {
        const profile = localStorage.getItem('spiritProfile');
        if (!profile) {
            navigate('/quiz');
            return;
        }

        const base = JSON.parse(profile) as Omit<Spirit, 'id' | 'activityState'>;
        console.log('[Garden] Loaded AI profile from localStorage:', base);

        // Stable id across sessions
        const id = localStorage.getItem('spiritId') ?? `spirit_${crypto.randomUUID()}`;
        localStorage.setItem('spiritId', id);

        // Construct a full Spirit using the AI data
        const spirit: Spirit = {
        id,
        activityState: 'active', // start as active (can be updated by ActivityMonitor)
        ...base,
        };

        setSpiritId(spirit.id);

        socket.connect();
                
        const onConnect = () => {
            console.log('[Garden] Socket connected, upserting spirit', spirit);
            socket.emit('spirit:upsert', spirit);
        };


        const onWorldUpdate = (newWorldState: WorldState) => {
            console.log('[Garden] world:update', newWorldState);
            setWorldState(newWorldState);
        };
        socket.on('world:update', onWorldUpdate);

        const activityMonitor = new ActivityMonitor(onStateChange);
        activityMonitor.start();

        return () => {
            socket.off('world:update', onWorldUpdate);
            socket.disconnect();
            activityMonitor.stop();
        };
    }, [navigate, onStateChange]);

    const spiritCount = Object.keys(worldState.spirits).length;

    return (
        <div className="relative w-screen h-screen overflow-hidden font-serif">
            <P5Sketch world={worldState} />
            <div className="absolute top-0 left-0 p-4 md:p-6 text-white mix-blend-difference">
                <h1 className="text-2xl md:text-3xl font-bold">The Living Garden</h1>
                <p className="text-md md:text-lg">{spiritCount} {spiritCount === 1 ? 'spirit' : 'spirits'} currently present.</p>
            </div>
            <div className="absolute bottom-0 right-0 p-4 md:p-6">
                <button
                    onClick={handleReborn}
                    className="bg-slate-800/50 backdrop-blur-sm border border-slate-600 text-slate-200 px-5 py-2 rounded-lg text-md hover:bg-teal-800/70 hover:border-teal-500 transition-all duration-300"
                >
                    Reborn
                </button>
            </div>
        </div>
    );
};

export default Garden;