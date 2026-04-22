import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

const AuthShell = ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white leading-none">DeskCRM</p>
          <p className="text-xs text-violet-600 dark:text-violet-400">deepusiva.com</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-xl shadow-black/5">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  </div>
);

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all";
const btnCls = "w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*, company:companies(*)')
        .eq('id', authData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      setUser(profile as User);
      const role = profile.role;
      if (role === 'customer') navigate('/desk/portal');
      else if (role === 'agent') navigate('/desk/agent');
      else navigate('/desk/manager');
    } catch (err: any) {
      setServerError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your DeskCRM account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email" error={errors.email?.message}>
          <input {...register('email')} type="email" placeholder="you@example.com" className={inputCls} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input {...register('password')} type="password" placeholder="••••••••" className={inputCls} />
        </Field>
        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
          </div>
        )}
        <button type="submit" disabled={isSubmitting} className={btnCls}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/desk/register" className="text-violet-600 dark:text-violet-400 hover:underline font-medium">Register</Link>
      </p>
    </AuthShell>
  );
}

const registerSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string(),
  role: z.enum(['customer', 'agent', 'manager']),
  company_name: z.string().optional(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});
type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'customer' },
  });
  const role = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
  setServerError('');
  try {
    // Step 1: Sign up only — no DB writes yet
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          // Pass registration data as metadata
          full_name: data.full_name,
          role: data.role,
          company_name: data.company_name || null,
        }
      }
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error('No user returned');

    // Step 2: Wait for session to be fully established
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Session timeout')), 10000);
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user?.id === authData.user!.id) {
            clearTimeout(timeout);
            subscription.unsubscribe();
            resolve();
          }
        }
      );
    });

    // Step 3: Session is now fully locked — safe to write to DB
    let companyId: string | null = null;
    if ((data.role === 'manager' || data.role === 'agent') && data.company_name) {
      const slug = data.company_name.toLowerCase().replace(/\s+/g, '-');
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: data.company_name, slug, plan: 'free' })
        .select()
        .single();
      if (companyError) throw new Error(`Company error: ${companyError.message}`);
      companyId = company.id;
    }

    // Step 4: Insert user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        company_id: companyId,
        is_active: true,
      });
    if (profileError) throw new Error(`Profile error: ${profileError.message}`);

    // Step 5: Fetch complete profile
    const { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('*, company:companies(*)')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!profile) throw new Error('Profile not saved. Check RLS policy.');

    setUser(profile as User);
    if (data.role === 'customer') navigate('/desk/portal');
    else if (data.role === 'agent') navigate('/desk/agent');
    else navigate('/desk/manager');

  } catch (err: any) {
    setServerError(err.message || 'Registration failed.');
  }
};

  return (
    <AuthShell title="Create account" subtitle="Set up your DeskCRM workspace">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" error={errors.full_name?.message}>
          <input {...register('full_name')} type="text" placeholder="Deepu Siva" className={inputCls} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input {...register('email')} type="email" placeholder="you@example.com" className={inputCls} />
        </Field>
        <Field label="Role" error={errors.role?.message}>
          <select {...register('role')} className={inputCls}>
            <option value="customer">Customer – raise & track tickets</option>
            <option value="agent">Agent / Staff – manage tickets</option>
            <option value="manager">Manager / Admin – full access</option>
          </select>
        </Field>
        {(role === 'manager' || role === 'agent') && (
          <Field label="Company name" error={errors.company_name?.message}>
            <input {...register('company_name')} type="text" placeholder="Deepu Siva Pvt Ltd" className={inputCls} />
          </Field>
        )}
        <Field label="Password" error={errors.password?.message}>
          <input {...register('password')} type="password" placeholder="Min 8 characters" className={inputCls} />
        </Field>
        <Field label="Confirm password" error={errors.confirm_password?.message}>
          <input {...register('confirm_password')} type="password" placeholder="••••••••" className={inputCls} />
        </Field>
        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
          </div>
        )}
        <button type="submit" disabled={isSubmitting} className={btnCls}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/desk/login" className="text-violet-600 dark:text-violet-400 hover:underline font-medium">Sign in</Link>
      </p>
    </AuthShell>
  );
}