import { FetchCache } from "./fetchCache";


export class RobohashCache extends FetchCache {
    public match(request: Request): boolean {
        return /^https?:\/\/(www\.)?robohash\.org\//g.test(request.url);
    }
    public async proxyRequest(request: Request) {
        const url = new URL(request.url);
        console.log(url.pathname);

        const cache = await caches.open("robohash");
        
        const item = await cache.match(request);
        if(item != null) return item;

        const response = await fetch(request);
        if(response.status < 200) cache.put(request, response.clone());

        return response;
    }
}