/**
 * @fileoverview Gemini Function Calling Tool Declarations for Agentic AI Action Execution.
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
      },
      required: ['amount', 'type', 'description'],
    },
  },
  {
    name: 'setBudgetLimit',
    description: 'Set or update the monthly spending cap for a specific budget category.',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoryName: { type: 'STRING', description: 'Category to cap' },
        monthlyLimit: { type: 'NUMBER', description: 'Monthly limit in user currency' },
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
];
