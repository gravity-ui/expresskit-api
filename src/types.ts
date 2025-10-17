import type { SwaggerUiOptions } from 'swagger-ui-express';
 
// OpenAPI Security Scheme Object types
export interface SecuritySchemeObject {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    description?: string;

    // apiKey
    in?: 'query' | 'header' | 'cookie';
    name?: string;

    // http
    scheme?: string;
    bearerFormat?: string;

    // oauth2
    flows?: {
        implicit?: {
            authorizationUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        password?: {
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        clientCredentials?: {
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        authorizationCode?: {
            authorizationUrl: string;
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
    };

    // openIdConnect
    openIdConnectUrl?: string;
}

export interface OpenApiRegistryConfig {
    enabled?: boolean;
    path?: string;
    version?: string;
    title?: string;
    description?: string;
    contact?: {
        name?: string;
        email?: string;
        url?: string;
    };
    license?: {
        name?: string;
        url?: string;
    };
    servers?: {
        url: string;
        description?: string;
    }[];
    swaggerUi?: SwaggerUiOptions;
}

// Define a type that matches what swagger-ui-express expects
export interface OpenApiSchemaObject {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
        [key: string]: unknown;
    };
    servers?: Array<{url: string; [key: string]: unknown}>;
    paths: Record<string, Record<string, unknown>>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, SecuritySchemeObject>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';