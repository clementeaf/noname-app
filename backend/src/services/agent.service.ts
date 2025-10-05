import OpenAI from 'openai';
import { AGENT_SYSTEM_PROMPT } from '../config/prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AgentService {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = AGENT_SYSTEM_PROMPT;
  }

  async execute(userMessage: string, messageHistory: Message[] = []): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messageHistory,
      { role: 'user', content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}
