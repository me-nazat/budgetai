/**
 * @fileoverview Gemini Function Calling Tool Declarations for Agentic AI Action Execution (Module 19).
 * Defines staged, verifiable financial mutation tools.
 */

export const AGENT_TOOLS = [
  {
    name: 'createTransaction',
    description: 'Create a new expense or income record in the user financial ledger.',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: { type: 'NUMBER', description: 'Transaction amount' },
        type: { type: 'STRING', enum: ['EXPENSE', 'INCOME'] },
        description: { type: 'STRING', description: 'Merchant or description note' },
        categoryName: { type: 'STRING', description: 'Category name' },
        date: { type: 'STRING', description: 'ISO Date YYYY-MM-DD' },
        accountId: { type: 'NUMBER', description: 'Optional ID of the target account' },
      },
      required: ['amount', 'type', 'description'],
    },
  },
  {
    name: 'setBudgetLimit',
    description: 'Set or update the monthly spending cap for a specific budget category envelope.',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoryName: { type: 'STRING', description: 'Category to cap' },
        monthlyLimit: { type: 'NUMBER', description: 'Monthly limit in user currency' },
        oldLimit: { type: 'NUMBER', description: 'Previous monthly limit if updating' },
      },
      required: ['categoryName', 'monthlyLimit'],
    },
  },
  {
    name: 'createSavingsGoal',
    description: 'Create a new target savings goal or milestone vault.',
    parameters: {
      type: 'OBJECT',
      properties: {
        goalName: { type: 'STRING', description: 'Name of the goal' },
        targetAmount: { type: 'NUMBER', description: 'Target money amount' },
        targetDate: { type: 'STRING', description: 'Target date YYYY-MM-DD' },
      },
      required: ['goalName', 'targetAmount'],
    },
  },
  {
    name: 'transferBetweenAccounts',
    description: 'Transfer funds between two accounts belonging to the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fromAccountId: { type: 'NUMBER', description: 'Source account ID' },
        toAccountId: { type: 'NUMBER', description: 'Destination account ID' },
        amount: { type: 'NUMBER', description: 'Amount to transfer' },
        description: { type: 'STRING', description: 'Transfer note or description' },
      },
      required: ['fromAccountId', 'toAccountId', 'amount'],
    },
  },
  {
    name: 'createAutomationRule',
    description: 'Creates a recurring merchant auto-categorization rule.',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: { type: 'STRING', description: 'Merchant or description keyword to match' },
        category: { type: 'STRING', description: 'Category to automatically assign' },
      },
      required: ['keyword', 'category'],
    },
  },
];

// Snake-case aliases for API mapping
export const create_transaction = 'createTransaction';
export const update_budget_limit = 'setBudgetLimit';
export const transfer_between_accounts = 'transferBetweenAccounts';
export const create_automation_rule = 'createAutomationRule';
