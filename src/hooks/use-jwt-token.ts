// hooks/use-jwt-token.ts
import { useState, useEffect } from 'react';

// Mock authentication function - replace with your actual authentication logic
const getMockJwtToken = async () => {
    // In a real application, this would involve calling your auth API
    // (e.g., Postman's "0. Authenticate and Get Token")
    // and storing the received token securely.
    // For this example, we'll return a placeholder after a slight delay.
    console.log("Attempting to get JWT token...");
    try {
        const response = await fetch('https://chatbackend.yourfinadvisor.com/api/v1/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Access-Control-Allow-Origin': '*',
            },
            body: new URLSearchParams({
                username: 'testuser',
                password: '', // As per your Postman collection
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("JWT Token received:", data.access_token);
        return data.access_token as string;
    } catch (error) {
        console.error("Error fetching mock JWT token:", error);
        return null;
    }
};

export const useJwtToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [isLoadingToken, setIsLoadingToken] = useState(true);
    const [tokenError, setTokenError] = useState<string | null>(null);

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const fetchedToken = await getMockJwtToken();
                if (fetchedToken) {
                    setToken(fetchedToken);
                } else {
                    setTokenError("Failed to retrieve JWT token.");
                }
            } catch (error: any) {
                setTokenError(error.message || "An unknown error occurred while fetching token.");
            } finally {
                setIsLoadingToken(false);
            }
        };

        fetchToken();
    }, []);

    return { token, isLoadingToken, tokenError };
};