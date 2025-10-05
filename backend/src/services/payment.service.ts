import { query } from '../database/db.service';
import { AuthService } from './auth.service';

interface FindAccountsParams {
  rut: string;
}

interface ListPendingParams {
  account_ids: string[];
}

interface PreparePaymentParams {
  bill_id: string;
  method: 'USDT' | 'USDC' | 'BTC' | 'CARD' | 'BANK';
  user_rut: string;
}

interface ExecutePaymentParams {
  payment_id: string;
  confirm_pin: string;
  force?: boolean;
}

export class PaymentService {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async findAccounts(params: FindAccountsParams) {
    const { rut } = params;

    const result = await query(
      `SELECT
        ua.account_id,
        sp.name as provider,
        sp.service_type,
        ua.contract_number,
        ua.meter_id,
        ua.status,
        (SELECT amount_clp FROM bills WHERE account_id = ua.account_id ORDER BY created_at DESC LIMIT 1) as last_bill_amount,
        (SELECT period FROM bills WHERE account_id = ua.account_id ORDER BY created_at DESC LIMIT 1) as last_bill_period
      FROM user_accounts ua
      JOIN users u ON ua.user_id = u.user_id
      JOIN service_providers sp ON ua.provider_id = sp.provider_id
      WHERE u.rut = $1`,
      [rut]
    );

    return result.rows;
  }

  async listPending(params: ListPendingParams) {
    const { account_ids } = params;

    const result = await query(
      `SELECT
        bill_id,
        account_id,
        amount_clp,
        due_date,
        period,
        status
      FROM bills
      WHERE account_id = ANY($1) AND status = 'pending'
      ORDER BY due_date ASC`,
      [account_ids]
    );

    return result.rows;
  }

  async preparePayment(params: PreparePaymentParams) {
    const { bill_id, method, user_rut } = params;

    const billResult = await query(
      'SELECT amount_clp, account_id FROM bills WHERE bill_id = $1',
      [bill_id]
    );

    if (billResult.rows.length === 0) {
      throw new Error('Bill not found');
    }

    const bill = billResult.rows[0];
    const userResult = await query('SELECT user_id FROM users WHERE rut = $1', [user_rut]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user_id = userResult.rows[0].user_id;
    let amount_crypto = null;
    let exchange_rate = null;
    let fee = 0;

    if (['USDT', 'USDC', 'BTC'].includes(method)) {
      exchange_rate = method === 'BTC' ? 0.000015 : 0.0011;
      amount_crypto = bill.amount_clp * exchange_rate;
      fee = bill.amount_clp * 0.02;
    } else {
      fee = bill.amount_clp * 0.01;
    }

    const total = parseFloat(bill.amount_clp) + fee;
    const expires_at = new Date(Date.now() + 15 * 60 * 1000);

    const paymentResult = await query(
      `INSERT INTO payments (bill_id, user_id, method, amount_clp, amount_crypto, exchange_rate, fee, total, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      RETURNING payment_id, bill_id, amount_clp, amount_crypto, exchange_rate, fee, total, expires_at`,
      [bill_id, user_id, method, bill.amount_clp, amount_crypto, exchange_rate, fee, total, expires_at]
    );

    return paymentResult.rows[0];
  }

  async executePayment(params: ExecutePaymentParams) {
    const { payment_id, confirm_pin, force } = params;

    const paymentResult = await query(
      `SELECT p.*, u.user_id
      FROM payments p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.payment_id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'pending' && !force) {
      throw new Error('Payment already processed');
    }

    const pinValid = await this.authService.verifyPin(payment.user_id, confirm_pin);
    if (!pinValid) {
      throw new Error('Invalid PIN');
    }

    const tx_id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const confirmed_at = new Date();

    await query(
      `UPDATE payments
      SET status = 'confirmed', tx_id = $1, confirmed_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE payment_id = $3`,
      [tx_id, confirmed_at, payment_id]
    );

    await query(
      `UPDATE bills SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE bill_id = $1`,
      [payment.bill_id]
    );

    return {
      tx_id,
      status: 'confirmed',
      receipt_url: `https://receipts.example.com/${tx_id}`,
      timestamp: confirmed_at
    };
  }
}
