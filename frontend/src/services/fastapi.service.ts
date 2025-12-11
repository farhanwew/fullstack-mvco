//fastapi.servcie.ts
import axios from 'axios';

const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

const fastApiClient = axios.create({
  baseURL: FASTAPI_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface PredictionRequest {
  model_name: string;
  inputs: Record<string, any>;
}

export interface RecommendationRequest {
  model_name: string;
  prediction: any;
  probabilities: Record<string, number>;
  sorted_labels: string[];
  inputs: Record<string, any>;
}

export interface ChatRequest {
  message: string;
}

export interface EmailSummaryRequest {
  recommendation_record: Record<string, any>;
}

export const fastApiService = {
  // Predict endpoint
  async predict(modelName: string, inputs: Record<string, any>) {
    const response = await fastApiClient.post('/predict', {
      model_name: modelName,
      inputs: inputs,
    });
    return response.data;
  },

  // Test endpoint
  async testModel(modelName: string) {
    const response = await fastApiClient.get(`/test/${modelName}`);
    return response.data;
  },

  async testAllModels() {
    const response = await fastApiClient.get('/test/all');
    return response.data;
  },

  // Chat endpoint
  async chat(message: string) {
    const response = await fastApiClient.post('/chat', { message });
    return response.data;
  },

  // Stream Chat endpoint
  async streamChat(message: string, onChunk: (chunk: string) => void) {
    try {
      const response = await fetch(`${FASTAPI_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } catch (error) {
      console.error('Stream chat error:', error);
      throw error;
    }
  },

  // Recommendation endpoint
  async getRecommendation(
    modelName: string,
    prediction: any,
    probabilities: Record<string, number>,
    sortedLabels: string[],
    inputs: Record<string, any>
  ) {
    const response = await fastApiClient.post('/recommendation', {
      model_name: modelName,
      prediction: prediction,
      probabilities: probabilities,
      sorted_labels: sortedLabels,
      inputs: inputs,
    });
    return response.data;
  },

  // Email summary endpoint
  async getEmailSummary(recommendationRecord: Record<string, any>) {
    const response = await fastApiClient.post('/email-summary', {
      recommendation_record: recommendationRecord,
    });
    return response.data;
  },
};
