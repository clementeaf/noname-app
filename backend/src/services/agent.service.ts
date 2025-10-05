import OpenAI from 'openai';
import { AGENT_SYSTEM_PROMPT } from '../config/prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AgentService {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = AGENT_SYSTEM_PROMPT;
  }

  async execute(userMessage: string): Promise<string> {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userMessage }
      ],
    });

    return completion.choices[0].message.content || '';
  }
}
