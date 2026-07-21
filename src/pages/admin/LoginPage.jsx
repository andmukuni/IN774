import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingButton } from '../../components/ui';
import { purgeInvalidAuthState } from '../../utils/authHeaders';
import { useCompany } from '../../context/CompanyContext';
import { CACHED_STATIC_ASSETS, warmLoginHeroAsset } from '../../utils/staticAssetCache';

const LOGIN_HERO_SRC = CACHED_STATIC_ASSETS.loginHero;

export default function LoginPage() {
  const { companyName } = useCompany();
  const { login, isAuthenticated, loginError, clearLoginError, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const from = location.state?.from?.pathname || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    purgeInvalidAuthState();
  }, []);

  useEffect(() => {
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.href = LOGIN_HERO_SRC;
    preload.type = 'image/webp';
    document.head.appendChild(preload);
    warmLoginHeroAsset();
    return () => {
      preload.remove();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    if (loginError) clearLoginError();
  }, [email, password]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      toast.success('Signed in to admin.');
      navigate(from, { replace: true });
    }
  };

  useEffect(() => {
    if (loginError) toast.error(loginError);
  }, [loginError, toast]);

  return (
    <div className="min-h-screen flex">
      <aside className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-cyan-900">
        <img
          src={LOGIN_HERO_SRC}
          alt=""
          width={720}
          height={1080}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/75 via-navy-900/55 to-cyan-900/35" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-10 xl:p-14">
          <h1 className="text-5xl xl:text-6xl font-black text-white uppercase text-center leading-tight">
            {companyName}
          </h1>
          <p className="mt-4 text-cyan-100/80 text-sm text-center max-w-md">
            Stock management, product tracking, and inventory insights in one place.
          </p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="text-3xl font-black text-navy-900 uppercase">
              {companyName}
            </h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-navy-900">Welcome back</h2>
            <p className="text-navy-500 text-sm mt-1.5">
              Sign in to your admin account
            </p>
          </div>

          {loginError && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {loginError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={16} className="text-navy-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-navy-200 bg-navy-50 text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={16} className="text-navy-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-navy-200 bg-navy-50 text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-navy-400 hover:text-navy-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingLabel="Signing in..."
              disabled={!email || !password}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Sign in
            </LoadingButton>
          </form>
        </div>
      </main>
    </div>
  );
}
