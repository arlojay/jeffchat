import { GravatarIcon } from "../common/icons";
import { FetchCache } from "./fetchCache";

const CACHE_LIFETIME = 4 * 60 * 60 * 1000; // 4 hours

export class GravatarCache extends FetchCache {
    public match(request: Request): boolean {
        return /^https?:\/\/(www\.)?gravatar\.com\/avatar\//g.test(request.url);
    }
    private async isAvatarExpired(emailHash: string) {
        const cache = await caches.open("gravatar-meta");

        const item = await cache.match(emailHash);
        if(item == null) return true;

        const date = new Date(item.headers.get("date") as string);
        if(Date.now() - date.getTime() > CACHE_LIFETIME) return true;

        const data = await item.json();
        const oldIconHash = data.hash;

        const iconURL = new GravatarIcon(emailHash).createURL({
            size: 32, defaultType: "identicon", rating: "X"
        });
        const iconResponse = await fetch(iconURL);
        const iconData = await iconResponse.clone().arrayBuffer();

        const newIconHash = await crypto.subtle.digest({ name: "SHA-256" }, iconData);

        const iconCache = await caches.open("gravatar");
        iconCache.put(iconURL, iconResponse);

        if(newIconHash != oldIconHash) return true;

        return false;
    }
    private async deleteIconCaches(iconURL: string) {
        const iconCache = await caches.open("gravatar");
        const promises: Set<Promise<any>> = new Set;

        for(const key of await iconCache.keys()) {
            if(new URL(key.url).pathname != new URL(iconURL).pathname) continue;

            promises.add(iconCache.delete(key));
        }

        await Promise.all(promises);
    }
    public async proxyRequest(request: Request) {
        const url = new URL(request.url);
        console.log(url.pathname);

        const cache = await caches.open("gravatar");
        if(await this.isAvatarExpired(GravatarIcon.fromURL(request.url).hash)) {
            await this.deleteIconCaches(request.url);
        } else {
            const item = await cache.match(request);
            if(item != null) return item;
        }

        const response = await fetch(request);
        if(response.status < 200) cache.put(request, response.clone());

        return response;
    }
}