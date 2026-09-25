# Ollama Chat

A modern **Next.js + TypeScript** web app for chatting with AI models running locally via [Ollama](https://ollama.com). Full data privacy, offline capability, and zero API costs.

## About

Cloud LLM chat means sending your messages off-device and paying per token. Ollama Chat solves both by talking only to a model running on your own machine via Ollama — nothing ever leaves your device, and there's no API key or subscription to manage. It ships with two interfaces: a full-featured chat UI and a lightweight simple mode, both with real-time streaming responses.

## Demo

![Demo: asking capital of China, biggest country, clearing the chat, and a follow-up question](ollama-chat-demo.gif)

## Features

- **Two UI modes** — a polished full chat UI and a lightweight simple interface
- **Real-time streaming** — responses stream token by token as they are generated
- **Cancel mid-stream** — stop a response at any time with the Clear button
- **Local & private** — all inference runs on your machine via Ollama, no data leaves your device
- **Zero API costs** — no cloud subscriptions or API keys needed

## Requirements

- [Node.js](https://nodejs.org) 
- [Ollama](https://ollama.com) running locally on port `11434`
- A model pulled in Ollama, e.g. `ollama pull gemma3:270m`

## Getting Started

**1. Start Ollama and pull a model** (skip if already done — see [Requirements](#requirements)):
```bash
ollama pull gemma3:270m
```

**2. Install dependencies:**
```bash
npm install
```

**3. Start the app:**
```bash
npm run dev
```

**4. Open it in your browser:**
- [http://localhost:3000](http://localhost:3000) — full chat UI
- [http://localhost:3000/simple](http://localhost:3000/simple) — lightweight simple UI

Both talk to the same local Ollama model — pick whichever interface you prefer.

## Tech Stack

- [Next.js 16](https://nextjs.org) — React framework with App Router
- [TypeScript](https://www.typescriptlang.org) — strict type safety
- [Tailwind CSS v4](https://tailwindcss.com) — utility-first styling
- [Ollama](https://ollama.com) — local LLM inference

