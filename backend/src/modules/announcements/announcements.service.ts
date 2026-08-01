import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AnnouncementsService {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model });
    }
  }

  async draft(prompt: string) {
    if (!this.model) throw new BadRequestException('GEMINI_API_KEY not configured');
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');

    const systemInstruction = `You are a church announcement writer for COHEP (Coptic Orthodox Hymn Education Platform). 
Generate a church announcement in English and Arabic based on the user's topic.
Return JSON with: title (English), titleAr (Arabic), body (English), bodyAr (Arabic).
Keep titles under 80 chars, bodies under 500 chars. Be warm and pastoral.`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { title: prompt, titleAr: '', body: text, bodyAr: '' };
    }
  }
}
