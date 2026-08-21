import assert from 'node:assert/strict';
import test from 'node:test';

import { approveWithdrawalRequest, createWithdrawalRequest } from '../lib/withdrawal.ts';

function buildSupabaseState() {
  const state = {
    withdrawal_requests: [
      {
        id: 'req-1',
        user_id: 'user-1',
        amount: 1500,
        currency: 'USD',
        method: 'bank',
        wallet_address: null,
        bank_account: {
          bankName: 'Atlas Bank',
          accountName: 'Test User',
          accountNumber: '123456789',
        },
        status: 'Fee pending',
        note: 'Bank withdrawal request submitted',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    user_balances: [
      {
        user_id: 'user-1',
        balance: 5200,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  const getWithdrawal = (id) => state.withdrawal_requests.find((row) => row.id === id) ?? null;

  const client = {
    from(tableName) {
      if (tableName === 'withdrawal_requests') {
        return {
          insert(record) {
            const row = { ...record, id: 'req-2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            state.withdrawal_requests.unshift(row);
            return {
              select() {
                return {
                  single: async () => ({ data: row, error: null }),
                };
              },
            };
          },
          update(values) {
            return {
              eq(field, value) {
                return {
                  select() {
                    return {
                      single: async () => {
                        const matching = getWithdrawal(value);
                        if (!matching) return { data: null, error: { message: 'not found' } };
                        const updated = { ...matching, ...values };
                        state.withdrawal_requests = state.withdrawal_requests.map((row) => (row.id === value ? updated : row));
                        return { data: updated, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          select() {
            return {
              eq(field, value) {
                return {
                  single: async () => ({ data: getWithdrawal(value), error: null }),
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: null, error: null }),
      };
    },
    rpc(name, args) {
      if (name !== 'approve_withdrawal_and_deduct') {
        return Promise.resolve({ data: null, error: { message: `Unexpected RPC ${name}` } });
      }

      const request = getWithdrawal(args.p_withdrawal_id);
      if (!request) {
        return Promise.resolve({ data: null, error: { message: 'withdrawal request not found' } });
      }

      const balance = state.user_balances[0];
      const nextBalance = Number(balance.balance) - Number(request.amount);
      balance.balance = nextBalance;
      request.status = 'Approved';
      request.updated_at = new Date().toISOString();
      request.note = `${request.note} | Approved by ${args.p_acting_admin ?? 'admin'} at ${request.updated_at}`;

      return Promise.resolve({
        data: [{
          withdrawal_id: request.id,
          withdrawal_status: 'Approved',
          user_id: request.user_id,
          remaining_balance: nextBalance,
        }],
        error: null,
      });
    },
  };

  return { state, client };
}

test('withdrawal lifecycle keeps status and balance in sync through fee payment and approval', async () => {
  const { state, client } = buildSupabaseState();

  const created = await createWithdrawalRequest(client, {
    userId: 'user-1',
    amount: 1500,
    currency: 'USD',
    method: 'bank',
    bankAccount: {
      bankName: 'Atlas Bank',
      accountName: 'Test User',
      accountNumber: '123456789',
    },
    status: 'Fee pending',
    note: 'Bank withdrawal request submitted',
  });

  const createdRow = created.data;
  const createdStatus = state.withdrawal_requests.find((row) => row.id === createdRow.id);

  assert.equal(created.data.status, 'Fee pending');
  assert.equal(createdStatus.status, 'Fee pending');

  const approved = await approveWithdrawalRequest(client, createdRow.id, { status: 'Approved', adminName: 'admin' }, createdStatus);
  const approvedRow = state.withdrawal_requests.find((row) => row.id === createdRow.id);

  assert.equal(approved.withdrawal.status, 'Approved');
  assert.equal(approved.balance, 3700);
  assert.equal(approvedRow.status, 'Approved');
  assert.ok(String(approvedRow.note).includes('Approved by admin'));
});
