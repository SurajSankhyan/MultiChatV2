import React, { useState, useEffect, useRef } from 'react';

export default function SpidermanPet() {
  const [state, setState] = useState('idle'); // idle, walking, climbing, shooting, swinging, falling, shooting-screen
  const [surface, setSurface] = useState('floor'); // floor, left-wall, right-wall, ceiling, capsule-top, capsule-left-wall, capsule-right-wall, air
  const [x, setX] = useState(50); // percentage (0 to 100)
  const [y, setY] = useState(100); // percentage (0 to 100)
  const [rotation, setRotation] = useState(0); // degrees
  const [facingRight, setFacingRight] = useState(true);
  const [webAnchorX, setWebAnchorX] = useState(50);
  const [swingTime, setSwingTime] = useState(0);
  const [isLandingSquish, setIsLandingSquish] = useState(false);

  // Web splatting state
  const [webs, setWebs] = useState([]); // { id, x, y, size, rotation }
  const [screenWebTarget, setScreenWebTarget] = useState(null); // { x, y }

  const containerRef = useRef(null);

  // Targets for movement
  const targetX = useRef(50);
  const targetY = useRef(100);
  const lastStateChange = useRef(Date.now());
  const size = 48; // Spiderman size in px

  // Loop timer and state transitions
  useEffect(() => {
    const getCapsuleBounds = () => {
      const container = containerRef.current?.parentElement;
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      const capsule = container.querySelector('.floating-input-capsule');
      if (!capsule) return null;
      const rect = capsule.getBoundingClientRect();
      
      return {
        left: ((rect.left - containerRect.left) / containerRect.width) * 100,
        right: ((rect.right - containerRect.left) / containerRect.width) * 100,
        top: ((rect.top - containerRect.top) / containerRect.height) * 100,
        bottom: ((rect.bottom - containerRect.top) / containerRect.height) * 100,
      };
    };

    const chooseNewAction = () => {
      const now = Date.now();
      if (now - lastStateChange.current < 1200) return; // Stay in a state for at least 1.2s
      lastStateChange.current = now;

      const cb = getCapsuleBounds();
      const rand = Math.random();

      // Cute screen web-shooting action (15% chance while idle)
      if (state === 'idle' && rand < 0.15 && surface !== 'air') {
        setState('shooting-screen');
        // Choose random target coordinate to splat
        const webX = 15 + Math.random() * 70;
        const webY = 15 + Math.random() * 70;
        setScreenWebTarget({ x: webX, y: webY });

        // Add web splat after a tiny delay
        const id = Date.now();
        setTimeout(() => {
          setWebs(prev => [...prev, {
            id,
            x: webX,
            y: webY,
            size: 35 + Math.random() * 30,
            rotation: Math.random() * 360
          }]);
        }, 120);

        // Reset to idle and clear line after 350ms
        setTimeout(() => {
          setScreenWebTarget(null);
          setState('idle');
        }, 350);

        // Remove web from DOM after it fades out (total 4.5s)
        setTimeout(() => {
          setWebs(prev => prev.filter(w => w.id !== id));
        }, 4500);

        return;
      }

      // Decision making based on current surface
      if (surface === 'floor') {
        if (rand < 0.3) {
          setState('idle');
        } else if (rand < 0.65) {
          // Walk floor
          setState('walking');
          targetX.current = 4 + Math.random() * 92;
          setFacingRight(targetX.current > x);
        } else if (rand < 0.85) {
          // Start climbing left/right wall
          const climbLeft = x < 50;
          setState('walking');
          targetX.current = climbLeft ? 0 : 100;
          setFacingRight(targetX.current > x);
        } else {
          // Shoot web to ceiling and swing!
          setState('shooting');
          setWebAnchorX(x);
          setSwingTime(0);
          setSurface('air');
        }
      } else if (surface === 'capsule-top') {
        if (!cb) {
          setState('falling');
          setSurface('air');
          return;
        }
        if (rand < 0.3) {
          setState('idle');
        } else if (rand < 0.75) {
          // Walk on capsule top
          setState('walking');
          targetX.current = cb.left + 2 + Math.random() * (cb.right - cb.left - 4);
          setFacingRight(targetX.current > x);
        } else {
          // Jump off / Fall off
          setState('falling');
          setSurface('air');
        }
      } else if (surface === 'left-wall' || surface === 'right-wall') {
        if (rand < 0.35) {
          setState('idle');
        } else if (rand < 0.8) {
          // Climb up/down wall
          setState('climbing');
          targetY.current = 6 + Math.random() * 88;
        } else if (y < 20) {
          // Climb to ceiling
          setState('climbing');
          targetY.current = 0;
        } else {
          // Climb to floor
          setState('climbing');
          targetY.current = 100;
        }
      } else if (surface === 'ceiling') {
        if (rand < 0.3) {
          setState('idle');
        } else if (rand < 0.7) {
          // Crawl along ceiling
          setState('walking');
          targetX.current = 4 + Math.random() * 92;
          setFacingRight(targetX.current > x);
        } else if (rand < 0.85) {
          // Shoot web and swing
          setState('shooting');
          setWebAnchorX(x);
          setSwingTime(0);
          setSurface('air');
        } else {
          // Drop from ceiling
          setState('falling');
          setSurface('air');
        }
      } else if (surface === 'capsule-left-wall' || surface === 'capsule-right-wall') {
        if (!cb) {
          setState('falling');
          setSurface('air');
          return;
        }
        if (rand < 0.5) {
          // Climb to capsule top
          setState('climbing');
          targetY.current = cb.top;
        } else {
          // Climb to floor
          setState('climbing');
          targetY.current = 100;
        }
      }
    };

    const interval = setInterval(() => {
      const cb = getCapsuleBounds();

      // Trigger random state changes
      if (state === 'idle' && Math.random() < 0.05) {
        chooseNewAction();
      }

      // Physics and Edge-Constrained Movement
      switch (state) {
        case 'idle':
        case 'shooting-screen':
          // Stand still during idle/splatting
          break;

        case 'walking': {
          const dx = targetX.current - x;
          if (Math.abs(dx) < 0.8) {
            // Arrived at target
            if (surface === 'floor') {
              if (x <= 1) {
                setX(0);
                setSurface('left-wall');
                setState('idle');
              } else if (x >= 99) {
                setX(100);
                setSurface('right-wall');
                setState('idle');
              } else {
                setState('idle');
              }
            } else if (surface === 'ceiling') {
              if (x <= 1) {
                setX(0);
                setSurface('left-wall');
                setState('idle');
              } else if (x >= 99) {
                setX(100);
                setSurface('right-wall');
                setState('idle');
              } else {
                setState('idle');
              }
            } else if (surface === 'capsule-top' && cb) {
              if (x <= cb.left + 1.5) {
                // Climb down capsule left side
                setX(cb.left);
                setSurface('capsule-left-wall');
                setState('climbing');
                targetY.current = cb.top + 5;
              } else if (x >= cb.right - 1.5) {
                // Climb down capsule right side
                setX(cb.right);
                setSurface('capsule-right-wall');
                setState('climbing');
                targetY.current = cb.top + 5;
              } else {
                setState('idle');
              }
            } else {
              setState('idle');
            }
          } else {
            const step = dx > 0 ? 0.55 : -0.55;
            setX(prev => Math.max(0, Math.min(100, prev + step)));
          }
          break;
        }

        case 'climbing': {
          const dy = targetY.current - y;
          if (Math.abs(dy) < 0.8) {
            // Arrived at target
            if (surface === 'left-wall' || surface === 'right-wall') {
              if (y <= 1) {
                setY(0);
                setSurface('ceiling');
                setState('idle');
              } else if (y >= 99) {
                setY(100);
                setSurface('floor');
                setState('idle');
              } else {
                setState('idle');
              }
            } else if (surface === 'capsule-left-wall' || surface === 'capsule-right-wall') {
              if (cb && y <= cb.top + 1) {
                setY(cb.top);
                setX(surface === 'capsule-left-wall' ? cb.left + 2 : cb.right - 2);
                setSurface('capsule-top');
                setState('idle');
              } else if (y >= 99) {
                setY(100);
                setSurface('floor');
                setState('idle');
              } else {
                setState('idle');
              }
            } else {
              setState('idle');
            }
          } else {
            const step = dy > 0 ? 0.55 : -0.55;
            setY(prev => Math.max(0, Math.min(100, prev + step)));
          }
          break;
        }

        case 'shooting':
          setSwingTime(prev => {
            const next = prev + 0.08;
            if (next >= 1.0) {
              setState('swinging');
              setSurface('air');
              return 0;
            }
            return next;
          });
          break;

        case 'swinging': {
          setSwingTime(prev => {
            const next = prev + 0.035;
            // Swing for 7-8 seconds, then drop
            if (next > 11) {
              setState('falling');
              setSurface('air');
              return 0;
            }
            return next;
          });

          // Swing physics: anchor at webAnchorX, pendulum sweep
          const maxAngle = 0.55; // sweep width
          const freq = 2.2; // swing speed
          const angle = maxAngle * Math.sin(swingTime * freq);
          const length = 46; // web length in %

          const nextX = webAnchorX + length * Math.sin(angle);
          const nextY = length * Math.cos(angle);

          setX(nextX);
          setY(nextY);
          setFacingRight(angle > 0);
          break;
        }

        case 'falling': {
          const nextY = y + 1.6; // gravity speed

          // Capsule collision check
          if (cb && x >= cb.left && x <= cb.right && y < cb.top && nextY >= cb.top) {
            setY(cb.top);
            setSurface('capsule-top');
            setState('idle');
            setIsLandingSquish(true);
            setTimeout(() => setIsLandingSquish(false), 250);
          } else if (nextY >= 100) {
            // Floor collision check
            setY(100);
            setSurface('floor');
            setState('idle');
            setIsLandingSquish(true);
            setTimeout(() => setIsLandingSquish(false), 250);
          } else {
            setY(nextY);
          }
          break;
        }

        default:
          setState('idle');
      }
    }, 40);

    return () => clearInterval(interval);
  }, [state, surface, x, y, swingTime, webAnchorX]);

  // Determine Spiderman Rotation based on state and surface
  useEffect(() => {
    let rot = 0;
    if (state === 'climbing') {
      const dy = targetY.current - y;
      rot = dy < 0 ? 0 : 180; // face UP when climbing up, DOWN when climbing down
    } else if (state === 'walking') {
      rot = surface === 'ceiling' ? 180 : 0;
    } else if (state === 'swinging') {
      // Swing angle calculation
      const maxAngle = 0.55;
      const freq = 2.2;
      const angle = maxAngle * Math.sin(swingTime * freq);
      rot = (angle * 180) / Math.PI + 180; // Hang upside down rotated along path
    } else if (state === 'idle') {
      if (surface === 'left-wall' || surface === 'capsule-left-wall') {
        rot = 90; // cling sideways
      } else if (surface === 'right-wall' || surface === 'capsule-right-wall') {
        rot = -90; // cling sideways
      } else if (surface === 'ceiling') {
        rot = 180; // upside down
      } else {
        rot = 0; // stand straight
      }
    } else if (state === 'shooting-screen') {
      rot = 0; // face straight
    } else {
      rot = 0;
    }
    setRotation(rot);
  }, [state, surface, y, swingTime]);

  // Render SVG sprites based on state
  const renderSpidermanSVG = () => {
    const isWalking = state === 'walking';
    const isClimbing = state === 'climbing';
    const isSwinging = state === 'swinging' || state === 'shooting';
    const isFalling = state === 'falling';
    const isShootingScreen = state === 'shooting-screen';

    if (isSwinging) {
      // Upside down hanging pose
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <g style={{ transformOrigin: '50px 50px' }}>
            {/* Left Hanging Leg */}
            <path d="M 44,40 Q 48,22 50,20" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 47,28 L 50,20" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
            
            {/* Right Hanging Leg */}
            <path d="M 56,40 Q 52,22 50,20" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 53,28 L 50,20" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />

            {/* Torso */}
            <path d="M 42,42 L 58,42 L 55,58 L 45,58 Z" fill="#e23636" stroke="#111" strokeWidth="1.2" />
            <path d="M 42,42 L 45,58 L 41,54 L 39,44 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            <path d="M 58,42 L 55,58 L 59,54 L 61,44 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            
            {/* Spider Logo */}
            <circle cx="50" cy="49" r="1.5" fill="#111" />
            <line x1="50" y1="46" x2="50" y2="52" stroke="#111" strokeWidth="1" strokeLinecap="round" />
            
            {/* Hanging Arms */}
            <g className="swing-arm-wobble">
              <path d="M 39,44 Q 30,55 38,62" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 61,44 Q 70,55 62,62" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
            </g>

            {/* Head */}
            <ellipse cx="50" cy="67" rx="14" ry="14" fill="#e23636" stroke="#111" strokeWidth="1.5" />
            
            {/* Web lines on head */}
            <line x1="50" y1="53" x2="50" y2="81" stroke="#111" strokeWidth="0.8" />
            <line x1="36" y1="67" x2="64" y2="67" stroke="#111" strokeWidth="0.8" />
            <path d="M 42,67 A 8,8 0 0,1 58,67" fill="none" stroke="#111" strokeWidth="0.8" />
            <path d="M 42,67 A 8,8 0 0,0 58,67" fill="none" stroke="#111" strokeWidth="0.8" />

            {/* Eyes */}
            <path d="M 37,64 Q 43,60 47,65 Q 44,71 38,68 Z" fill="#000" />
            <path d="M 39,64 Q 43,62 45,65 Q 43,68 40,67 Z" fill="#fff" />
            
            <path d="M 63,64 Q 57,60 53,65 Q 56,71 62,68 Z" fill="#000" />
            <path d="M 61,64 Q 57,62 55,65 Q 57,68 60,67 Z" fill="#fff" />
          </g>
        </svg>
      );
    }

    if (isClimbing || surface === 'left-wall' || surface === 'right-wall' || surface === 'ceiling' || surface === 'capsule-left-wall' || surface === 'capsule-right-wall') {
      // Crawling spread-out pose
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <g>
            {/* Left Crawling Leg */}
            <g className={isWalking || isClimbing ? 'crawl-leg-left' : ''}>
              <path d="M 44,65 Q 22,70 30,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
              <path d="M 27,78 Q 28,83 30,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
            </g>

            {/* Right Crawling Leg */}
            <g className={isWalking || isClimbing ? 'crawl-leg-right' : ''}>
              <path d="M 56,65 Q 78,70 70,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
              <path d="M 73,78 Q 72,83 70,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
            </g>

            {/* Torso */}
            <path d="M 42,46 L 58,46 L 55,66 L 45,66 Z" fill="#e23636" stroke="#111" strokeWidth="1.2" />
            <path d="M 42,46 L 45,66 L 40,62 L 38,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            <path d="M 58,46 L 55,66 L 60,62 L 62,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            
            {/* Spider Logo */}
            <circle cx="50" cy="56" r="1.5" fill="#111" />
            <line x1="50" y1="52" x2="50" y2="60" stroke="#111" strokeWidth="1" strokeLinecap="round" />
            
            {/* Left Crawling Arm */}
            <g className={isWalking || isClimbing ? 'crawl-arm-left' : ''}>
              <path d="M 38,50 Q 20,42 26,26" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
            </g>

            {/* Right Crawling Arm */}
            <g className={isWalking || isClimbing ? 'crawl-arm-right' : ''}>
              <path d="M 62,50 Q 80,42 74,26" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
            </g>

            {/* Head */}
            <ellipse cx="50" cy="30" rx="14" ry="14" fill="#e23636" stroke="#111" strokeWidth="1.5" />
            
            {/* Web lines on head */}
            <line x1="50" y1="16" x2="50" y2="44" stroke="#111" strokeWidth="0.8" />
            <line x1="36" y1="30" x2="64" y2="30" stroke="#111" strokeWidth="0.8" />
            <path d="M 42,30 A 8,8 0 0,1 58,30" fill="none" stroke="#111" strokeWidth="0.8" />
            <path d="M 42,30 A 8,8 0 0,0 58,30" fill="none" stroke="#111" strokeWidth="0.8" />

            {/* Eyes */}
            <path d="M 35,28 Q 42,22 47,29 Q 44,36 37,33 Z" fill="#000" />
            <path d="M 37,28 Q 42,24 45,29 Q 43,33 39,31 Z" fill="#fff" />
            
            <path d="M 65,28 Q 58,22 53,29 Q 56,36 63,33 Z" fill="#000" />
            <path d="M 63,28 Q 58,24 55,29 Q 57,33 61,31 Z" fill="#fff" />
          </g>
        </svg>
      );
    }

    if (isShootingScreen) {
      // Cute wrist-shooting pose pointing at user
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <g>
            {/* Left Leg */}
            <path d="M 44,65 L 42,85 L 36,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 42,76 L 42,85 L 36,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />

            {/* Right Leg */}
            <path d="M 56,65 L 58,85 L 64,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 58,76 L 58,85 L 64,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />

            {/* Torso */}
            <path d="M 42,46 L 58,46 L 55,66 L 45,66 Z" fill="#e23636" stroke="#111" strokeWidth="1.2" />
            <path d="M 42,46 L 45,66 L 40,62 L 38,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            <path d="M 58,46 L 55,66 L 60,62 L 62,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
            
            {/* Left Arm by side */}
            <path d="M 38,48 C 30,52 30,62 34,65" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />

            {/* Right Arm extended forward shooting web */}
            <path d="M 62,48 Q 78,42 84,40" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
            <circle cx="84" cy="40" r="3" fill="#ffffff" stroke="#111" strokeWidth="1" />

            {/* Head slightly tilted */}
            <ellipse cx="50" cy="30" rx="14" ry="14" fill="#e23636" stroke="#111" strokeWidth="1.5" />
            
            {/* Eyes squinting in concentration */}
            <g>
              <path d="M 36,29 Q 42,25 46,29 Q 43,33 38,32 Z" fill="#000" />
              <path d="M 38,29 Q 42,27 44,29 Q 43,31 40,30 Z" fill="#fff" />
              
              <path d="M 64,29 Q 58,25 54,29 Q 57,33 62,32 Z" fill="#000" />
              <path d="M 62,29 Q 58,27 56,29 Q 57,31 60,30 Z" fill="#fff" />
            </g>
          </g>
        </svg>
      );
    }

    // Default: Standing/Idle/Walking/Falling Pose
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <g>
          {/* Left Leg */}
          <g className={isWalking ? 'walk-leg-left' : ''}>
            <path d="M 44,65 L 42,85 L 36,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 42,76 L 42,85 L 36,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
          </g>

          {/* Right Leg */}
          <g className={isWalking ? 'walk-leg-right' : ''}>
            <path d="M 56,65 L 58,85 L 64,85" fill="none" stroke="#2e5bbf" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 58,76 L 58,85 L 64,85" fill="none" stroke="#e23636" strokeWidth="5.5" strokeLinecap="round" />
          </g>

          {/* Torso */}
          <path d="M 42,46 L 58,46 L 55,66 L 45,66 Z" fill="#e23636" stroke="#111" strokeWidth="1.2" />
          <path d="M 42,46 L 45,66 L 40,62 L 38,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
          <path d="M 58,46 L 55,66 L 60,62 L 62,50 Z" fill="#2e5bbf" stroke="#111" strokeWidth="1.2" />
          
          {/* Spider Logo */}
          <circle cx="50" cy="56" r="1.5" fill="#111" />
          <line x1="50" y1="52" x2="50" y2="60" stroke="#111" strokeWidth="1" strokeLinecap="round" />

          {/* Left Arm */}
          <g className={isWalking ? 'walk-arm-left' : isFalling ? 'fall-flail-left' : ''}>
            <path d="M 38,48 C 30,52 30,62 34,65" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
          </g>

          {/* Right Arm */}
          <g className={isWalking ? 'walk-arm-right' : isFalling ? 'fall-flail-right' : ''}>
            <path d="M 62,48 C 70,52 70,62 66,65" fill="none" stroke="#e23636" strokeWidth="4.5" strokeLinecap="round" />
          </g>

          {/* Head */}
          <ellipse cx="50" cy="30" rx="14" ry="14" fill="#e23636" stroke="#111" strokeWidth="1.5" />
          
          {/* Web lines on head */}
          <line x1="50" y1="16" x2="50" y2="44" stroke="#111" strokeWidth="0.8" />
          <line x1="36" y1="30" x2="64" y2="30" stroke="#111" strokeWidth="0.8" />
          <path d="M 42,30 A 8,8 0 0,1 58,30" fill="none" stroke="#111" strokeWidth="0.8" />
          <path d="M 42,30 A 8,8 0 0,0 58,30" fill="none" stroke="#111" strokeWidth="0.8" />

          {/* Eyes */}
          <g className="spidey-eyes">
            <path d="M 35,28 Q 42,22 47,29 Q 44,36 37,33 Z" fill="#000" />
            <path d="M 37,28 Q 42,24 45,29 Q 43,33 39,31 Z" fill="#fff" />
            
            <path d="M 65,28 Q 58,22 53,29 Q 56,36 63,33 Z" fill="#000" />
            <path d="M 63,28 Q 58,24 55,29 Q 57,33 61,31 Z" fill="#fff" />
          </g>
        </g>
      </svg>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        /* Walk Limb Swing Keyframes */
        @keyframes walk-l-arm {
          0% { transform: rotate(-15deg); }
          100% { transform: rotate(15deg); }
        }
        @keyframes walk-r-arm {
          0% { transform: rotate(15deg); }
          100% { transform: rotate(-15deg); }
        }
        @keyframes walk-l-leg {
          0% { transform: rotate(-22deg); }
          100% { transform: rotate(12deg); }
        }
        @keyframes walk-r-leg {
          0% { transform: rotate(12deg); }
          100% { transform: rotate(-22deg); }
        }
        
        .walk-arm-left {
          transform-origin: 38px 48px;
          animation: walk-l-arm 0.28s infinite alternate ease-in-out;
        }
        .walk-arm-right {
          transform-origin: 62px 48px;
          animation: walk-r-arm 0.28s infinite alternate ease-in-out;
        }
        .walk-leg-left {
          transform-origin: 44px 65px;
          animation: walk-l-leg 0.28s infinite alternate ease-in-out;
        }
        .walk-leg-right {
          transform-origin: 56px 65px;
          animation: walk-r-leg 0.28s infinite alternate ease-in-out;
        }

        /* Crawling/Climbing wiggles */
        @keyframes crawl-w-left {
          0% { transform: translate(-3px, -2px) rotate(-12deg); }
          100% { transform: translate(3px, 2px) rotate(12deg); }
        }
        @keyframes crawl-w-right {
          0% { transform: translate(3px, 2px) rotate(12deg); }
          100% { transform: translate(-3px, -2px) rotate(-12deg); }
        }
        .crawl-arm-left {
          transform-origin: 38px 50px;
          animation: crawl-w-left 0.22s infinite alternate ease-in-out;
        }
        .crawl-arm-right {
          transform-origin: 62px 50px;
          animation: crawl-w-right 0.22s infinite alternate ease-in-out;
        }
        .crawl-leg-left {
          transform-origin: 44px 65px;
          animation: crawl-w-right 0.22s infinite alternate ease-in-out;
        }
        .crawl-leg-right {
          transform-origin: 56px 65px;
          animation: crawl-w-left 0.22s infinite alternate ease-in-out;
        }

        /* Flailing drops */
        @keyframes flail-l {
          0% { transform: rotate(-55deg); }
          100% { transform: rotate(-15deg); }
        }
        @keyframes flail-r {
          0% { transform: rotate(15deg); }
          100% { transform: rotate(55deg); }
        }
        .fall-flail-left {
          transform-origin: 38px 48px;
          animation: flail-l 0.12s infinite alternate linear;
        }
        .fall-flail-right {
          transform-origin: 62px 48px;
          animation: flail-r 0.12s infinite alternate linear;
        }

        /* Swinging arm wobble */
        @keyframes swing-wobble {
          0% { transform: scaleX(0.95) rotate(-3deg); }
          100% { transform: scaleX(1.05) rotate(3deg); }
        }
        .swing-arm-wobble {
          transform-origin: 50px 42px;
          animation: swing-wobble 0.5s infinite alternate ease-in-out;
        }

        /* Web Line Goggles */
        .spiderman-web-line {
          filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.75));
        }

        /* Blinking Eyes */
        @keyframes eyes-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.08); }
        }
        .spidey-eyes {
          transform-origin: 50px 30px;
          animation: eyes-blink 3.8s infinite ease-in-out;
        }

        /* Web Shooting effect animation */
        .web-shoot-dash {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: shoot-web-effect 0.3s forwards ease-out;
        }
        @keyframes shoot-web-effect {
          to {
            stroke-dashoffset: 0;
          }
        }

        /* Web splat animation */
        .web-splat {
          position: absolute;
          transform: translate(-50%, -50%);
          animation: web-splat-appear 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, web-splat-fade 0.5s ease-in 3.5s forwards;
          pointer-events: none;
          z-index: 5;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        @keyframes web-splat-appear {
          0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(var(--rot)); opacity: 1; }
        }
        @keyframes web-splat-fade {
          to { opacity: 0; transform: translate(-50%, -50%) scale(0.7) rotate(var(--rot)); }
        }
      `}</style>

      {/* Web splats on the screen */}
      {webs.map(w => (
        <div 
          key={w.id} 
          className="web-splat"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: `${w.size}px`,
            height: `${w.size}px`,
            '--rot': `${w.rotation}deg`
          }}
        >
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            {/* Center splat */}
            <circle cx="50" cy="50" r="4.5" fill="#ffffff" opacity="0.9" />
            
            {/* Radial web lines */}
            <line x1="50" y1="50" x2="50" y2="10" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="50" y2="90" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="10" y2="50" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="90" y2="50" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="22" y2="22" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="78" y2="78" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="78" y2="22" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            <line x1="50" y1="50" x2="22" y2="78" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
            
            {/* Web rings connecting them */}
            <path d="M 50,22 Q 30,30 22,50 Q 30,70 50,78 Q 70,70 78,50 Q 70,30 50,22" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.65" />
            <path d="M 50,34 Q 38,38 34,50 Q 38,62 50,66 Q 62,62 66,50 Q 62,38 50,34" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.65" />
            <path d="M 50,44 Q 45,45 44,50 Q 45,55 50,56 Q 55,55 56,50 Q 55,45 50,44" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.65" />
          </svg>
        </div>
      ))}

      {/* Web swinging/shooting line */}
      {(state === 'swinging' || state === 'shooting') && (
        <svg 
          className="spiderman-web-line" 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 8 
          }}
        >
          <line 
            x1={`${webAnchorX}%`} 
            y1="0" 
            x2={`${x}%`} 
            y2={`${y}%`} 
            stroke="#ffffff" 
            strokeWidth="1.8" 
            className={state === 'shooting' ? "web-shoot-dash" : ""}
          />
        </svg>
      )}

      {/* Web shooting line directly to screen (splat) */}
      {state === 'shooting-screen' && screenWebTarget && (
        <svg 
          className="spiderman-web-line" 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 9 
          }}
        >
          <line 
            x1={`${x}%`} 
            y1={`${y - 4}%`} // Shoot from hands
            x2={`${screenWebTarget.x}%`} 
            y2={`${screenWebTarget.y}%`} 
            stroke="#ffffff" 
            strokeWidth="2.2" 
            className="web-shoot-dash"
          />
        </svg>
      )}

      {/* Spiderman Character element */}
      <div 
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: `${size}px`,
          height: `${size}px`,
          transform: `translate(-50%, -100%) rotate(${rotation}deg) scaleX(${facingRight ? 1 : -1}) ${
            isLandingSquish ? 'scaleY(0.65) scaleX(1.35)' : ''
          }`,
          transformOrigin: '50% 100%',
          transition: 
            state === 'swinging' || state === 'falling' 
              ? 'none' 
              : 'left 0.08s linear, top 0.08s linear, transform 0.18s ease-out',
          zIndex: 10,
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))'
        }}
      >
        {renderSpidermanSVG()}
      </div>
    </div>
  );
}
