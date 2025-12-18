import '@gravity-ui/expresskit';

declare module '@gravity-ui/expresskit' {
    interface RouteContract {
        name?: string;
        operationId?: string;
        summary?: string;
        description?: string;
        tags?: string[];
    }
}
