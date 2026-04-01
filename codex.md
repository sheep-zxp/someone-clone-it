支持接入任意 API,做一个套壳的Claude code agent。
要求用两个exe文件，Claude.exe是原来的登入界面用的是这个项目原本的登入
claude_rename.exe   用的是套壳的Claude agent 用的是所有 api 包括 goole openai 的api


先告诉 Codex 的总目标

把当前 Claude Code 源码改造成：

保留现有 TUI/CLI 交互体验
新增统一的 LLM Provider Adapter 层
支持用户在配置文件或环境变量里填写：
provider
apiBaseUrl
apiKey
model
可接入：
OpenAI-compatible
OpenRouter
DeepSeek
Qwen 兼容端点
Gemini 单独适配
界面显式展示真实 provider/model
不改现有工具执行、diff 预览、会话管理主流程，优先只替换“模型请求出口”
你发给 Codex 的第一段话

把下面这段直接给 Codex：

你现在在一个已经可运行的 Claude Code 源码仓库里工作。

目标：不要重写整个项目，而是在尽量少改 UI 和 agent loop 的前提下，把当前仅支持 Anthropic/现有 provider 的模型调用层，抽象成一个统一的 provider adapter，使这个项目可以继续用 Claude Code 的界面和交互流程，但底层可切换为其他大模型 API。

硬性要求：
1. 保留现有 CLI/TUI、会话流、工具调用、diff 展示、权限控制逻辑。
2. 新增统一接口 `LLMProvider`，把“发请求、流式响应、工具调用格式转换、错误处理”封装进去。
3. 先实现两个 provider：
   - AnthropicProvider（兼容现有逻辑）
   - OpenAICompatibleProvider（可用于 OpenAI / OpenRouter / DeepSeek / Qwen 兼容接口）
4. 再预留 GeminiProvider 的接口骨架。
5. 配置中允许指定：
   - provider
   - apiBaseUrl
   - apiKey
   - model
   - temperature
   - maxTokens
   - timeout
6. UI 必须明确显示当前真实 provider 和 model，不能伪装成 Claude。
7. 所有改动优先保持向后兼容。
8. 先做最小可运行版本（MVP），然后再补工具调用兼容和参数适配。
9. 为每一步修改输出：
   - 修改了哪些文件
   - 为什么这样改
   - 下一步验证命令
10. 不要泛泛而谈，直接读仓库并开始定位相关文件。
再给 Codex 的具体任务拆解
任务 1：先定位源码里的关键入口

让 Codex 先找这些东西：

先全仓搜索并列出以下入口文件或模块：
- CLI/TUI 启动入口
- 聊天会话状态管理
- 模型请求发送层 / API client
- streaming 处理逻辑
- tool use / function calling 相关逻辑
- model picker 或 settings/config schema
- 环境变量读取位置
- provider / auth / headers 构造位置

输出一个简短映射表：
[模块职责] -> [文件路径] -> [建议改动]
然后开始实施最小侵入式重构。

你要的不是让它空讲，而是先把 repo 结构摸清。

任务 2：让它先抽象统一接口

告诉 Codex 新建一个 provider 抽象，例如：

export interface LLMProvider {
  name: string;

  sendMessage(req: ProviderRequest): Promise<ProviderResponse>;

  streamMessage(
    req: ProviderRequest,
    handlers: {
      onTextDelta?: (delta: string) => void;
      onReasoningDelta?: (delta: string) => void;
      onToolCallStart?: (toolCall: ToolCall) => void;
      onToolCallDelta?: (delta: unknown) => void;
      onToolCallEnd?: (toolCall: ToolCall) => void;
      onComplete?: (res: ProviderResponse) => void;
      onError?: (err: Error) => void;
    }
  ): Promise<void>;
}

再让它统一这些中间数据结构：

type ProviderRequest = {
  system?: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

type ProviderResponse = {
  text?: string;
  toolCalls?: ToolCall[];
  raw?: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
};

重点是：先在项目内部统一格式，再做各 provider 的进出转换。

任务 3：先保留 Anthropic 旧逻辑，包一层适配器

告诉 Codex：

不要一上来删旧代码。
先把当前 Anthropic 的请求逻辑包装成 `AnthropicProvider`，确保现有默认流程完全不坏。
如果当前项目已有 provider/config 机制，优先复用，而不是重新发明。

这样做的目的是：

先不破坏当前可运行版本
给后面加 OpenAI-compatible 留参照物
任务 4：新增 OpenAI-compatible provider

这是最关键的一步。你让 Codex 做：

实现 `OpenAICompatibleProvider`，支持通过配置指定：
- apiBaseUrl
- apiKey
- model

默认请求路径使用 chat/completions 或 responses（二选一，优先选择当前项目更容易接入的那个）。
要求支持：
- 非流式输出
- 流式文本输出
- 基础 tool/function calling
- 错误码与超时处理
- 将 provider 的返回格式转换为项目内部统一格式
这里要特别要求 Codex 处理的差异

因为 Anthropic 和 OpenAI-compatible 之间经常有这些差异：

消息格式不同
Anthropic 常有 system、messages 特定结构
OpenAI-compatible 常是 role-based messages
工具调用字段不同
Anthropic 的 tool use block
OpenAI-compatible 的 tool_calls / function_call
流式事件不同
Anthropic 的 event 类型
OpenAI-compatible 的 SSE chunk 格式
停止原因不同
tool_use
stop
length
content_filter

所以你直接让 Codex加一个转换层：

新增 `normalizers/` 或 `adapters/` 目录，至少实现：
- anthropicToInternal
- openaiCompatibleToInternal
- internalToAnthropic
- internalToOpenAICompatible
任务 5：配置系统要这样改

让 Codex 增加一个新的配置段，类似：

{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "apiBaseUrl": "",
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "temperature": 0.2,
    "maxTokens": 8192,
    "timeoutMs": 120000
  }
}

然后支持：

provider = anthropic
provider = openai-compatible
以后预留 gemini

并且环境变量允许覆盖：

APP_LLM_PROVIDER=
APP_LLM_MODEL=
APP_LLM_BASE_URL=
APP_LLM_API_KEY=
APP_LLM_TIMEOUT_MS=

再让它做配置优先级：

CLI 参数 > 环境变量 > 用户配置文件 > 默认值

任务 6：UI 只改最少，但必须改对

Claude Code 的 changelog 里已经提到它会显示 provider-specific model names。你可以让 Codex 顺着这个思路继续做：在状态栏、设置页、日志页都显示真实 provider/model。

你直接让它做这几个显示：

在以下位置增加真实模型标识：
- 启动欢迎信息
- /model 或设置页
- 状态栏/底部栏
- 调试日志
格式示例：
Provider: OpenAI-Compatible
Model: deepseek-chat
Base URL: https://api.deepseek.com
任务 7：工具调用兼容要分两阶段

不要一开始就要求它 100% 完美兼容。

第一阶段

只做：

普通文本对话
流式输出
基础代码编辑任务
第二阶段

再做：

tools / function calling
tool result 回填
多轮 agent loop
retry / backoff
usage 统计

你可以直接这样给 Codex：

分阶段实施：

Phase 1:
- 让 OpenAI-compatible provider 能完成普通对话和流式输出
- 跑通现有 agent loop 的最基本一次请求
- UI 正常显示回复

Phase 2:
- 接入工具调用
- 将 provider 返回的工具调用映射成项目内部 tool call
- 将 tool result 再喂回模型
- 确保至少一个现有工具链路可跑通
任务 8：要它写测试，不然很容易越改越坏

你让 Codex 至少补这几类测试：

请新增最小测试覆盖：
1. config 解析测试
2. provider 选择测试
3. internal <-> anthropic 格式转换测试
4. internal <-> openai-compatible 格式转换测试
5. 流式 chunk 拼接测试
6. tool call 映射测试
7. 回退到 Anthropic 默认配置的兼容测试

如果这个项目没有测试框架，也让它先补最小 smoke test。

任务 9：让它给你一个最小可跑 demo

让 Codex 最后产出：

一个本地配置示例
一个启动命令
一个用 DeepSeek 或 OpenRouter 跑的演示配置

你可以直接给它这个要求：

完成后请输出：
- 一个 `example.settings.json`
- 一个 `.env.example`
- 一个最小运行步骤
- 一个使用 openai-compatible 接 DeepSeek 的示例
- 一个使用 openai-compatible 接 OpenRouter 的示例


