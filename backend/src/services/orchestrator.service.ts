import { PaymentService } from './payment.service';
import { query } from '../database/db.service';
import { v4 as uuidv4 } from 'uuid';

interface AgentAction {
  action: 'find_accounts' | 'list_pending' | 'prepare_payment' | 'execute_payment' | 'none';
  request_id: string;
  params: any;
  note?: string;
}

export class OrchestratorService {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  extractJSON(agentResponse: string): AgentAction | null {
    const jsonMatch = agentResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
      return null;
    }
  }

  async execute(agentResponse: string, userId?: string): Promise<any> {
    const action = this.extractJSON(agentResponse);

    if (!action || action.action === 'none') {
      await this.logAudit({
        request_id: action?.request_id || uuidv4(),
        user_id: userId,
        action: 'none',
        params: action?.params || {},
        result: { note: action?.note || 'No action required' }
      });
      return { message: 'No action to execute', note: action?.note };
    }

    try {
      let result;

      switch (action.action) {
        case 'find_accounts':
          result = await this.paymentService.findAccounts(action.params);
          break;

        case 'list_pending':
          result = await this.paymentService.listPending(action.params);
          break;

        case 'prepare_payment':
          result = await this.paymentService.preparePayment(action.params);
          break;

        case 'execute_payment':
          result = await this.paymentService.executePayment(action.params);
          break;

        default:
          throw new Error(`Unknown action: ${action.action}`);
      }

      await this.logAudit({
        request_id: action.request_id,
        user_id: userId,
        action: action.action,
        params: action.params,
        result
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logAudit({
        request_id: action.request_id,
        user_id: userId,
        action: action.action,
        params: action.params,
        error: errorMessage
      });

      throw error;
    }
  }

  private async logAudit(log: {
    request_id: string;
    user_id?: string;
    action: string;
    params: any;
    result?: any;
    error?: string;
  }) {
    await query(
      `INSERT INTO audit_log (request_id, user_id, action, params, result, error)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        log.request_id,
        log.user_id || null,
        log.action,
        JSON.stringify(log.params),
        log.result ? JSON.stringify(log.result) : null,
        log.error || null
      ]
    );
  }
}
