import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect } from 'react';

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
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
    });

    // Get redirect parameter from URL
    const redirectParam = new URLSearchParams(window.location.search).get('redirect');

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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const loginUrl = redirectParam 
            ? route('login') + '?redirect=' + encodeURIComponent(redirectParam)
            : route('login');
        
        post(loginUrl, {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Log in to your account" description="Enter your email and password below to log in">
            <Head title="Log in" />

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <input type="hidden" name="csrf_token" value={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''} />
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

                    <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Log in
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
        </AuthLayout>
    );
}
