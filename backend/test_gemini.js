import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are a helpful expert.',
      }
    });
    const res = await chat.sendMessage({ message: "Hello!" });
    console.log("Success! Response:", res.text);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
