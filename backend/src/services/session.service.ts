import { query } from '../database/db.service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface SessionContext {
  rut?: string;
  bill_id?: string;
  payment_id?: string;
  waiting_for?: 'consent' | 'pin' | 'confirmation';
  [key: string]: any;
}

export class SessionService {
  async getOrCreateSession(userId?: string, phone?: string): Promise<any> {
    let session;

    if (userId) {
      const result = await query(
        `SELECT * FROM conversation_sessions
        WHERE user_id = $1 AND state = 'active'
        ORDER BY last_activity DESC LIMIT 1`,
        [userId]
      );
      session = result.rows[0];
    } else if (phone) {
      const result = await query(
        `SELECT * FROM conversation_sessions
        WHERE phone = $1 AND state = 'active'
        ORDER BY last_activity DESC LIMIT 1`,
        [phone]
      );
      session = result.rows[0];
    }

    if (!session) {
      const result = await query(
        `INSERT INTO conversation_sessions (user_id, phone, state, conversation_state, context, messages)
        VALUES ($1, $2, 'active', 'initial', '{}', '[]')
        RETURNING *`,
        [userId || null, phone || null]
      );
      session = result.rows[0];
    }

    return session;
  }

  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const message: Message = {
      role,
      content,
      timestamp: new Date()
    };

    await query(
      `UPDATE conversation_sessions
      SET messages = messages || $1::jsonb,
          last_activity = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $2`,
      [JSON.stringify(message), sessionId]
    );
  }

  async updateContext(sessionId: string, context: Partial<SessionContext>): Promise<void> {
    await query(
      `UPDATE conversation_sessions
      SET context = context || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $2`,
      [JSON.stringify(context), sessionId]
    );
  }

  async updateConversationState(sessionId: string, state: string): Promise<void> {
    await query(
      `UPDATE conversation_sessions
      SET conversation_state = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $2`,
      [state, sessionId]
    );
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const result = await query(
      'SELECT messages FROM conversation_sessions WHERE session_id = $1',
      [sessionId]
    );

    return result.rows[0]?.messages || [];
  }

  async getContext(sessionId: string): Promise<SessionContext> {
    const result = await query(
      'SELECT context FROM conversation_sessions WHERE session_id = $1',
      [sessionId]
    );

    return result.rows[0]?.context || {};
  }

  async closeSession(sessionId: string): Promise<void> {
    await query(
      `UPDATE conversation_sessions
      SET state = 'closed',
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $1`,
      [sessionId]
    );
  }

  async cleanupInactiveSessions(hoursInactive: number = 24): Promise<void> {
    await query(
      `UPDATE conversation_sessions
      SET state = 'expired'
      WHERE state = 'active'
      AND last_activity < NOW() - INTERVAL '1 hour' * $1`,
      [hoursInactive]
    );
  }
}
