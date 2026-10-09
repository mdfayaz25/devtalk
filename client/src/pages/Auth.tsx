import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/chat/Sidebar';

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
const registerSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });

const PREVIEW = [
  { who: 'Arjun Mehta', color: '#60A5FA', text: 'Is anyone else seeing hydration warnings on the product page?' },
  { who: 'You', color: '#34D399', text: "It's the date formatting. Server renders UTC, client renders IST.", mine: true },
  { who: 'Neha Kapoor', color: '#FBBF24', text: 'Regression suite is green on staging ✅' },
];

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register: signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  const form = useForm<{ name?: string; email: string; password: string }>({ resolver: zodResolver(isLogin ? loginSchema : registerSchema), defaultValues: { name: '', email: '', password: '' } });
  const { errors } = form.formState;
  if (user) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true);
    try {
      await (isLogin ? login(v.email, v.password) : signup(v.name!, v.email, v.password));
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="grid-bg grid min-h-full lg:grid-cols-2">
      <div className="flex flex-col bg-bg/90 px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold">{isLogin ? 'Welcome back' : 'Join DevTalk'}</h1>
          <p className="mt-2 text-muted">{isLogin ? 'Your team is already talking.' : 'Chat, share code and ship together.'}</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {!isLogin && <Field label="Name" error={errors.name?.message} htmlFor="name"><Input id="name" autoComplete="name" invalid={!!errors.name} {...form.register('name')} /></Field>}
            <Field label="Email" error={errors.email?.message} htmlFor="email"><Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...form.register('email')} /></Field>
            <Field label="Password" error={errors.password?.message} htmlFor="password"><Input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} invalid={!!errors.password} {...form.register('password')} /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>{isLogin ? 'Sign in' : 'Create account'}</Button>
          </form>
          {isLogin && (
            <div className="mt-6 rounded-2xl border border-dashed border-line p-4 text-sm">
              <p className="font-semibold">Demo accounts <span className="font-normal text-muted">· password Demo@1234</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[['Fayaz', 'fayaz', '#34D399'], ['Priya', 'priya', '#F472B6'], ['Arjun', 'arjun', '#60A5FA']].map(([n, e, c]) => (
                  <button key={e} type="button" onClick={() => { form.setValue('email', `${e}@devtalk.dev`); form.setValue('password', 'Demo@1234'); }} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 font-semibold transition hover:border-brand-500/50">
                    <Avatar name={n} color={c} size={24} /> {n}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Sign in as two people in two windows to see typing and presence live.</p>
            </div>
          )}
          <p className="mt-8 text-center text-sm text-muted">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-brand-400 hover:underline">{isLogin ? 'Create an account' : 'Sign in'}</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden items-center justify-center overflow-hidden border-l border-line lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_40%,rgba(52,211,153,.18),transparent_70%)]" />
        <div className="relative w-full max-w-md space-y-3 p-10">
          {PREVIEW.map((m, i) => (
            <div key={i} className={`flex gap-2.5 animate-msg-in ${m.mine ? 'flex-row-reverse' : ''}`} style={{ animationDelay: `${i * 0.25}s` }}>
              {!m.mine && <Avatar name={m.who} color={m.color} size={32} />}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? 'rounded-tr-md bg-brand-500 text-brand-900' : 'rounded-tl-md bg-surface-2'}`}>
                {!m.mine && <p className="mb-0.5 text-xs font-semibold" style={{ color: m.color }}>{m.who}</p>}
                {m.text}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pl-10 text-xs text-muted">
            <span className="flex gap-1 rounded-2xl bg-surface-2 px-3 py-2.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-blink rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
            Priya is typing…
          </div>
        </div>
      </div>
    </div>
  );
}
