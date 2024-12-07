export interface UserContext {
    isAI: boolean;
    command: string;
    sub_command?: string;
}

export interface TokenResponse {
    auth_token: string;
    refresh_auth_token: string;
    device_token: string;
    trace_id: string;
}

export interface APIResponse {
    status: string;
    data: TokenResponse;
}
