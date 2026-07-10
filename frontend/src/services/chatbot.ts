import { apiClient } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommended_tools?: RecommendedTool[];
  timestamp: Date;
}

export interface RecommendedTool {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  url: string;
}

interface ChatbotResponse {
  message: string;
  recommended_tools: RecommendedTool[];
}

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
}

export const chatbotService = {
  async sendMessage(
    message: string,
    conversationHistory: ConversationEntry[]
  ): Promise<ChatbotResponse> {
    const response = await apiClient.post<ChatbotResponse>('/chatbot/', {
      message,
      conversation_history: conversationHistory,
    });
    return response;
  },
};
