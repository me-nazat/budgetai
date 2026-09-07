/**
 * @fileoverview Semantic Vector & Chunking Engine for AI Document Vault (Module 13).
 * Provides paragraph & table-aware chunking, cosine similarity, vector embeddings,
 * and prompt injection sanitization.
 *
 * @module lib/ai/semanticVector
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const VECTOR_DIMENSIONS = 1536;

/**
 * Splits document text into coherent semantic chunks along paragraph and table boundaries.
 * Max ~800 tokens (~3200 chars).
 */
export function chunkDocumentText(text: string, maxChunkTokens: number = 800): string[] {
  if (!text || !text.trim()) return [];

  const maxChars = maxChunkTokens * 4;
  // Split on double newlines (paragraphs, table blocks, or sections)
  const rawParagraphs = text.split(/(?:\r?\n){2,}/g);
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk && (currentChunk.length + trimmed.length + 2 > maxChars)) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    if (trimmed.length > maxChars) {
      // Break oversized paragraph by sentence or fixed window
      const sentenceRegex = /[^.!?]+[.!?]+(\s+|$)/g;
      const subMatches = trimmed.match(sentenceRegex) || [trimmed];
      let subChunk = '';
      for (const sub of subMatches) {
        if (subChunk.length + sub.length <= maxChars) {
          subChunk += sub;
        } else {
          if (subChunk.trim()) chunks.push(subChunk.trim());
          subChunk = sub;
        }
      }
      if (subChunk.trim()) {
        currentChunk = subChunk.trim();
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Calculates Cosine Similarity between two N-dimensional float vectors.
 * Returns a value between -1.0 and 1.0 (typically 0.0 - 1.0 for normalized embeddings).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic fallback vector generation when external embedding APIs are unreachable.
 * Uses a pseudo-random hash distribution seeded by token hashes to generate 1536-dim normalized vector.
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const vector = new Float32Array(VECTOR_DIMENSIONS);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % VECTOR_DIMENSIONS;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[idx] += sign * (1.0 / (w + 1));
  }

  // Normalize to unit length L2
  let sumSq = 0;
  for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  const result: number[] = new Array(VECTOR_DIMENSIONS);
  for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
    result[i] = Number((vector[i] / norm).toFixed(6));
  }
  return result;
}

/**
 * Generates an embedding vector for a given text snippet.
 * Prioritizes OpenAI text-embedding-3-small or Gemini text-embedding,
 * falling back to high-fidelity deterministic vector.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data[0].embedding;
      }
    } catch (err) {
      console.warn('OpenAI embedding fallback trigger:', err);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text.slice(0, 8000));
      if (result?.embedding?.values) {
        // Normalize/pad to 1536 dims if needed
        const vals = result.embedding.values;
        if (vals.length === VECTOR_DIMENSIONS) return vals;
        const padded = new Array(VECTOR_DIMENSIONS).fill(0);
        for (let i = 0; i < Math.min(vals.length, VECTOR_DIMENSIONS); i++) {
          padded[i] = vals[i];
        }
        return padded;
      }
    } catch (err) {
      console.warn('Gemini embedding fallback trigger:', err);
    }
  }

  return generateDeterministicEmbedding(text);
}

/**
 * Sanitizes context retrieved from OCR documents to neutralize prompt injection vectors
 * (e.g. "Ignore previous instructions", "<script>", system override tokens).
 */
export function sanitizeRAGContext(text: string): string {
  if (!text) return '';

  return text
    // Strip HTML/XML tags
    .replace(/<[^>]*>?/gm, '')
    // Neutralize prompt instruction override patterns
    .replace(/\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|reveal\s+secret)\b/gi, '[REDACTED_INSTRUCTION]')
    // Neutralize delimiter spoofing
    .replace(/```/g, "'''")
    .trim();
}
