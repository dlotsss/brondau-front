const API_BASE_URL = 'http://localhost:3001/api';

let swRegistration: ServiceWorkerRegistration | null = null;

async function getVapidPublicKey(): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
    const data = await res.json();
    return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported');
        return null;
    }

    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered');
        return swRegistration;
    } catch (err) {
        console.error('Service Worker registration failed:', err);
        return null;
    }
}

export async function subscribeToPush(
    role: 'ADMIN' | 'GUEST',
    restaurantId?: string,
    guestPhone?: string
): Promise<boolean> {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return false;
        }

        if (!swRegistration) {
            swRegistration = await registerServiceWorker();
        }
        if (!swRegistration) return false;

        // Check for existing subscription
        let subscription = await swRegistration.pushManager.getSubscription();

        if (!subscription) {
            const vapidPublicKey = await getVapidPublicKey();
            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

            subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
            });
        }

        // Send subscription to server
        const res = await fetch(`${API_BASE_URL}/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                role,
                restaurantId,
                guestPhone,
            }),
        });

        return res.ok;
    } catch (err) {
        console.error('Push subscription failed:', err);
        return false;
    }
}

export async function unsubscribeFromPush(): Promise<void> {
    if (!swRegistration) return;

    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await fetch(`${API_BASE_URL}/push/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
            await subscription.unsubscribe();
        }
    } catch (err) {
        console.error('Push unsubscribe failed:', err);
    }
}
