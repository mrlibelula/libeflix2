import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Star } from 'lucide-react';

interface SubscriptionPlan {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    formatted_price: string;
    interval: string;
    interval_display: string;
    trial_days: number;
    features: string[];
    sort_order: number;
}

interface Props {
    plans: SubscriptionPlan[];
    currentSubscription: any;
    stripeKey: string;
}

// Stripe promise will be initialized when the component mounts
let stripePromise: any = null;

function SubscriptionForm({ plan, onSuccess, stripeKey }: { 
    plan: SubscriptionPlan; 
    onSuccess: () => void; 
    stripeKey: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);
        setError(null);

        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
            setError('Card element not found');
            setLoading(false);
            return;
        }

        const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });

        if (stripeError) {
            setError(stripeError.message || 'An error occurred');
            setLoading(false);
            return;
        }

        // Submit to server
        router.post('/subscription/subscribe', {
            plan: plan.slug,
            payment_method: paymentMethod.id,
        }, {
            onSuccess: () => {
                onSuccess();
            },
            onError: (errors) => {
                setError(errors.payment_method || errors.general || 'An error occurred');
                setLoading(false);
            },
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border rounded-lg">
                <CardElement
                    options={{
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#424770',
                                '::placeholder': {
                                    color: '#aab7c4',
                                },
                            },
                        },
                    }}
                />
            </div>
            
            {error && (
                <div className="text-red-600 text-sm">
                    {error}
                </div>
            )}

            <Button 
                type="submit" 
                disabled={!stripe || loading} 
                className="w-full"
            >
                {loading ? 'Processing...' : `Subscribe to ${plan.name}`}
            </Button>
        </form>
    );
}

function PlanCard({ plan, isPopular, currentSubscription, onSubscribe }: {
    plan: SubscriptionPlan;
    isPopular?: boolean;
    currentSubscription: any;
    onSubscribe: (plan: SubscriptionPlan) => void;
}) {
    const hasCurrentSubscription = currentSubscription && currentSubscription.active;
    const isCurrentPlan = false; // You would determine this based on current subscription details

    return (
        <Card className={`relative ${isPopular ? 'ring-2 ring-rose-500' : ''}`}>
            {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default" className="bg-rose-500">
                        <Star className="w-3 h-3 mr-1" />
                        Most Popular
                    </Badge>
                </div>
            )}
            
            <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                    <span className="text-3xl font-bold">{plan.formatted_price}</span>
                    <span className="text-gray-600">/{plan.interval_display}</span>
                </div>
                {plan.trial_days > 0 && (
                    <Badge variant="secondary">
                        {plan.trial_days} days free trial
                    </Badge>
                )}
            </CardHeader>

            <CardContent>
                <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                            <span className="text-sm">{feature}</span>
                        </li>
                    ))}
                </ul>

                <Button 
                    onClick={() => onSubscribe(plan)}
                    disabled={isCurrentPlan}
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                >
                    {isCurrentPlan ? 'Current Plan' : 'Choose Plan'}
                </Button>
            </CardContent>
        </Card>
    );
}

export default function SubscriptionPlans({ plans, currentSubscription, stripeKey }: Props) {
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [showPaymentForm, setShowPaymentForm] = useState(false);

    const handleSubscribe = (plan: SubscriptionPlan) => {
        // @ts-ignore - accessing usePage from Inertia
        const { auth } = usePage().props as any;
        
        if (!auth?.user) {
            router.visit('/register', {
                data: { intended: window.location.pathname }
            });
            return;
        }

        setSelectedPlan(plan);
        setShowPaymentForm(true);
    };

    const handlePaymentSuccess = () => {
        setShowPaymentForm(false);
        setSelectedPlan(null);
        router.visit('/subscription/manage');
    };

    // Initialize Stripe
    if (!stripePromise && stripeKey) {
        stripePromise = loadStripe(stripeKey);
    }

    // Determine most popular plan (usually the middle tier)
    const popularPlanIndex = Math.floor(plans.length / 2);

    return (
        <AppLayout>
            <Head title="Subscription Plans" />
            
            <div className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Choose Your Plan
                        </h1>
                        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            Get unlimited access to thousands of movies and TV shows. 
                            Cancel anytime.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                        {plans.map((plan, index) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                isPopular={index === popularPlanIndex}
                                currentSubscription={currentSubscription}
                                onSubscribe={handleSubscribe}
                            />
                        ))}
                    </div>

                    {showPaymentForm && selectedPlan && stripePromise && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold mb-2">
                                        Subscribe to {selectedPlan.name}
                                    </h3>
                                    <p className="text-gray-600">
                                        {selectedPlan.formatted_price}/{selectedPlan.interval_display}
                                    </p>
                                    {selectedPlan.trial_days > 0 && (
                                        <p className="text-sm text-green-600 mt-1">
                                            Includes {selectedPlan.trial_days} days free trial
                                        </p>
                                    )}
                                </div>

                                <Elements stripe={stripePromise}>
                                    <SubscriptionForm
                                        plan={selectedPlan}
                                        onSuccess={handlePaymentSuccess}
                                        stripeKey={stripeKey}
                                    />
                                </Elements>

                                <Button
                                    variant="ghost"
                                    onClick={() => setShowPaymentForm(false)}
                                    className="w-full mt-4"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Already have an account?{' '}
                            <a href="/login" className="text-rose-600 hover:underline">
                                Sign in
                            </a>
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Secure payment powered by Stripe. Your payment information is safe and encrypted.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
} 