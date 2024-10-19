export abstract class FetchCache {
    public abstract match(request: Request): boolean;
    public abstract proxyRequest(request: Request): Promise<Response>;
}