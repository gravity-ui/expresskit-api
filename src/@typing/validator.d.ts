declare module '@gravity-ui/expresskit/build/validator/types' {
    interface RouteContract {
        name?: string;
        operationId?: string;
        summary?: string;
        description?: string;
        tags?: string[];
    }
}
