'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, User, CheckCircle2, X, MessageSquare, Zap, Globe, ChevronDown } from 'lucide-react';
import { PortalModal } from '@/components/ui/PortalModal';
import Link from 'next/link';
import ParticlesComponent from '@/components/ui/particles-bg';
import { InteractiveRobotSpline } from '@/components/ui/interactive-3d-robot';
import { motion, AnimatePresence } from 'framer-motion';
import './style.css';

// -------------------------------------------------------------
// COMPREHENSIVE COUNTRIES LIST
// -------------------------------------------------------------
const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guyana", "Haiti",
  "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
  "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro",
  "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
  "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// -------------------------------------------------------------
// TYPEWRITER ANIMATION COMPONENT
// -------------------------------------------------------------
const TypewriterTitle = ({ isToggled }: { isToggled: boolean }) => {
  const welcomeVariants = [
    'Welcome!',                  // English
    'स्वागत है!',                 // Hindi
    'স্বাগতম!',                   // Bengali
    'सुस्वागतम!',                // Marathi
    'స్వాగతం!',                   // Telugu
    'நல்வரவு!',                  // Tamil
    'print("Welcome!")',         // Python
  ];

  const welcomeBackVariants = [
    'Welcome Back!',             // English
    'फिर से स्वागत है!',          // Hindi
    'আবার স্বাগতম!',             // Bengali
    'पुन्हा स्वागत आहे!',         // Marathi
    'మళ్లీ స్వాగతం!',            // Telugu
    'மீண்டும் வருக!',             // Tamil
    'print("Welcome Back!")',    // Python
  ];

  const variants = isToggled ? welcomeVariants : welcomeBackVariants;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseTime = 1500;

  useEffect(() => {
    // Reset to start when toggled state changes
    setCurrentIdx(0);
    setDisplayedText('');
    setIsDeleting(false);
  }, [isToggled]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const tick = () => {
      const fullText = variants[currentIdx];

      if (!isDeleting) {
        setDisplayedText(fullText.substring(0, displayedText.length + 1));
        if (displayedText === fullText) {
          timer = setTimeout(() => {
            setIsDeleting(true);
          }, pauseTime);
          return;
        }
      } else {
        setDisplayedText(fullText.substring(0, displayedText.length - 1));
        if (displayedText === '') {
          setIsDeleting(false);
          // Move to next language variant in loop
          setCurrentIdx((prev) => (prev + 1) % variants.length);
          return;
        }
      }

      const nextSpeed = isDeleting ? deletingSpeed : typingSpeed;
      timer = setTimeout(tick, nextSpeed);
    };

    timer = setTimeout(tick, 100);
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, currentIdx, variants]);

  return (
    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center min-h-[40px] select-none">
      <span>{displayedText}</span>
      <span className="w-[3px] h-[30px] bg-primary ml-1.5 animate-[pulse_1s_infinite] inline-block shrink-0 shadow-[0_0_8px_var(--primary)]" />
    </h1>
  );
};

// -------------------------------------------------------------
// PASSWORD STRENGTH HELPER FUNCTION
// -------------------------------------------------------------
const getPasswordStrength = (pass: string) => {
  if (!pass) return { score: 0, label: '', color: 'transparent', textColor: 'transparent' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444', textColor: '#ef4444' };
  if (score <= 4) return { score, label: 'Medium', color: '#eab308', textColor: '#eab308' };
  return { score, label: 'Strong', color: '#22c55e', textColor: '#22c55e' };
};

// -------------------------------------------------------------
// MAIN UNIFIED AUTH COMPONENT
// -------------------------------------------------------------

export interface UnifiedAuthProps {
  initialToggled?: boolean;
}

const ROBOT_SCENE_URL = 'https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode';

export function UnifiedAuth({ initialToggled = false }: UnifiedAuthProps) {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const redirectUrl = nextParam ? decodeURIComponent(nextParam) : '/dashboard';
  const prefillEmail = searchParams.get('email') || '';

  // Setup / Toggling state
  const [isToggled, setIsToggled] = useState(initialToggled || !!prefillEmail);

  // Sync state on history push/pop
  useEffect(() => {
    const handlePopState = () => {
      setIsToggled(window.location.pathname === '/signup');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Form states - Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Form states - Signup
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState(prefillEmail);
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupCountry, setSignupCountry] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Real-time username validation states
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setForgotError(error.message);
    } else {
      setForgotMessage('Password reset link sent to your email!');
    }
    setForgotLoading(false);
  };

  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndPrefill = async () => {
      if (typeof window === 'undefined') return;

      const isSignupPath = window.location.pathname === '/signup';

      if (!isSignupPath) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Streamer';
          const avatar = username.charAt(0).toUpperCase();
          const cleanOrigin = typeof window !== 'undefined' && window.location.origin.includes('--')
            ? `${window.location.protocol}//${window.location.origin.split('--')[1]}`
            : (typeof window !== 'undefined' ? window.location.origin : '');
          window.location.href = `${cleanOrigin}/dashboard?username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;
          return;
        }
      } else {
        if (!prefillEmail) {
          // 1. Direct visit to /signup with no email query parameter
          window.location.href = '/login';
          return;
        }

        // 2. We have a prefillEmail in the URL, verify it against the actual logged-in Supabase user session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email || user.email.toLowerCase() !== prefillEmail.toLowerCase()) {
          // Security violation: user is either not logged in, or has edited the URL email parameter
          console.warn('URL email query parameter mismatch with authenticated session!');
          await supabase.auth.signOut();
          window.location.href = '/login';
          return;
        }

        // 3. Verify if they have already completed their registration (username is already set)
        const { data: existingUser } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();

        if (existingUser && existingUser.username) {
          // Registration is already complete! Redirect to overview
          console.log('User already registered. Redirecting to overview.');
          const username = existingUser.username;
          const avatar = username.charAt(0).toUpperCase();
          const cleanOrigin = typeof window !== 'undefined' && window.location.origin.includes('--')
            ? `${window.location.protocol}//${window.location.origin.split('--')[1]}`
            : (typeof window !== 'undefined' ? window.location.origin : '');
          window.location.href = `${cleanOrigin}/dashboard?username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;
          return;
        }

        // Verification successful, safe to prefill the email input
        setSignupEmail(prefillEmail);
      }
    };

    checkAuthAndPrefill();
  }, [prefillEmail, supabase]);

  // Real-time username availability validation (with debounce)
  useEffect(() => {
    if (!signupUsername.trim()) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    const trimmed = signupUsername.trim();
    // Validate format (3-20 alphanumeric, spaces or underscore characters)
    const validFormat = /^[a-zA-Z0-9_ ]{3,20}$/.test(trimmed);
    if (!validFormat) {
      setUsernameAvailable(false);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .ilike('username', trimmed)
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setUsernameAvailable(false);
        } else {
          setUsernameAvailable(true);
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [signupUsername, supabase]);

  // Handlers - Toggle Route
  const handleToggleToSignup = (e: React.MouseEvent) => {
    e.preventDefault();
    if (prefillEmail) return;
    // Immediately open Google OAuth Signup flow (Account Chooser)
    handleGoogleSignup();
  };

  const handleToggleToSignin = (e: React.MouseEvent) => {
    e.preventDefault();
    if (prefillEmail) return;
    setIsToggled(false);
    // Reset state values
    setSignupUsername('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setSignupCountry('');
    setIsCountryDropdownOpen(false);
    setCountrySearch('');
    setSignupError(null);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError(null);
    window.history.pushState(null, '', `/login${window.location.search}`);
  };

  // Handlers - Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    // 1. Check if user exists in our 'users' table
    const { data: userExists } = await supabase
      .from('users')
      .select('email')
      .eq('email', loginEmail.toLowerCase())
      .single();

    if (!userExists) {
      setLoginError('Create a New Account first');
      setLoginLoading(false);
      return;
    }

    // 2. Attempt login
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setLoginError('Password is incorrect');
      } else {
        setLoginError(error.message);
      }
      setLoginLoading(false);
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const username = session.user?.user_metadata?.username || session.user?.email?.split('@')[0] || 'Streamer';
        const avatar = username.charAt(0).toUpperCase();
        const divider = redirectUrl.includes('?') ? '&' : '?';
        const finalUrl = `${redirectUrl}${divider}username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;
        if (redirectUrl.startsWith('http')) {
          window.location.href = `${finalUrl}#access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
        } else {
          const cleanOrigin = getCleanOrigin();
          window.location.href = `${cleanOrigin}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
        }
      } else {
        const cleanOrigin = getCleanOrigin();
        window.location.href = `${cleanOrigin}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
      }
    }
  };

  // Handlers - Signup Submit
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUsername = signupUsername.trim();
    const validFormat = /^[a-zA-Z0-9_ ]{3,20}$/.test(trimmedUsername);
    if (!validFormat) {
      setSignupError('Username must be 3-20 characters (alphanumeric, spaces or underscores)');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }

    if (getPasswordStrength(signupPassword).label === 'Weak') {
      setSignupError('Please use a stronger password');
      return;
    }

    if (!signupCountry) {
      setSignupError('Please select your country');
      return;
    }

    if (usernameAvailable === false) {
      setSignupError('Username is already taken');
      return;
    }

    setSignupLoading(true);
    setSignupError(null);

    // Fallback double check username uniqueness
    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('username')
        .ilike('username', trimmedUsername)
        .limit(1);

      if (checkError) throw checkError;

      if (existingUser && existingUser.length > 0) {
        setSignupError('Username is already taken');
        setSignupLoading(false);
        return;
      }
    } catch (err) {
      console.error('Username uniqueness verification failed:', err);
    }

    if (prefillEmail) {
      // Google OAuth Callback Setup username, password, & country
      const { error } = await supabase.auth.updateUser({
        password: signupPassword,
        data: {
          username: signupUsername,
          full_name: signupUsername,
          country: signupCountry,
        }
      });

      if (error) {
        setSignupError(error.message);
        setSignupLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        await supabase.from('users').upsert({
          id: sessionData.session.user.id,
          email: prefillEmail,
          username: signupUsername,
          country: signupCountry,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      const targetUrl = redirectUrl || '/dashboard';
      if (session) {
        const username = session.user?.user_metadata?.username || session.user?.email?.split('@')[0] || 'Streamer';
        const avatar = username.charAt(0).toUpperCase();
        const divider = targetUrl.includes('?') ? '&' : '?';
        const finalUrl = `${targetUrl}${divider}username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;
        if (targetUrl.startsWith('http')) {
          window.location.href = `${finalUrl}#access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
        } else {
          window.location.href = finalUrl;
        }
      } else {
        window.location.href = targetUrl;
      }
      return;
    }

    // Manual Signup
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          username: signupUsername,
          full_name: signupUsername,
          country: signupCountry,
        },
        emailRedirectTo: `${getCleanOrigin()}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
      }
    });

    if (error) {
      setSignupError(error.message);
      setSignupLoading(false);
    } else {
      setSignupSuccess(true);
      setSignupLoading(false);
    }
  };

  const getCleanOrigin = () => {
    if (typeof window === 'undefined') return '';
    let origin = window.location.origin;
    if (origin.includes('--')) {
      const parts = origin.split('--');
      origin = `${window.location.protocol}//${parts[1]}`;
    }
    return origin;
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getCleanOrigin()}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
        queryParams: {
          prompt: 'select_account',
        }
      },
    });
  };

  // Google OAuth Signup
  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getCleanOrigin()}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
        queryParams: {
          prompt: 'select_account',
        }
      },
    });
  };

  const handleCancel = async () => {
    try {
      // Call Postgres function to delete the user's auth account
      await supabase.rpc('delete_current_user');
    } catch (err) {
      console.error('Error deleting user on cancel:', err);
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const isPasswordRevealed = (isToggled && (showSignupPassword || showSignupConfirmPassword)) || (!isToggled && showLoginPassword);

  const lastRealMousePosRef = useRef({ x: 0, y: 0 });
  const currentSimulatedPosRef = useRef({ x: 0, y: 0 });
  const isInterpolatingRef = useRef(false);
  const transitionFramesRef = useRef(0);
  const prevPasswordRevealedRef = useRef(isPasswordRevealed);

  // Keep track of the last real mouse position
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateRealMousePos = (e: MouseEvent) => {
      // @ts-ignore
      if (e.isSimulated) return;
      lastRealMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', updateRealMousePos, { passive: true });
    window.addEventListener('pointermove', updateRealMousePos, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateRealMousePos);
      window.removeEventListener('pointermove', updateRealMousePos);
    };
  }, []);

  // Set frame counter to interpolate back smoothly when password is hidden back
  useEffect(() => {
    if (prevPasswordRevealedRef.current && !isPasswordRevealed) {
      transitionFramesRef.current = 20; // 20 frames (around 330ms) of smooth pan back
    }
    prevPasswordRevealedRef.current = isPasswordRevealed;
  }, [isPasswordRevealed]);

  // Coordinated look-at target interpolation loop
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number;
    let isMounted = true;

    // Cache elements once at the start of the effect to avoid layout thrashing in requestAnimationFrame
    let welcomeEl = document.querySelector('.left-panel-welcome') as HTMLElement | null;
    let canvas = document.querySelector('.spline-embed canvas') as HTMLCanvasElement | null;

    // Initialize current simulated position to screen center or current real position
    if (currentSimulatedPosRef.current.x === 0 && currentSimulatedPosRef.current.y === 0) {
      currentSimulatedPosRef.current = { 
        x: lastRealMousePosRef.current.x || window.innerWidth / 2, 
        y: lastRealMousePosRef.current.y || window.innerHeight / 2 
      };
    }

    const animate = () => {
      if (!isMounted) return;

      // Lazy check in case they weren't loaded on mount
      if (!canvas) canvas = document.querySelector('.spline-embed canvas');
      if (!welcomeEl) welcomeEl = document.querySelector('.left-panel-welcome');

      if (canvas) {
        let targetX = lastRealMousePosRef.current.x;
        let targetY = lastRealMousePosRef.current.y;

        if (isPasswordRevealed && welcomeEl) {
          const rect = welcomeEl.getBoundingClientRect();
          targetX = rect.left + rect.width / 2;
          targetY = rect.top + rect.height / 2;
        }

        // Smoothly ease current coordinates towards the target coordinates (spring damping)
        const dx = targetX - currentSimulatedPosRef.current.x;
        const dy = targetY - currentSimulatedPosRef.current.y;
        
        // Faster interpolation speed when looking back to the cursor
        const easeSpeed = isPasswordRevealed ? 0.08 : 0.18;
        currentSimulatedPosRef.current.x += dx * easeSpeed;
        currentSimulatedPosRef.current.y += dy * easeSpeed;

        // If password is revealed, we always simulate.
        // If password is hidden, we simulate only during the active transition frames.
        let shouldSimulate = isPasswordRevealed;

        if (!isPasswordRevealed && transitionFramesRef.current > 0) {
          transitionFramesRef.current--;
          shouldSimulate = true;
        }

        isInterpolatingRef.current = shouldSimulate;

        if (shouldSimulate) {
          const fakeMouseEvent = new MouseEvent('mousemove', {
            clientX: currentSimulatedPosRef.current.x,
            clientY: currentSimulatedPosRef.current.y,
            bubbles: true,
            cancelable: true,
          });
          const fakePointerEvent = new PointerEvent('pointermove', {
            clientX: currentSimulatedPosRef.current.x,
            clientY: currentSimulatedPosRef.current.y,
            bubbles: true,
            cancelable: true,
          });

          // @ts-ignore
          fakeMouseEvent.isSimulated = true;
          // @ts-ignore
          fakePointerEvent.isSimulated = true;

          canvas.dispatchEvent(fakeMouseEvent);
          canvas.dispatchEvent(fakePointerEvent);
          
          // Only queue next frame if we are active
          rafId = requestAnimationFrame(animate);
        }
      } else {
        // If canvas is not found yet (lazy loading), check again on next frame
        rafId = requestAnimationFrame(animate);
      }
    };

    // Only start the loop if password is revealed or if we are actively transitioning
    if (isPasswordRevealed || transitionFramesRef.current > 0) {
      rafId = requestAnimationFrame(animate);
    }

    return () => {
      isMounted = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPasswordRevealed]);

  // Intercept real mouse movements to prevent snap back
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMoveCapture = (e: MouseEvent) => {
      // @ts-ignore
      if (e.isSimulated) return;

      // Block real movements if password is revealed or if we are still interpolating back
      if (isPasswordRevealed || isInterpolatingRef.current) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    window.addEventListener('mousemove', handleMoveCapture, true);
    window.addEventListener('pointermove', handleMoveCapture, true);

    return () => {
      window.removeEventListener('mousemove', handleMoveCapture, true);
      window.removeEventListener('pointermove', handleMoveCapture, true);
    };
  }, [isPasswordRevealed]);

  return (
    <div className="auth-page-container">
      <ParticlesComponent />

      <div className={`auth-wrapper ${isToggled ? 'toggled' : ''}`}>

        {/* Left Column: 3D Spline Robot Panel */}
        <div className="left-spline-panel">
          {/* Logo */}
          <Link href="/" className="left-panel-logo flex items-center gap-2 group relative z-30 select-none">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
              <Zap className="w-7 h-7 text-primary fill-primary relative z-10" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">
              Bunny <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Sank</span>
            </span>
          </Link>

          {/* Welcome typewriter text */}
          <div className="left-panel-welcome relative z-10 max-w-sm">
            <TypewriterTitle isToggled={isToggled} />
          </div>

          {/* Spline 3D Robot - absolute positioned, fills panel */}
          <InteractiveRobotSpline
            scene={ROBOT_SCENE_URL}
            className={`spline-embed ${isPasswordRevealed ? 'looking-away' : ''}`}
          />
        </div>

        {/* Right Column Forms */}
        {/* Sign In Credentials Panel */}
        <div className="credentials-panel signin">
          <div className="credentials-panel-content">
            <h2 className="slide-element">Login</h2>
            <form onSubmit={handleLogin}>
              <div className="field-wrapper slide-element">
                <input
                  type="email"
                  required
                  placeholder=" "
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  className={loginEmail ? 'has-value' : ''}
                  disabled={loginLoading}
                />
                <label>Email Address</label>
                <Mail className="input-icon w-5 h-5" />
              </div>

              <div className="field-wrapper slide-element">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder=" "
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  className={loginPassword ? 'has-value' : ''}
                  disabled={loginLoading}
                />
                <label>Password</label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="password-toggle-btn"
                  disabled={loginLoading}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <Lock className="input-icon w-5 h-5" />
              </div>

              <div className="slide-element forgot-password-wrapper">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  disabled={loginLoading}
                >
                  Forgot Password?
                </button>
              </div>

              {loginError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center mt-3 slide-element">
                  {loginError}
                </div>
              )}

              <div className="field-wrapper slide-element button-field">
                <motion.button 
                  whileTap={{ scale: loginLoading ? 1 : 0.98 }}
                  className="submit-button group" 
                  type="submit" 
                  disabled={loginLoading}
                >
                  {loginLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Sign In'}
                  {!loginLoading && <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                </motion.button>
              </div>

              {/* Premium Divider */}
              <div className="slide-element divider-wrapper">
                <div className="divider-line"></div>
                <span>or</span>
                <div className="divider-line"></div>
              </div>

              {/* Google fast action button */}
              <div className="slide-element">
                <motion.button
                  whileTap={{ scale: loginLoading ? 1 : 0.98 }}
                  type="button"
                  onClick={handleGoogleLogin}
                  className="google-button"
                  disabled={loginLoading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Google Account</span>
                </motion.button>
              </div>

              <div className="switch-link slide-element">
                <p>Don't have an account? <a href="/signup" onClick={handleToggleToSignup} className={`register-trigger ${loginLoading ? 'pointer-events-none opacity-50' : ''}`}>Sign Up</a></p>
              </div>
            </form>
          </div>
        </div>

        {/* Sign Up Credentials Panel */}
        <div className="credentials-panel signup">
          <div className="credentials-panel-content">
            <h2 className="slide-element">Register</h2>
            {signupSuccess ? (
              <div className="text-center space-y-4 py-4 slide-element" style={{ zIndex: 10 }}>
                <div className="w-16 h-16 bg-green/10 rounded-full flex items-center justify-center mx-auto border border-green/20 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                  <CheckCircle2 className="text-green w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Verify Email</h3>
                  <p className="text-text-muted text-xs font-medium leading-relaxed">
                    We've sent a verification link to <span className="text-white font-bold">{signupEmail}</span>. Please check your inbox.
                  </p>
                </div>
                <button
                  onClick={handleToggleToSignin}
                  className="text-xs font-black text-primary hover:underline uppercase tracking-widest mt-4"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup}>
                <div className="field-wrapper slide-element">
                  <input
                    type="text"
                    required
                    placeholder=" "
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={`${signupUsername ? 'has-value' : ''} pr-14`}
                    disabled={signupLoading}
                    autoComplete="off"
                  />
                  <label>Unique Username</label>
                  <div className="absolute top-1/2 right-12 -translate-y-1/2 flex items-center pointer-events-none z-10">
                    {signupUsername.trim() !== '' && !/^[a-zA-Z0-9_ ]{3,20}$/.test(signupUsername.trim()) && (
                      <span className="text-[9px] font-bold text-error uppercase tracking-wider bg-error/10 px-1.5 py-0.5 rounded border border-error/20">Invalid</span>
                    )}
                    {signupUsername.trim() !== '' && /^[a-zA-Z0-9_ ]{3,20}$/.test(signupUsername.trim()) && (
                      <>
                        {checkingUsername && <Loader2 className="animate-spin w-4 h-4 text-[#00F0FF]/60" />}
                        {!checkingUsername && usernameAvailable === true && (
                          <span className="text-[9px] font-bold text-green uppercase tracking-wider bg-green/10 px-1.5 py-0.5 rounded border border-green/20">Available</span>
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <span className="text-[9px] font-bold text-error uppercase tracking-wider bg-error/10 px-1.5 py-0.5 rounded border border-error/20">Taken</span>
                        )}
                      </>
                    )}
                  </div>
                  <User className="input-icon w-5 h-5" />
                </div>

                <div className="field-wrapper slide-element">
                  <input
                    type="email"
                    required
                    placeholder=" "
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={`${signupEmail ? 'has-value' : ''} ${prefillEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={signupLoading || !!prefillEmail}
                    autoComplete="off"
                  />
                  <label>Gmail Address</label>
                  <Mail className="input-icon w-5 h-5" />
                </div>

                <div className="field-wrapper slide-element">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    placeholder=" "
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={signupPassword ? 'has-value' : ''}
                    disabled={signupLoading}
                    autoComplete="new-password"
                  />
                  <label>Create Password</label>
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="password-toggle-btn"
                    disabled={signupLoading}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <Lock className="input-icon w-5 h-5" />
                </div>

                <div className="field-wrapper slide-element">
                  <input
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder=" "
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={signupConfirmPassword ? 'has-value' : ''}
                    disabled={signupLoading}
                    autoComplete="new-password"
                  />
                  <label>Confirm Password</label>
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    className="password-toggle-btn"
                    disabled={signupLoading}
                  >
                    {showSignupConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <Lock className="input-icon w-5 h-5" />
                </div>

                <div className="field-wrapper select-field slide-element" ref={countryDropdownRef}>
                  <div
                    onClick={() => !signupLoading && setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                    className={`custom-dropdown-trigger ${signupCountry ? 'has-value' : ''} ${isCountryDropdownOpen ? 'active' : ''}`}
                  >
                    <span className="dropdown-value">{signupCountry}</span>
                    <label className="dropdown-label">Select Country</label>
                    <ChevronDown className={`chevron-icon w-4 h-4 transition-transform duration-300 ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                    <Globe className="input-icon w-5 h-5" />
                  </div>
                  
                  <AnimatePresence>
                    {isCountryDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="custom-dropdown-popover"
                      >
                        <div className="search-wrapper">
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="dropdown-options-list">
                          {countries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).length > 0 ? (
                            countries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).map((country) => (
                              <div
                                key={country}
                                className={`dropdown-option-item ${signupCountry === country ? 'selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSignupCountry(country);
                                  setIsCountryDropdownOpen(false);
                                  setCountrySearch('');
                                }}
                              >
                                {country}
                              </div>
                            ))
                          ) : (
                            <div className="no-options-found">No countries found</div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password Strength Meter */}
                {signupPassword && (
                  <div className="mt-2 space-y-1.5 slide-element select-none" style={{ width: '100%' }}>
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                      <span className="text-text-muted">Strength</span>
                      <span style={{ color: getPasswordStrength(signupPassword).textColor }}>{getPasswordStrength(signupPassword).label}</span>
                    </div>
                    <div className="flex gap-1 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300 rounded-full" 
                        style={{ 
                          width: '33.33%', 
                          backgroundColor: getPasswordStrength(signupPassword).score >= 1 ? getPasswordStrength(signupPassword).color : 'transparent' 
                        }} 
                      />
                      <div 
                        className="h-full transition-all duration-300 rounded-full" 
                        style={{ 
                          width: '33.33%', 
                          backgroundColor: getPasswordStrength(signupPassword).score >= 3 ? getPasswordStrength(signupPassword).color : 'transparent' 
                        }} 
                      />
                      <div 
                        className="h-full transition-all duration-300 rounded-full" 
                        style={{ 
                          width: '33.33%', 
                          backgroundColor: getPasswordStrength(signupPassword).score >= 5 ? getPasswordStrength(signupPassword).color : 'transparent' 
                        }} 
                      />
                    </div>
                  </div>
                )}

                {signupError && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center mt-3 slide-element">
                    {signupError}
                  </div>
                )}

                <div className="field-wrapper slide-element button-field">
                  <motion.button 
                    whileTap={{ scale: signupLoading || checkingUsername || usernameAvailable === false ? 1 : 0.98 }}
                    className="submit-button group" 
                    type="submit" 
                    disabled={signupLoading || checkingUsername || usernameAvailable === false}
                  >
                    {signupLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (prefillEmail ? 'Complete Setup' : 'Create Account')}
                    {!signupLoading && <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                  </motion.button>
                </div>

                {prefillEmail && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full py-2 text-sm text-text-muted hover:text-white transition-colors font-semibold flex items-center justify-center gap-2 mt-2"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    disabled={signupLoading}
                  >
                    <X size={14} /> Cancel & Sign Out
                  </button>
                )}

                {!prefillEmail && (
                  <>
                    {/* Premium Divider */}
                    <div className="slide-element divider-wrapper">
                      <div className="divider-line"></div>
                      <span>or</span>
                      <div className="divider-line"></div>
                    </div>

                    {/* Google fast action button */}
                    <div className="slide-element">
                      <motion.button
                        whileTap={{ scale: signupLoading || checkingUsername ? 1 : 0.98 }}
                        type="button"
                        onClick={handleGoogleSignup}
                        className="google-button"
                        disabled={signupLoading || checkingUsername}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Google Account</span>
                      </motion.button>
                    </div>

                    <div className="switch-link slide-element">
                      <p>Already have an account? <a href="/login" onClick={handleToggleToSignin} className={`login-trigger ${signupLoading ? 'pointer-events-none opacity-50' : ''}`}>Sign In</a></p>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      <PortalModal
        isOpen={isForgotModalOpen}
        onClose={() => {
          setIsForgotModalOpen(false);
          setForgotError(null);
          setForgotMessage(null);
          setForgotEmail('');
        }}
        className="max-w-sm"
      >
        <div className="credentials-panel-content max-w-sm w-full">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-[0_0_30px_rgba(0,229,255,0.1)]">
              <Lock className="text-primary w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">Reset Password</h3>
              <p className="text-text-muted text-xs font-medium leading-relaxed">
                Enter your email address and we'll send you a secure link to reset your password.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-left">
              <div className="field-wrapper">
                <input
                  type="email"
                  required
                  placeholder=" "
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={forgotEmail ? 'has-value' : ''}
                  disabled={forgotLoading}
                />
                <label>Email Address</label>
                <Mail className="input-icon w-5 h-5" />
              </div>

              {forgotError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center">
                  {forgotError}
                </div>
              )}

              {forgotMessage && (
                <div className="p-3 bg-green/10 border border-green/20 rounded-xl text-green text-xs font-bold text-center">
                  {forgotMessage}
                </div>
              )}

              <div className="field-wrapper button-field">
                <motion.button 
                  whileTap={{ scale: forgotLoading ? 1 : 0.98 }}
                  className="submit-button group" 
                  type="submit" 
                  disabled={forgotLoading}
                >
                  {forgotLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Send Reset Link'}
                  {!forgotLoading && <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                </motion.button>
              </div>
            </form>

            <button
              onClick={() => {
                setIsForgotModalOpen(false);
                setForgotError(null);
                setForgotMessage(null);
                setForgotEmail('');
              }}
              className="text-xs font-black text-text-muted uppercase tracking-widest hover:text-white transition-colors mt-2"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </PortalModal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <UnifiedAuth initialToggled={false} />
    </Suspense>
  );
}
