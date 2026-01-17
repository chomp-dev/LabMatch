import { Professor } from '@/components/ProfessorCard';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/`, { method: 'GET' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

export const apiService = new ApiService();
