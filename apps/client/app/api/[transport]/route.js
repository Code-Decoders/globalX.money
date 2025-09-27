// @ts-nocheck
/**
 * @fileoverview MCP (Multi-Capability Provider) API route (JavaScript mode).
 * Tools: createRecipient, getRecipient, getQuote, finalizePayment.
 * Workflow:
 * 1. createRecipient   -> register payout recipient.
 * 2. getRecipient      -> resolve recipient id by id or name.
 * 3. getQuote          -> obtain FX quote for amount & recipient.
 * 4. finalizePayment   -> quote -> create internal transaction -> claim/hold.
 */

import { createMcpHandler } from "@vercel/mcp-adapter";
import { NextResponse } from "next/server";
import { z } from "zod";

const STATIC_WALLET_ADDRESS = "0x36477aBc75d65ADB08Df38C63b21Be468a4B9767"; // Static wallet for all MCP operations.

// Utility to build absolute URLs to internal API routes.
const buildUrl = (origin, path) => `${origin.replace(/\/$/, "")}${path.startsWith('/') ? '' : '/'}${path}`;

// Reusable helper for JSON POST fetch with robust error surfacing.
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    // Revalidate / no cache since these are transactional operations.
    cache: 'no-store',
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// Helper for GET JSON.
async function getJson(url) {
  console.log('GET', url);
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// Main handler function for GET, POST, DELETE requests to this API route.
const handler = async (req) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MCP Transport Route] Received ${req.method} request to ${req.nextUrl.pathname}`);
  }
  const origin = "https://globalx.codedecoders.io"

  return createMcpHandler(
    async (server) => {
      // =============================================================
      // Tool: createRecipient
      // =============================================================
      server.tool(
        'createRecipient',
        'Create (register) a new payout recipient (bank account). Uses a static wallet address (no input needed).',
        {
          // walletAddress removed – static value injected.
          type: z.enum(['individual', 'business']).default('individual').describe('Recipient type.'),
          firstName: z.string().optional().describe('First name (required if individual and lastName missing).'),
          lastName: z.string().optional().describe('Last name (required if individual and firstName missing).'),
          businessName: z.string().optional().describe('Business legal name (required if type = business).'),
          email: z.string().email().optional(),
            phone: z.string().optional(),
          accountNumber: z.string().describe('Bank account number.'),
          ifsc: z.string().describe('IFSC / routing code.'),
          bankName: z.string().describe('Bank name.'),
          accountHolder: z.string().describe('Account holder name.'),
          branch: z.string().optional(),
          accountType: z.string().optional().describe('e.g. savings, current, other.'),
        },
        async (input) => {
          try {
            const payload = { ...input, walletAddress: STATIC_WALLET_ADDRESS };
            const data = await postJson(buildUrl(origin, '/api/recipients'), payload);
            return {
              structuredContent: { action: 'createRecipient', success: true, recipient: data?.recipient, gpsRecipient: data?.gpsRecipient },
              content: [ { type: 'text', text: `Recipient created with id ${data?.recipient?.id}` } ],
            };
          } catch (e) {
            return {
              structuredContent: { action: 'createRecipient', success: false, error: e.message },
              content: [ { type: 'text', text: `Failed to create recipient: ${e.message}` } ],
            };
          }
        }
      );

      // =============================================================
      // Tool: getRecipient (replaces listRecipients)
      // =============================================================
      server.tool(
        'getRecipient',
        'Retrieve a single recipient by exact id or by a provided name (matches businessName, accountHolder, or first/last name).',
        {
          name: z.string().optional().describe('Name to match if id not supplied (case-insensitive, matches businessName, accountHolder, first/last).'),
          allowPartial: z.boolean().optional().default(true).describe('If true, allows substring/partial matches; otherwise requires exact match.'),
        },
        async ({ name, allowPartial }) => {
          if (!name) {
            return {
              structuredContent: { action: 'getRecipient', success: false, error: 'Provide id or name.' },
              content: [ { type: 'text', text: 'You must supply either an id or a name to lookup a recipient.' } ],
            };
          }
          try {
            const url = buildUrl(origin, `/api/recipients?walletAddress=${encodeURIComponent(STATIC_WALLET_ADDRESS)}`);
            const data = await getJson(url);
            const recipients = data?.recipients || [];

            const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

            let found = [];
        if (name) {
              const target = norm(name);
              found = recipients.filter((r) => {
                const firstLast = [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
                const candidates = [r.businessName, r.accountHolder, r.firstName, r.lastName, firstLast];
                return candidates.some(c => {
                  const n = norm(c);
                  if (!n) return false;
                  return allowPartial ? n.includes(target) || target.includes(n) : n === target;
                });
              });
            }

            if (found.length === 0) {
              return {
                structuredContent: { action: 'getRecipient', success: false, error: 'No matching recipient.' },
                content: [ { type: 'text', text: 'No recipient matched the provided criteria.' } ],
              };
            }
            if (found.length > 1) {
              return {
                structuredContent: { action: 'getRecipient', success: false, error: 'Ambiguous match', matches: found.map(r => ({ id: r.id, name: r.businessName || r.accountHolder || [r.firstName, r.lastName].filter(Boolean).join(' ') })) },
                content: [ { type: 'text', text: `Multiple matches found (${found.length}). Please refine by id. IDs: ${found.map(r => r.id).join(', ')}` } ],
              };
            }

            const recipient = found[0];
            return {
              structuredContent: { action: 'getRecipient', success: true, recipientId: recipient.id, recipient },
              content: [ { type: 'text', text: `Recipient resolved: ${recipient.id}` } ],
            };
          } catch (e) {
            return {
              structuredContent: { action: 'getRecipient', success: false, error: e.message },
              content: [ { type: 'text', text: `Failed to lookup recipient: ${e.message}` } ],
            };
          }
        }
      );

      // =============================================================
      // Tool: getQuote
      // =============================================================
      server.tool(
        'getQuote',
        'Generate an FX quote for a transfer to a recipient.',
        {
          recipientId: z.string().describe('Recipient ID (must already exist).'),
          fromAmount: z.union([z.string(), z.number()]).describe('Amount to send in source currency.'),
          fromCurrency: z.string().default('USD').describe('Source currency (default USD).'),
          toCurrency: z.string().default('INR').describe('Destination currency (default INR).'),
          senderId: z.string().optional().describe('Optional override senderId; usually not needed.'),
        },
        async ({ recipientId, fromAmount, fromCurrency, toCurrency, senderId }) => {
          const payload = {
            recipientId,
            fromAmount: String(fromAmount),
            fromCurrency,
            toCurrency,
            senderId,
          };
          try {
            const data = await postJson(buildUrl(origin, '/api/gps/quote'), payload);
            return {
              structuredContent: { action: 'getQuote', success: true, quote: data?.data ?? data },
              content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ],
            };
          } catch (e) {
            return {
              structuredContent: { action: 'getQuote', success: false, error: e.message },
              content: [ { type: 'text', text: `Quote generation failed: ${e.message}` } ],
            };
          }
        }
      );

      // =============================================================
      // Tool: finalizePayment
      // =============================================================
      server.tool(
        'finalizePayment',
        'End-to-end: quote -> create transaction -> claim/hold (static wallet address used).',
        {
          recipientId: z.string().describe('Existing recipient ID to receive funds.'),
          fromAmount: z.union([z.string(), z.number()]).describe('Amount to send in source currency.'),
          purposeOfPayment: z.string().describe('Regulatory / business purpose of payment.'),
          notes: z.string().optional().describe('Optional notes for the transaction.'),
          fromCurrency: z.string().default('USD'),
          toCurrency: z.string().default('INR'),
        },
        async (input) => {
          /** @type {any} */
          const phase = { action: 'finalizePayment', walletAddress: STATIC_WALLET_ADDRESS };
          try {
            const quotePayload = {
              recipientId: input.recipientId,
              fromAmount: String(input.fromAmount),
              fromCurrency: input.fromCurrency,
              toCurrency: input.toCurrency,
            };
            const quoteResp = await postJson(buildUrl(origin, '/api/gps/quote'), quotePayload);
            const quote = quoteResp?.data ?? quoteResp;
            phase.quote = quote;

            const quoteId = quote?.id;
            const quoteExpiresAt = quote?.expiresAt || quote?.expiry || null;

            const transactionPayload = {
              senderWallet: STATIC_WALLET_ADDRESS,
              recipientId: input.recipientId,
              fromAmount: String(input.fromAmount),
              purposeOfPayment: input.purposeOfPayment,
              notes: input.notes ?? '',
              currencyFrom: input.fromCurrency,
              currencyTo: input.toCurrency,
              quoteId: quoteId ?? null,
              quoteSnapshot: quote,
              quoteExpiresAt,
            };
            const txnResp = await postJson(buildUrl(origin, '/api/transactions'), transactionPayload);
            const transaction = txnResp?.transaction ?? txnResp;
            phase.transaction = transaction;
            phase.claimUrl = txnResp?.claimUrl;

            const claimBody = { recipientId: input.recipientId, action: 'claim' };
            const claimResp = await postJson(buildUrl(origin, `/api/transactions/${transaction.id}/claim`), claimBody);
            phase.claim = claimResp;

            return {
              structuredContent: { success: true, ...phase },
              content: [ { type: 'text', text: `Payment finalized for static wallet. Transaction ${transaction.id} ${input.action === 'hold' ? 'placed on hold' : 'claimed'} successfully.` } ],
            };
          } catch (e) {
            phase.error = e.message;
            return {
              structuredContent: { success: false, ...phase },
              content: [ { type: 'text', text: `Failed to finalize payment: ${e.message}` } ],
            };
          }
        }
      );
    },
    // --- MCP Configuration ---
    {
      capabilities: {
        tools: {
          createRecipient: { description: 'Register a new payout recipient (static wallet).' },
          getRecipient: { description: 'Get a single recipient by id or name (static wallet).' },
          getQuote: { description: 'Generate FX quote for a recipient & amount.' },
          finalizePayment: { description: 'Quote + transaction + claim (static wallet).' },
        },
      },
    },
    // Adapter options
    {
      basePath: '/api',
      verboseLogs: process.env.NODE_ENV !== 'production',
      maxDuration: 60,
      redisUrl: process.env.REDIS_URL,
    }
  )(req);
};

export { handler as GET, handler as POST, handler as DELETE };