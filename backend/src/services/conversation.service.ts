import { AgentService } from './agent.service';
import { OrchestratorService } from './orchestrator.service';

export class ConversationService {
  private agentService: AgentService;
  private orchestratorService: OrchestratorService;

  constructor() {
    this.agentService = new AgentService();
    this.orchestratorService = new OrchestratorService();
  }

  async processMessage(userMessage: string, userId?: string): Promise<{ humanResponse: string; actionResult?: any }> {
    const agentResponse = await this.agentService.execute(userMessage);

    const actionResult = await this.orchestratorService.execute(agentResponse, userId);

    const humanResponse = this.extractHumanMessage(agentResponse);

    return {
      humanResponse,
      actionResult
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
