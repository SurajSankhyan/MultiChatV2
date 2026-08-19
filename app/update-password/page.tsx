'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import ParticlesComponent from '@/components/ui/particles-bg';
import { motion } from 'framer-motion';
import '../login/style.css'; // Import the same styles used by the login page

function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verify that the user actually has a session (reset link sets a temporary session)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no active session, send them back to login
        router.push('/login');
      }
    };
    checkSession();
  }, [supabase, router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Wait 3 seconds and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/login');
      }, 3000);
    }
  };

  return (
    <div className="auth-page-container">
      <ParticlesComponent />

      <div className="relative z-10 w-full max-w-[440px] px-4">
        <div className="credentials-panel-content w-full">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green/10 rounded-full flex items-center justify-center mx-auto border border-green/20 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                <CheckCircle2 className="text-green w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Password Updated</h3>
                <p className="text-text-muted text-xs font-medium leading-relaxed">
                  Your password has been changed successfully. Redirecting you to login...
                </p>
              </div>
            </div>
          ) : (
            <>
              <h2>New Password</h2>
              <p className="text-text-muted text-xs text-center font-medium mt-1 mb-4">
                Choose a secure password for your account.
              </p>

              <form onSubmit={handleUpdatePassword}>
                <div className="field-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={password ? 'has-value' : ''}
                    disabled={loading}
                  />
                  <label>New Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <Lock className="input-icon w-5 h-5" />
                </div>

                <div className="field-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={confirmPassword ? 'has-value' : ''}
                    disabled={loading}
                  />
                  <label>Confirm Password</label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle-btn"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <Lock className="input-icon w-5 h-5" />
                </div>

                {error && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center mt-4">
                    {error}
                  </div>
                )}

                <div className="field-wrapper button-field mt-6">
                  <motion.button
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="submit-button group"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Update Password'}
                    {!loading && <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                  </motion.button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  );
}
