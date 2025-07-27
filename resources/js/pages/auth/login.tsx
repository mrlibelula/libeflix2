import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';
import axios from 'axios';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
    isBrave?: boolean;
    session_debug?: any;
}

export default function Login({ status, canResetPassword, isBrave, session_debug }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
    });

    const [isUsingBraveLogin, setIsUsingBraveLogin] = useState(false);
    const [braveLoginError, setBraveLoginError] = useState<string | null>(null);

    // Get redirect parameter from URL
    const redirectParam = new URLSearchParams(window.location.search).get('redirect');

    // Detect Brave browser
    const detectBrave = async () => {
        try {
            // Multiple methods to detect Brave
            const isBraveNavigator = (navigator as any).brave?.isBrave;
            const userAgentContainsBrave = navigator.userAgent.includes('Brave');
            const userAgentTest = /Brave/.test(navigator.userAgent);
            
            return isBraveNavigator || userAgentContainsBrave || userAgentTest || isBrave;
        } catch {
            return false;
        }
    };

    // Clear browser storage when login page loads to prevent cross-user data leakage
    useEffect(() => {
        try {
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // console.log('Browser storage cleared on login page load');
        } catch (error) {
            console.warn('Could not clear browser storage:', error);
        }
    }, []);

    // Debug CSRF token availability and Brave detection
    useEffect(() => {
        const debugLoginPage = async () => {
            const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const userAgent = navigator.userAgent;
            const detectedBrave = await detectBrave();
            
            console.log('Login page debug:', {
                metaToken: metaToken ? 'present' : 'missing',
                detectedBrave,
                propIsBrave: isBrave,
                userAgent: userAgent.substring(0, 50) + '...',
                cookies: document.cookie ? 'present' : 'none',
                sessionDebug: session_debug
            });
        };
        
        debugLoginPage();
    }, [isBrave, session_debug]);

    // Brave-specific login function
    const loginWithBrave = async (formData: LoginForm) => {
        setIsUsingBraveLogin(true);
        setBraveLoginError(null);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await axios.post('/login-brave', {
                email: formData.email,
                password: formData.password,
                remember: formData.remember,
                redirect: redirectParam,
                _token: token
            }, {
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-XSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                withCredentials: true
            });

            if (response.data.success) {
                console.log('Brave login successful, redirecting to:', response.data.redirect);
                window.location.href = response.data.redirect;
            } else {
                throw new Error(response.data.error || 'Login failed');
            }
        } catch (error: any) {
            console.error('Brave login error:', error);
            
            if (error.response?.status === 422) {
                setBraveLoginError(error.response.data.error || 'Invalid credentials');
            } else if (error.response?.status === 419) {
                setBraveLoginError('Session expired. Please refresh the page and try again.');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setBraveLoginError(error.response?.data?.error || error.message || 'Login failed');
            }
        } finally {
            setIsUsingBraveLogin(false);
        }
    };

    const submit: FormEventHandler = async (e) => {
        e.preventDefault();
        
        // Check if this is Brave browser
        const isBraveDetected = await detectBrave();
        
        if (isBraveDetected) {
            console.log('Brave browser detected, using special login endpoint');
            await loginWithBrave(data);
            return;
        }
        
        // Additional CSRF token check before submission for non-Brave browsers
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!token) {
            console.error('No CSRF token found before form submission');
            // Try to refresh the token
            window.location.reload();
            return;
        }
        
        const loginUrl = redirectParam 
            ? route('login') + '?redirect=' + encodeURIComponent(redirectParam)
            : route('login');
        
        console.log('Submitting login form with CSRF token:', token.substring(0, 10) + '...');
        
        post(loginUrl, {
            onFinish: () => reset('password'),
            onError: (errors) => {
                console.error('Login form errors:', errors);
                // Check if it's a CSRF error
                if (typeof errors === 'object' && Object.values(errors).some(error => 
                    typeof error === 'string' && (
                        error.includes('419') || 
                        error.includes('CSRF') || 
                        error.includes('token') ||
                        error.includes('expired')
                    )
                )) {
                    console.warn('CSRF error detected, trying Brave login method...');
                    loginWithBrave(data);
                }
            }
        });
    };

    const currentProcessing = processing || isUsingBraveLogin;

    return (
        <AuthLayout title="Log in to your account" description="Enter your email and password below to log in">
            <Head title="Log in" />

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="email@example.com"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Password</Label>
                            {canResetPassword && (
                                <TextLink href={route('password.request')} className="ml-auto text-sm" tabIndex={5}>
                                    Forgot password?
                                </TextLink>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Password"
                        />
                        <InputError message={errors.password} />
                        {braveLoginError && (
                            <div className="text-red-600 text-sm font-medium">{braveLoginError}</div>
                        )}
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="remember"
                            name="remember"
                            checked={data.remember}
                            onClick={() => setData('remember', !data.remember)}
                            tabIndex={3}
                        />
                        <Label htmlFor="remember">Remember me</Label>
                    </div>

                    <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={currentProcessing}>
                        {currentProcessing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        {isUsingBraveLogin ? 'Logging in (Brave)...' : 'Log in'}
                    </Button>
                </div>

                <div className="text-muted-foreground text-center text-sm">
                    Don't have an account?{' '}
                    <TextLink href={route('register')} tabIndex={5}>
                        Sign up
                    </TextLink>
                </div>
            </form>

            <a href={route('login.google')} className="group flex mt-8_ justify-center items-center gap-x-2">
                <div className="flex justify-center items-center gap-x-4 bg-gray-200 dark:bg-gray-300 group-hover:bg-gray-200 px-6 py-3 rounded-full text-gray-800 group-hover:text-black cursor-pointer transition-all duration-300 ease-in-out">
                    <img className="w-6 h-6" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/768px-Google_%22G%22_logo.svg.png" alt="" />
                    Sign in with Google
                </div>
            </a>

            {status && <div className="mb-4 text-center text-sm font-medium text-green-600">{status}</div>}
            
            {/* Debug info for development */}
            {process.env.NODE_ENV === 'development' && session_debug && (
                <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                    <strong>Debug Info:</strong>
                    <pre>{JSON.stringify(session_debug, null, 2)}</pre>
                </div>
            )}
        </AuthLayout>
    );
}
