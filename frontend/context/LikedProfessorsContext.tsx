import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Professor } from '@/components/ProfessorCard';

interface LikedProfessorsContextType {
    likedProfessors: Professor[];
    addLikedProfessor: (professor: Professor) => void;
    removeLikedProfessor: (professorId: string) => void;
    clearLikedProfessors: () => void;
}

const LikedProfessorsContext = createContext<LikedProfessorsContextType | undefined>(undefined);

export function LikedProfessorsProvider({ children }: { children: ReactNode }) {
    const [likedProfessors, setLikedProfessors] = useState<Professor[]>([]);

    const addLikedProfessor = useCallback((professor: Professor) => {
        setLikedProfessors((prev) => {
            // Prevent duplicates
            if (prev.some((p) => p.id === professor.id)) {
                return prev;
            }
            return [...prev, professor];
        });
    }, []);

    const removeLikedProfessor = useCallback((professorId: string) => {
        setLikedProfessors((prev) => prev.filter((p) => p.id !== professorId));
    }, []);

    const clearLikedProfessors = useCallback(() => {
        setLikedProfessors([]);
    }, []);

    return (
        <LikedProfessorsContext.Provider
            value={{
                likedProfessors,
                addLikedProfessor,
                removeLikedProfessor,
                clearLikedProfessors,
            }}
        >
            {children}
        </LikedProfessorsContext.Provider>
    );
}

export function useLikedProfessors() {
    const context = useContext(LikedProfessorsContext);
    if (context === undefined) {
        throw new Error('useLikedProfessors must be used within a LikedProfessorsProvider');
    }
    return context;
}
