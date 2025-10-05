import { AgentService } from './agent.service';
import { OrchestratorService } from './orchestrator.service';
import { SessionService } from './session.service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export class ConversationService {
  private agentService: AgentService;
  private orchestratorService: OrchestratorService;
  private sessionService: SessionService;

  constructor() {
    this.agentService = new AgentService();
    this.orchestratorService = new OrchestratorService();
    this.sessionService = new SessionService();
  }

  async processMessage(userMessage: string, userId?: string, phone?: string): Promise<{
    humanResponse: string;
    actionResult?: any;
    sessionId: string;
  }> {
    const session = await this.sessionService.getOrCreateSession(userId, phone);

    await this.sessionService.addMessage(session.session_id, 'user', userMessage);

    const messageHistory = await this.sessionService.getMessages(session.session_id);
    const formattedHistory = messageHistory.map((msg: Message) => ({
      role: msg.role,
      content: msg.content
    }));

    const agentResponse = await this.agentService.execute(userMessage, formattedHistory);

    await this.sessionService.addMessage(session.session_id, 'assistant', agentResponse);

    const actionResult = await this.orchestratorService.execute(agentResponse, userId);

    const humanResponse = this.extractHumanMessage(agentResponse);

    return {
      humanResponse,
      actionResult,
      sessionId: session.session_id
    };
  }

  private extractHumanMessage(agentResponse: string): string {
    const jsonMatch = agentResponse.match(/```json\s*[\s\S]*?\s*```/);
    if (jsonMatch) {
      return agentResponse.replace(jsonMatch[0], '').trim();
    }
    return agentResponse.trim();
  }
}
