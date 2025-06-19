import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Calendar, CreditCard, Download, CheckCircle2, Plus } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Subscription settings',
        href: '/settings/subscription',
    },
];

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

export default function SubscriptionSettings({ subscription, plans, invoices, paymentMethods }: Props) {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Subscription settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    {!subscription ? (
                        <div className="text-center py-8">
                            <HeadingSmall title="No Active Subscription" description="You don't have an active subscription. Choose a plan to get started." />
                            <Button 
                                onClick={() => router.visit('/subscription/plans')} 
                                className="mt-4"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                View Plans
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Current Subscription */}
                            <div>
                                <HeadingSmall title="Current Subscription" description="Manage your subscription plan and billing" />
                                
                                <Card className="mt-4">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">Subscription Status</CardTitle>
                                            {getStatusBadge(subscription.status, subscription.canceled, subscription.on_trial)}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Status</p>
                                                <p className="font-medium">{subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}</p>
                                            </div>

                                            {subscription.on_trial && subscription.trial_ends_at && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Trial Ends</p>
                                                    <p className="font-medium">{formatDate(subscription.trial_ends_at)}</p>
                                                </div>
                                            )}

                                            {subscription.ends_at && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {subscription.canceled ? 'Access Ends' : 'Next Billing Date'}
                                                    </p>
                                                    <p className="font-medium">{formatDate(subscription.ends_at)}</p>
                                                </div>
                                            )}

                                            <div className="flex space-x-2 pt-4">
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
                                                <Button 
                                                    variant="outline" 
                                                    onClick={() => router.visit('/subscription/plans')}
                                                >
                                                    View All Plans
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Separator />

                            {/* Available Plans */}
                            <div>
                                <HeadingSmall title="Change Plan" description="Upgrade or downgrade your subscription plan" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    {plans.slice(0, 4).map((plan) => (
                                        <Card key={plan.id} className="relative">
                                            <CardHeader className="pb-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                                                        <CardDescription className="text-sm">{plan.description}</CardDescription>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-lg">{plan.formatted_price}</p>
                                                        <p className="text-sm text-muted-foreground">/{plan.interval_display}</p>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handlePlanChange(plan.slug)}
                                                    disabled={loading}
                                                    className="w-full"
                                                >
                                                    Switch to {plan.name}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Payment Methods */}
                            <div>
                                <HeadingSmall title="Payment Methods" description="Manage your payment methods" />
                                
                                <Card className="mt-4">
                                    <CardContent className="pt-6">
                                        {paymentMethods.length > 0 ? (
                                            <div className="space-y-3">
                                                {paymentMethods.map((method) => (
                                                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                        <div className="flex items-center">
                                                            <CreditCard className="w-5 h-5 mr-3 text-muted-foreground" />
                                                            <div>
                                                                <p className="font-medium">
                                                                    {method.card.brand.toUpperCase()} •••• {method.card.last4}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    Expires {method.card.exp_month}/{method.card.exp_year}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary">Default</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground text-center py-4">No payment methods found.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <Separator />

                            {/* Recent Invoices */}
                            <div>
                                <HeadingSmall title="Billing History" description="Download your recent invoices" />
                                
                                <Card className="mt-4">
                                    <CardContent className="pt-6">
                                        {invoices.length > 0 ? (
                                            <div className="space-y-3">
                                                {invoices.slice(0, 5).map((invoice) => (
                                                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                        <div>
                                                            <p className="font-medium">{invoice.total}</p>
                                                            <p className="text-sm text-muted-foreground">{formatDate(invoice.date)}</p>
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
                                                {invoices.length > 5 && (
                                                    <div className="text-center pt-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => router.visit('/subscription/manage')}
                                                        >
                                                            View All Invoices
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground text-center py-4">No invoices found.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
} 