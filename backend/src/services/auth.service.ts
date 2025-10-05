import bcrypt from 'bcrypt';
import { query } from '../database/db.service';

const SALT_ROUNDS = 10;

export class AuthService {
  async hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, SALT_ROUNDS);
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const result = await query(
      'SELECT pin_hash FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].pin_hash) {
      return false;
    }

    return bcrypt.compare(pin, result.rows[0].pin_hash);
  }

  async setPinForUser(userId: string, pin: string): Promise<void> {
    const hashedPin = await this.hashPin(pin);
    await query(
      'UPDATE users SET pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hashedPin, userId]
    );
  }

  async grantConsent(userId: string): Promise<void> {
    await query(
      'UPDATE users SET consent_granted = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  }

  async hasConsent(userId: string): Promise<boolean> {
    const result = await query(
      'SELECT consent_granted FROM users WHERE user_id = $1',
      [userId]
    );

    return result.rows[0]?.consent_granted || false;
  }
}
