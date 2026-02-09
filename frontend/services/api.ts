import { Professor } from '@/components/ProfessorCard';

import { API_BASE_URL } from '@/constants/Config';

export interface Session {
    id: string;
    user_id: string;
    root_urls: string[];
    status: 'queued' | 'running' | 'done' | 'error' | 'blocked';
    blocked_reason?: string;
    blocked_url?: string;
    created_at?: string;
    finished_at?: string;
}

export interface SessionResponse {
    session: Session;
    cards: Professor[];
}

export interface CreateSessionRequest {
    user_id: string;
    root_urls: string[];
    objective_prompt?: string;
}

class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    async createSession(request: CreateSessionRequest): Promise<SessionResponse> {
        const response = await fetch(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }

        return response.json();
    }

    async getSession(sessionId: string): Promise<SessionResponse> {
        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);

        if (!response.ok) {
            throw new Error(`Failed to get session: ${response.statusText}`);
        }

        return response.json();
    }

    async recordSwipe(userId: string, professorCardId: string, decision: 'like' | 'pass'): Promise<void> {
        // Note: This endpoint would need to be added to the backend
        // For now, we'll just log it
        console.log(`Swipe recorded: ${decision} for professor ${professorCardId}`);
    }

    async checkHealth(): Promise<'healthy' | 'down' | 'supabase_down'> {
        try {
            const response = await fetch(`${this.baseUrl}/`, { method: 'GET' });
            if (response.ok) return 'healthy';
            if (response.status === 503) return 'supabase_down';
            return 'down';
        } catch (error) {
            return 'down';
        }
    }
}

export const apiService = new ApiService();
