export async function registerServiceWorker(name: string) {
    if(!("serviceWorker" in navigator)) return;


    const registration = await navigator.serviceWorker.register(name);
    console.log("Service Worker registered: ", registration);
}