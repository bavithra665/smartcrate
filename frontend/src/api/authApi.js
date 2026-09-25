import apiClient from './apiClient';

export const sendOtp = (mobile) => apiClient.post('/auth/send-otp', { mobile });

export const verifyOtp = (mobile, otp) => apiClient.post('/auth/verify-otp', { mobile, otp });

export const registerFarmer = (registrationData) => apiClient.post('/auth/register', registrationData);

export const getCurrentFarmer = () => apiClient.get('/auth/me');
