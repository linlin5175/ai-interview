import { NextRequest, NextResponse } from "next/server";

type ChatRole = "assistant" | "user";
type ChatMessage = { role: ChatRole; content: string };

const DEFAULT_TOTAL_QUESTIONS = 3;
const MIN_TOTAL_QUESTIONS = 1;
const MAX_TOTAL_QUESTIONS = 10;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-openai-api-key")?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "請先於設定中輸入你的 OpenAI API Key。" },
      { status: 401 }
    );
  }

  let body: {
    jobDescription?: string;
    messages?: ChatMessage[];
    totalQuestions?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const jobDescription = (body.jobDescription ?? "").trim();
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const totalQuestions = clampTotalQuestions(body.totalQuestions);

  if (!jobDescription) {
    return NextResponse.json({ error: "請提供職缺描述" }, { status: 400 });
  }

  const answeredCount = messages.filter((m) => m.role === "user").length;
  const isFinalRound = answeredCount >= totalQuestions;

  const conversationText = messages
    .map((m) => `${m.role === "assistant" ? "面試官" : "應徵者"}: ${m.content}`)
    .join("\n");

  const systemPrompt = isFinalRound
    ? buildEvaluationPrompt(jobDescription, totalQuestions)
    : buildQuestionPrompt(jobDescription, answeredCount, totalQuestions);

  const userPrompt = conversationText
    ? `以下是目前為止的面試對話紀錄：\n${conversationText}`
    : "這是面試的開始，尚未有任何對話紀錄。";

  let completion: Response;
  try {
    completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: "無法連線至 OpenAI API" }, { status: 502 });
  }

  if (!completion.ok) {
    const errText = await completion.text();
    return NextResponse.json(
      { error: `OpenAI API 錯誤：${errText}` },
      { status: 502 }
    );
  }

  const data = await completion.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI 回應格式錯誤，請重試" }, { status: 502 });
  }

  if (isFinalRound) {
    const askedQuestions = messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content);
    const suggestedAnswers = Array.isArray(parsed.suggestedAnswers)
      ? (parsed.suggestedAnswers as unknown[]).map((a) => String(a))
      : [];

    return NextResponse.json({
      done: true,
      evaluation: {
        score: parsed.score,
        summary: parsed.summary,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        questionFeedback: askedQuestions.map((question, i) => ({
          question,
          suggestedAnswer: suggestedAnswers[i] ?? "",
        })),
      },
    });
  }

  return NextResponse.json({
    done: false,
    question: parsed.question,
    questionNumber: answeredCount + 1,
    totalQuestions,
  });
}

function clampTotalQuestions(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TOTAL_QUESTIONS;
  return Math.min(MAX_TOTAL_QUESTIONS, Math.max(MIN_TOTAL_QUESTIONS, Math.round(n)));
}

function buildQuestionPrompt(
  jobDescription: string,
  answeredCount: number,
  totalQuestions: number
) {
  return `你是一位經驗豐富的技術面試官，正在針對以下職缺描述面試一位應徵者。

職缺描述：
${jobDescription}

這是面試的第 ${answeredCount + 1} 題（總共 ${totalQuestions} 題）。
請根據職缺描述與目前為止的對話紀錄（若應徵者已經回答過問題，請適度追問或延伸其回答，而不是問完全無關的問題），提出「一個」切題且有深度的面試問題。
請只輸出 JSON，格式為：{"question": "你的問題"}，不要包含其他文字或說明。全程使用繁體中文。`;
}

function buildEvaluationPrompt(jobDescription: string, totalQuestions: number) {
  return `你是一位經驗豐富的技術面試官，剛完成針對以下職缺描述的模擬面試（共 ${totalQuestions} 題問答）。

職缺描述：
${jobDescription}

請根據完整的面試對話紀錄，給予應徵者整體評分與建議，並針對「每一題」提供更好的回答方式參考。
請只輸出 JSON，格式為：
{
  "score": 0到100之間的整數,
  "summary": "整體評語（約2到4句）",
  "strengths": ["優點1", "優點2"],
  "improvements": ["建議1", "建議2"],
  "suggestedAnswers": ["針對第1題，更好的回答方式或參考答案（具體、可操作，約3到6句）", "針對第2題的建議答案", "..."]
}
suggestedAnswers 陣列的元素數量與順序，必須與對話紀錄中「面試官」提出問題的數量與順序完全一致（不要輸出題目原文，只輸出建議答案）。
不要包含其他文字或說明。全程使用繁體中文。`;
}
