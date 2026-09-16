"use client";

import { useState } from "react";

type ChatRole = "assistant" | "user";
type ChatMessage = { role: ChatRole; content: string };

type QuestionFeedback = {
  question: string;
  suggestedAnswer: string;
};

type Evaluation = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionFeedback: QuestionFeedback[];
};

type InterviewApiResponse =
  | {
      done: false;
      question: string;
      questionNumber: number;
      totalQuestions: number;
    }
  | { done: true; evaluation: Evaluation }
  | { error: string };

const DEFAULT_TOTAL_QUESTIONS = 3;
const MIN_TOTAL_QUESTIONS = 1;
const MAX_TOTAL_QUESTIONS = 10;

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(DEFAULT_TOTAL_QUESTIONS);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answerInput, setAnswerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const answeredCount = messages.filter((m) => m.role === "user").length;
  const candidateAnswers = messages.filter((m) => m.role === "user");

  async function callInterviewApi(nextMessages: ChatMessage[]) {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription, messages: nextMessages, totalQuestions }),
    });
    const data: InterviewApiResponse = await res.json();
    if (!res.ok || "error" in data) {
      throw new Error("error" in data ? data.error : "發生未知錯誤");
    }
    return data;
  }

  async function startInterview() {
    if (!jobDescription.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callInterviewApi([]);
      if (data.done) return;
      setMessages([{ role: "assistant", content: data.question }]);
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!answerInput.trim() || loading) return;
    setLoading(true);
    setError(null);
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: answerInput.trim() },
    ];
    setMessages(nextMessages);
    setAnswerInput("");
    try {
      const data = await callInterviewApi(nextMessages);
      if (data.done) {
        setEvaluation(data.evaluation);
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.question }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  function resetInterview() {
    setJobDescription("");
    setTotalQuestions(DEFAULT_TOTAL_QUESTIONS);
    setStarted(false);
    setMessages([]);
    setAnswerInput("");
    setError(null);
    setEvaluation(null);
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            AI 面試模擬器
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            輸入職缺描述與題數，AI 面試官將逐題提問，並在最後給予評分、建議與每題的參考回答。
          </p>
        </header>

        {!started && !evaluation && (
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="jobDescription"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              職缺描述
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="請貼上或輸入職缺描述，例如：徵求資深前端工程師，熟悉 React、TypeScript..."
              rows={6}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />

            <label
              htmlFor="totalQuestions"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              面試題數（{MIN_TOTAL_QUESTIONS}～{MAX_TOTAL_QUESTIONS} 題）
            </label>
            <input
              id="totalQuestions"
              type="number"
              min={MIN_TOTAL_QUESTIONS}
              max={MAX_TOTAL_QUESTIONS}
              value={totalQuestions}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isNaN(n)) return;
                setTotalQuestions(
                  Math.min(MAX_TOTAL_QUESTIONS, Math.max(MIN_TOTAL_QUESTIONS, Math.round(n)))
                );
              }}
              className="w-24 rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />

            <button
              onClick={startInterview}
              disabled={!jobDescription.trim() || loading}
              className="self-end rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {loading ? "產生問題中..." : "開始面試"}
            </button>
          </section>
        )}

        {started && !evaluation && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 ${
                    m.role === "assistant" ? "items-start" : "items-end"
                  }`}
                >
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {m.role === "assistant" ? "面試官" : "你"}
                  </span>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                      m.role === "assistant"
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              已回答 {answeredCount} / {totalQuestions} 題
            </p>

            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="輸入你的回答..."
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                onClick={submitAnswer}
                disabled={!answerInput.trim() || loading}
                className="self-end rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {loading ? "處理中..." : "送出回答"}
              </button>
            </div>
          </section>
        )}

        {evaluation && (
          <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                面試結果
              </h2>
              <span className="rounded-full bg-zinc-900 px-4 py-1 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {evaluation.score} 分
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {evaluation.summary}
            </p>
            {evaluation.strengths.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  優點
                </h3>
                <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.improvements.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  建議
                </h3>
                <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
                  {evaluation.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.questionFeedback.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  每題回顧與更好的回答方式
                </h3>
                {evaluation.questionFeedback.map((f, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      第 {i + 1} 題：{f.question}
                    </p>
                    {candidateAnswers[i] && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium">你的回答：</span>
                        {candidateAnswers[i].content}
                      </p>
                    )}
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">更好的回答方式：</span>
                      {f.suggestedAnswer}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={resetInterview}
              className="self-start rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              重新開始
            </button>
          </section>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
