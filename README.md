![1](https://github.com/user-attachments/assets/f15a9a90-45b9-4778-a0f8-bab63027cbf6)


# Some one clone it

基于 Claude Code 泄露源码修复的 **本地可运行版本 + 多模型接入版**

👉 支持：
- Claude Code 原版 TUI
- 自定义 API（OpenAI / MiniMax / Kimi / DeepSeek 等）
- Windows 双 EXE 启动器
- 多 Provider 切换

---

## ✨ 特性

- ✅ 完整 Claude Code TUI（React + Ink）
- ✅ 多模型支持（OpenAI / Anthropic-compatible / OpenRouter / Google）
- ✅ Windows 双启动器（Claude.exe + claude_rename.exe）
- ✅ 支持任意 API Base URL
- ✅ 无头模式（CLI / 脚本）
- ✅ Recovery CLI 降级模式

---

## 🧠 核心能力（本项目亮点）

```text
Claude Code UI
        ↓
   Provider Layer
   ├── anthropic-compatible → MiniMax
   ├── openai → GPT
   ├── openrouter → 多模型
   ├── google → Gemini

👉 实现：Claude UI + 任意大模型

⚡最重要：怎么打包成 EXE
1️⃣ 先安装依赖
bun install
2️⃣ 一键打包
npm run build:windows-exe
3️⃣ 打包完成后

会生成：

dist/
 ├── Claude.exe
 ├── claude_rename.exe
🧠 两个 exe 是干嘛的？
🟢 Claude.exe

👉 原版入口（基本不用）

🔥 claude_rename.exe（重点用这个）

👉 你改 API / 接大模型都用它

🧪 第一次运行会让你输入这些👇

打开：

claude_rename.exe

你会看到：

Welcome name:
API Base URL:
Model name:
API Key:
🔥 怎么填（最关键）
✅ 用 GPT（OpenAI）
Base URL:
https://api.openai.com/v1

Model:
gpt-4.1

API Key:
sk-xxx

⚠️ 必须先充值，不然报 429

✅ 用 Kimi（推荐国内）
Base URL:
https://api.moonshot.cn/v1

Model:
moonshot-v1-8k

API Key:
你的 key
✅ 用 MiniMax（最稳）
Base URL:
https://api.minimaxi.com/anthropic

Model:
MiniMax-M2.7-highspeed

API Key:
你的 key
🟢 方式一：Anthropic-compatible（推荐先跑通）
HAHA_API_PROVIDER=anthropic-compatible

ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_API_KEY=your_key

ANTHROPIC_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M2.7-highspeed
🔵 方式二：OpenAI（GPT）
HAHA_API_PROVIDER=openai

OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1

⚠️ 注意：

必须开通 billing，否则会报 insufficient_quota
OpenAI ≠ Anthropic-compatible
🟣 方式三：Kimi（Moonshot）
HAHA_API_PROVIDER=openai

OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=moonshot-v1-8k
🟡 方式四：OpenRouter
HAHA_API_PROVIDER=openrouter

OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o
🖥️ 运行方式
✅ 方式一：源码运行
bun run src/entrypoints/cli.tsx

或：

./bin/claude-haha
✅ 方式二：Windows 双启动器
Claude（原始登录流）
.\bin\windows\Claude.cmd
claude_rename（多模型入口）
.\bin\windows\claude_rename.cmd
📦 EXE 打包
npm run build:windows-exe

输出：

dist/
 ├── Claude.exe
 ├── claude_rename.exe
⚠️ EXE 说明（重要）

本项目采用：

👉 轻量 EXE（Launcher 模式）

运行需要：

Bun 已安装
项目源码存在
node_modules 存在
🧪 使用示例
# TUI 模式
claude_rename.exe

# 单次问答
claude_rename.exe -p "hello"

# 管道
echo "explain this code" | claude_rename.exe -p
⚙️ Recovery 模式（无 UI）
CLAUDE_CODE_FORCE_RECOVERY_CLI=1 claude_rename.exe
🔧 常见问题
❗429 insufficient_quota

👉 没开 OpenAI billing

❗模型不可用

👉 模型名和 provider 不匹配

❗Anthropic-compatible 不能用 GPT

👉 这是两套协议

🧱 项目结构
src/
├── entrypoints/
├── components/
├── tools/
├── services/
├── commands/
├── hooks/
└── utils/
🧠 技术栈
类别	技术
Runtime	Bun
UI	React + Ink
CLI	Commander
Language	TypeScript
⚠️ Disclaimer

本项目基于 Claude Code 泄露源码，仅供学习研究。
