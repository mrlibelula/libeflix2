import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Calendar, CreditCard, Download, CheckCircle2 } from 'lucide-react';

interface SubscriptionDetails {
    status: string;
    ends_at: string | null;
    trial_ends_at: string | null;
    on_trial: boolean;
    active: boolean;
    canceled: boolean;
}

interface SubscriptionPlan {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    formatted_price: string;
    interval: string;
    interval_display: string;
    features: string[];
}

interface Invoice {
    id: string;
    date: string;
    total: string;
    status: string;
    invoice_pdf: string;
}

interface PaymentMethod {
    id: string;
    type: string;
    card: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
    };
}

interface Props {
    subscription: SubscriptionDetails | null;
    plans: SubscriptionPlan[];
    invoices: Invoice[];
    paymentMethods: PaymentMethod[];
}

export default function ManageSubscription({ subscription, plans, invoices, paymentMethods }: Props) {
    const [loading, setLoading] = useState(false);

    const handleCancel = () => {
        if (confirm('Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.')) {
            setLoading(true);
            router.post('/subscription/cancel', {}, {
                onFinish: () => setLoading(false)
            });
        }
    };

    const handleResume = () => {
        setLoading(true);
        router.post('/subscription/resume', {}, {
            onFinish: () => setLoading(false)
        });
    };

    const handlePlanChange = (planSlug: string) => {
        if (confirm('Are you sure you want to change your subscription plan?')) {
            setLoading(true);
            router.post('/subscription/update-plan', { plan: planSlug }, {
                onFinish: () => setLoading(false)
            });
        }
    };

    const getStatusBadge = (status: string, canceled: boolean, onTrial: boolean) => {
        if (onTrial) {
            return <Badge variant="secondary">Trial</Badge>;
        }
        if (canceled) {
            return <Badge variant="destructive">Canceled</Badge>;
        }
        if (status === 'active') {
            return <Badge variant="default">Active</Badge>;
        }
        if (status === 'past_due') {
            return <Badge variant="destructive">Past Due</Badge>;
        }
        return <Badge variant="secondary">{status}</Badge>;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (!subscription) {
        return (
            <AppLayout>
                <Head title="Manage Subscription" />
                
                <div className="py-12">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-900 mb-4">
                                No Active Subscription
                            </h1>
                            <p className="text-gray-600 mb-8">
                                You don't have an active subscription. Choose a plan to get started.
                            </p>
                            <Button onClick={() => router.visit('/subscription/plans')}>
                                View Plans
                            </Button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Manage Subscription" />
            
            <div className="py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Manage Subscription
                        </h1>
                        <p className="text-gray-600">
                            View and manage your subscription details, billing, and payment methods.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Current Subscription */}
                        <div className="lg:col-span-2">
                            <Card className="mb-6">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Current Subscription</CardTitle>
                                        {getStatusBadge(subscription.status, subscription.canceled, subscription.on_trial)}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Status</p>
                                            <p className="font-medium">{subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}</p>
                                        </div>

                                        {subscription.on_trial && subscription.trial_ends_at && (
                                            <div>
                                                <p className="text-sm text-gray-600">Trial Ends</p>
                                                <p className="font-medium">{formatDate(subscription.trial_ends_at)}</p>
                                            </div>
                                        )}

                                        {subscription.ends_at && (
                                            <div>
                                                <p className="text-sm text-gray-600">
                                                    {subscription.canceled ? 'Access Ends' : 'Next Billing Date'}
                                                </p>
                                                <p className="font-medium">{formatDate(subscription.ends_at)}</p>
                                            </div>
                                        )}

                                        <div className="flex space-x-2 mt-6">
                                            {subscription.canceled ? (
                                                <Button onClick={handleResume} disabled={loading}>
                                                    Resume Subscription
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="destructive" 
                                                    onClick={handleCancel}
                                                    disabled={loading}
                                                >
                                                    Cancel Subscription
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Available Plans */}
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle>Change Plan</CardTitle>
                                    <CardDescription>
                                        Upgrade or downgrade your subscription plan
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {plans.map((plan) => (
                                            <div key={plan.id} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold">{plan.name}</h3>
                                                        <p className="text-sm text-gray-600">{plan.description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold">{plan.formatted_price}</p>
                                                        <p className="text-sm text-gray-600">/{plan.interval_display}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handlePlanChange(plan.slug)}
                                                    disabled={loading}
                                                    className="w-full"
                                                >
                                                    Switch to {plan.name}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Payment Methods */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Payment Methods</CardTitle>
                                    <CardDescription>
                                        Manage your payment methods
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {paymentMethods.length > 0 ? (
                                        <div className="space-y-3">
                                            {paymentMethods.map((method) => (
                                                <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div className="flex items-center">
                                                        <CreditCard className="w-5 h-5 mr-3 text-gray-400" />
                                                        <div>
                                                            <p className="font-medium">
                                                                {method.card.brand.toUpperCase()} •••• {method.card.last4}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                Expires {method.card.exp_month}/{method.card.exp_year}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary">Default</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600">No payment methods found.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Billing History */}
                        <div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Billing History</CardTitle>
                                    <CardDescription>
                                        Download your invoices
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {invoices.length > 0 ? (
                                        <div className="space-y-3">
                                            {invoices.map((invoice) => (
                                                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div>
                                                        <p className="font-medium">{invoice.total}</p>
                                                        <p className="text-sm text-gray-600">{formatDate(invoice.date)}</p>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        {invoice.status === 'paid' && (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => window.open(`/subscription/invoice/${invoice.id}`, '_blank')}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600">No invoices found.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
} 