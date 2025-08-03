// src/services/api.js
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Generic CRUD functions with error handling
export const crud = (endpoint) => ({
  getAll: async () => {
    try {
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return [];
    }
  },
  
  get: async (id) => {
    try {
      const response = await api.get(`${endpoint}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}/${id}:`, error);
      return null;
    }
  },
  
  create: async (data) => {
    try {
      const response = await api.post(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`Error creating ${endpoint}:`, error);
      return null;
    }
  },
  
  update: async (id, data) => {
    try {
      const response = await api.put(`${endpoint}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating ${endpoint}/${id}:`, error);
      return null;
    }
  },
  
  delete: async (id) => {
    try {
      await api.delete(`${endpoint}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting ${endpoint}/${id}:`, error);
      return false;
    }
  }
});

// API endpoints
export const sensorsAPI = crud('/api/sensors');
export const buildingsAPI = crud('/api/buildings');
export const contactsAPI = crud('/api/contacts');
export const readingsAPI = crud('/api/readings');