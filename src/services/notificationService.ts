/**
 * Notification service for push notifications
 * Uses the Push API and Service Workers
 */

type NotificationType = 'missing-statement' | 'big-expense' | 'passive-income';

interface NotificationPayload {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

/**
 * Check if notifications are supported and permitted
 */
export function isNotificationSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!isNotificationSupported()) {
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }
    return Notification.permission;
}

/**
 * Show a notification
 */
export async function showNotification(payload: NotificationPayload): Promise<void> {
    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
    }

    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: payload.type,
        data: payload.data,
        vibrate: [200, 100, 200],
    });
}

/**
 * Notify about missing statement
 */
export function notifyMissingStatement(accountName: string, month: string): void {
    showNotification({
        type: 'missing-statement',
        title: 'Statement Reminder',
        body: `${accountName} statement for ${month} is missing`,
        data: { accountName, month },
    });
}

/**
 * Notify about big expense
 */
export function notifyBigExpense(amount: number, description: string): void {
    const formattedAmount = new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
    }).format(Math.abs(amount));

    showNotification({
        type: 'big-expense',
        title: 'Big Expense Detected',
        body: `${formattedAmount} - ${description}`,
        data: { amount, description },
    });
}

/**
 * Notify about passive income
 */
export function notifyPassiveIncome(amount: number, source: string): void {
    const formattedAmount = new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
    }).format(amount);

    showNotification({
        type: 'passive-income',
        title: 'Passive Income Posted',
        body: `${formattedAmount} from ${source}`,
        data: { amount, source },
    });
}
