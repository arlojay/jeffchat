import { FetchCache } from "./fetchCache";
import { GravatarCache } from "./gravatarCache";
import { RobohashCache } from "./robohashCache";

const fetchHandlers: FetchCache[] = [
    new GravatarCache,
    new RobohashCache
];


self.addEventListener("fetch", (event: FetchEvent) => {
    for(const handler of fetchHandlers) {
        if(handler.match(event.request)) {
            event.respondWith(handler.proxyRequest(event.request));
            return;
        }
    }
});