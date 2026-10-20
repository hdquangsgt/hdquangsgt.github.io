---
title: 'Pi Agent: Sự đánh đổi giữa tự do và tiện lợi'
description: 'Pi trao cho bạn một lõi agent nhỏ và một API extension, phần còn lại để bạn tự lo. Các thí nghiệm của tôi với extension, sub-agent và sandbox cho thấy sự tự do ấy đáng giá đến đâu, và công việc kỹ thuật, vận hành mà nó trả lại cho bạn.'
pubDate: 2026-10-19T09:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: false
---

<div class="callout">

**Cách đọc bài này.** Pi thay đổi rất nhanh, nên mỗi nhận định đều mang nhãn:

- <span class="label documented">Tài liệu</span>: có trong tài liệu chính thức, mã nguồn hoặc bài viết của các tác giả, kèm liên kết ngay cạnh nhận định.
- <span class="label observed">Quan sát</span>: điều tôi tự trải nghiệm. Không phải phép thử có kiểm soát.
- <span class="label opinion">Quan điểm</span>: cách tôi diễn giải.
- <span class="label proposal">Đề xuất</span>: một ý tưởng đáng đánh giá. Không phải thứ tôi đã thử hay Pi có sẵn.

**Phiên bản.** Các nhận định về Pi áp dụng cho `@earendil-works/pi-coding-agent` **1.3.0** (tag `latest` trên npm khi tôi kiểm tra ngày 20/10/2026), tài liệu và repository của Pi, tài liệu của Claude Code và OpenAI Codex (cùng repository mã nguồn mở của Codex, commit `e18a20d`) tại ngày đó. Tất cả những thứ này thay đổi nhanh, nên hãy coi các chi tiết theo phiên bản như một ảnh chụp nhanh. Tôi không đo chất lượng đầu ra ở bất kỳ chỗ nào, và bài này không nói agent nào viết code tốt hơn.

</div>

## 1. Bất ngờ đầu tiên

<div class="callout observed">

<span class="label observed">Quan sát</span> Dùng Pi có cảm giác như được tiếp cận một trong những công nghệ mạnh nhất hiện có, rồi lại thấy mình phải dựng lại những thứ gần như sơ khai so với nó. Model rất mạnh. Môi trường xung quanh thì mỏng, so với các sản phẩm coding tích hợp mà tôi từng dùng trước đây.

</div>

Sự tương phản đó nói về chỗ công việc nằm ở đâu, không nói về chất lượng. Ở một sản phẩm tích hợp, nhiều năng lực hỗ trợ đã có sẵn khi bạn mở nó ra. Với Pi, tôi có thể tự thay đổi hoặc tự xây những mảnh đó, và tôi bắt đầu làm vậy.

Bài này đi theo một lập luận. **Pi cho lập trình viên nhiều tự do hơn để định hình hệ thống quanh một model, và sự tự do đó chuyển trách nhiệm sang họ.** Sự tiện lợi không biến mất. Nó trở thành thứ bạn phải xây, tích hợp, kiểm thử và bảo trì. Tôi sẽ đi từ kiến trúc và hệ thống công cụ của nó, qua các thí nghiệm của mình, đến chuyện gì xảy ra khi việc thực thi thất bại, ranh giới phân quyền, vấn đề workflow và Code Mode, rồi hỏi liệu một bộ công cụ lớn hơn có sửa được điều gì trong số đó không, và kết bằng việc tôi nghĩ sự đánh đổi này thực chất là gì.

## 2. Pi là gì

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi được Mario Zechner giới thiệu trong bài [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) (tháng 11/2025). Mã nguồn hiện ở [earendil-works/pi](https://github.com/earendil-works/pi). Vòng lặp agent thêm tin nhắn của bạn vào nhánh đang hoạt động, stream phản hồi của model, thực thi các lời gọi công cụ, ghi lại kết quả, và bắt đầu một lượt khác nếu cần. Năm giao diện dùng chung cùng cơ chế agent và session: terminal tương tác, print, JSON (sự kiện JSONL), RPC (JSONL trên stdin/stdout) và TypeScript SDK chạy trong cùng process. ([How Pi works](https://pi.dev/docs/latest/how-pi-works))

</div>

![Kiến trúc phân lớp của Pi. Bốn cách điều khiển (TUI tương tác, print/JSON, RPC, TypeScript SDK) nằm trên pi-coding-agent (session, file ngữ cảnh, compaction, trust, settings), lớp này nằm trên pi-agent-core (vòng lặp agent) và pi-ai (API LLM thống nhất). Extension móc vào coding agent từ bên cạnh, có thể đăng ký công cụ và lệnh hoặc chặn lời gọi công cụ. Dưới cùng, các công cụ dựng sẵn chạy dưới user hệ điều hành đã khởi động Pi, mặc định không có hàng rào đường dẫn hay hộp thoại phê duyệt.](../images/pi-architecture.svg)

Bốn công cụ dựng sẵn được bật mặc định: `read`, `bash`, `edit` và `write`. Bốn công cụ dựng sẵn nữa (`grep`, `find`, `ls` và `powershell` chỉ dành cho Windows) phải bật thêm ([CLI reference](https://pi.dev/docs/latest/cli)). Phần 3 trình bày toàn bộ hệ thống công cụ. Trang chủ liệt kê những thứ Pi cố tình bỏ ra: "No sub-agents", "No plan mode", "No permission popups". Với mỗi thứ, trang này chỉ sang extension, package hoặc công cụ khác ([pi.dev](https://pi.dev)).

Bản thân vòng lặp khá nhỏ. Pi thêm tin nhắn của bạn vào nhánh đang hoạt động, dựng một request từ system prompt, nhánh đó, các định nghĩa công cụ và cài đặt model, stream câu trả lời, chạy mọi lời gọi công cụ trong đó rồi ghi lại kết quả. Nếu kết quả đó hoặc các tin nhắn đang xếp hàng cần thêm một request nữa, một turn mới bắt đầu. Nếu không, lượt chạy kết thúc ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

![Vòng lặp agent. Một tin nhắn được thêm vào nhánh đang hoạt động, request được dựng từ system prompt, nhánh và công cụ, model stream câu trả lời gồm văn bản và lời gọi công cụ, rồi các lời gọi công cụ chạy và kết quả được ghi lại. Nếu cần thêm request, vòng lặp bắt đầu turn mới; nếu không, agent_end đánh dấu một lượt chạy đã xong và agent_settled báo rằng Pi sẽ không tự tiếp tục. Phía dưới là ba cách can thiệp vào một agent đang chạy: steering bằng Enter đến sau turn hiện tại, follow-up bằng Alt+Enter đến khi công việc đang chờ xong, và abort bằng Escape dừng lượt chạy và trả các tin nhắn đang xếp hàng về trình soạn thảo.](../images/agent-loop.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> Bạn có thể can thiệp vào một lượt chạy khi nó đang diễn ra. Enter gửi một tin nhắn định hướng cho phản hồi kế tiếp và chờ đến khi phản hồi hiện tại cùng các lời gọi công cụ của nó xong. Alt+Enter xếp một follow-up chạy sau khi tác vụ hiện tại kết thúc. Escape dừng tác vụ và trả các tin nhắn đang xếp hàng về trình soạn thảo ([Usage](https://pi.dev/docs/latest/usage)). Qua RPC, cùng những ý đó là các lệnh `steer`, `follow_up` và `abort`. Trang RPC cũng tách hai tín hiệu: `agent_end` kết thúc một lượt chạy mức thấp, còn `agent_settled` cho biết Pi sẽ không tự tiếp tục ([RPC](https://pi.dev/docs/latest/rpc)).

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Steering là mảnh "kiểm soát" đầu tiên mà mục 5 sẽ quay lại, và đó là kiểm soát dành cho một người ngồi trước bàn phím. Nó không nói gì về việc một agent cha sẽ điều hướng sub-agent ra sao. Sự tách biệt `agent_end` / `agent_settled` quan trọng vì cùng lý do với khôi phục ở mục 6: "lượt chạy đã kết thúc" và "sẽ không còn gì xảy ra nữa" là hai phát biểu khác nhau.

</div>

Tài liệu tách bạch các cơ chế tùy biến, và sự khác biệt này quan trọng cho mọi phần bên dưới ([How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Cơ chế | Là gì | Mức cưỡng chế |
|---|---|---|
| Skill và file ngữ cảnh | Chỉ dẫn model đọc, nạp theo nhu cầu hoặc lúc khởi động | Không có. Model có thể phớt lờ. |
| Prompt template | Đoạn tin nhắn dùng lại được, mở rộng từ đầu vào của bạn | Không có. |
| Extension | Module TypeScript nạp vào process Pi. Chúng đăng ký công cụ, lệnh, nhà cung cấp, bộ xử lý sự kiện và giao diện. | Bằng code. Chúng có thể chặn lời gọi công cụ, và chạy với quyền hệ điều hành của process. |
| Package | Cách phân phối extension, skill, template và theme qua npm hoặc git | Giống nội dung bên trong. |

Trang chủ nói MCP nay đã được tích hợp sẵn, cùng với Codemode (phần 10).

Các lớp này trả lời những câu hỏi khác nhau, và chọn nhầm lớp là lỗi dễ mắc. Trước khi viết code, hãy hỏi yêu cầu thực sự là gì:

- **Chỉ dẫn hoặc kiến thức dùng lại được** (repo này build thế nào, quy ước nào áp dụng): file ngữ cảnh, skill hoặc prompt template. Skill phù hợp khi một workflow "needs more context than a prompt template but does not need a new executable integration point" ([Skills](https://pi.dev/docs/latest/skills)).
- **Hành vi lúc chạy hoặc việc thực thi công cụ** (chặn một lời gọi, thêm công cụ, đổi thứ model nhìn thấy): extension.
- **Tích hợp với hệ thống khác:** extension, MCP, hoặc điều khiển Pi từ bên ngoài qua RPC hay SDK (phần 9).
- **Phân phối và duy trì một bộ các thứ trên:** package. Package chỉ là cơ chế phân phối, và chúng "can execute extension code and can include skills that instruct the model to run programs", nên việc xem xét mã nguồn là của bạn ([Packages](https://pi.dev/docs/latest/packages)).

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Dùng extension trong khi một skill là đủ nghĩa là phải sở hữu đoạn TypeScript luôn phải theo kịp API của Pi. Dùng skill trong khi cần cưỡng chế nghĩa là dựa vào một model có thể phớt lờ nó. Tôi chưa mô tả trường hợp nào mình chọn sai, và sẽ không bịa ra. Ý chính là API extension mạnh đến mức việc lựa chọn này rất dễ bị bỏ qua.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Câu hỏi tiếp theo là Pi là một ứng dụng coding hoàn chỉnh hay một nền tảng agent để bạn xây lên trên. Tôi đọc nó là cái thứ hai. Các thí nghiệm của tôi là thứ đẩy tôi đến kết luận đó.

</div>

## 3. Công cụ: model thực sự làm được gì

Xuyên suốt bài tôi đã dùng chữ "công cụ" (tool), và phần còn lại của bài dựa vào nó. Phân quyền, khả năng quan sát, sub-agent và khôi phục lỗi, xét đến cùng đều là câu hỏi về các lời gọi công cụ. Vì vậy cần nói chính xác công cụ trong Pi là gì trước khi đi tiếp.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Trong hướng dẫn extension của Pi, một công cụ "defines a name, model-facing description, TypeBox parameter schema, and `execute()` function" (định nghĩa một tên, mô tả hướng tới model, schema tham số TypeBox và hàm `execute()`) ([extensions guide](https://pi.dev/docs/latest/extensions)). Các công cụ dựng sẵn của Pi có cùng hình dạng: mỗi file trong [`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools) định nghĩa một mô tả, một schema TypeBox và phần cài đặt. Model không bao giờ chạm vào hệ thống file của bạn. Nó phát ra một yêu cầu có cấu trúc, còn code của Pi mới là thứ làm việc.

</div>

### Một lời gọi công cụ, từng bước

![Sơ đồ tuần tự của một lời gọi công cụ. Bốn làn: model, vòng lặp agent, extension và công cụ. Bước 1, vòng lặp gửi request gồm system prompt, nhánh và các định nghĩa công cụ. Bước 2, model trả lời bằng văn bản và một lời gọi công cụ mang tên và đối số. Bước 3, vòng lặp tìm công cụ và kiểm tra đối số theo schema của nó. Bước 4, vòng lặp chạy các handler tool_call, có thể sửa đầu vào hoặc chặn. Bước 5, các handler cho phép hoặc chặn kèm lý do, lý do này trở thành một kết quả lỗi. Bước 6, vòng lặp gọi execute trên công cụ. Bước 7, công cụ trả về content và details, còn ném lỗi (throw) sẽ tạo ra kết quả lỗi. Bước 8, các handler tool_result có thể che, chú thích hoặc thay kết quả. Bước 9, request tiếp theo mang theo tin nhắn kết quả công cụ. Một ghi chú nói rằng nhiều lời gọi trong cùng một phản hồi mặc định chạy đồng thời, kết quả được ghi theo thứ tự model yêu cầu, và một công cụ sequential buộc cả lô chạy lần lượt.](../images/tool-call-lifecycle.svg)

Năm thành phần trong hình có vai trò khác nhau:

- **Model** đề xuất. Nó thấy các định nghĩa công cụ và quyết định có gọi một cái hay không. Nó không chạy được gì.
- **Vòng lặp agent** nắm việc thực thi. Nó tra công cụ, kiểm tra đối số, chạy hook, gọi `execute()` và biến kết quả thành một tin nhắn.
- **Định nghĩa công cụ** là hợp đồng model đọc: tên, mô tả và schema tham số.
- **`execute()` của công cụ** là code bình thường chạy trong process Pi, với quyền hệ điều hành của process đó.
- **Kết quả công cụ** quay lại nhánh đang hoạt động dưới dạng tin nhắn kết quả công cụ, nên request tiếp theo chứa nó. Đó cũng là lý do output lớn quan trọng: bất cứ thứ gì kết quả chứa đều trở thành ngữ cảnh.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Tài liệu của Pi nói mỗi request được dựng từ system prompt, nhánh đang hoạt động, "available tools" và cài đặt model, và Pi thực thi từng lời gọi công cụ trong phản hồi của provider rồi ghi lại kết quả ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). Code vòng lặp bổ sung các chi tiết trong hình: tên công cụ không tồn tại trả về một kết quả lỗi, lời gọi bị chặn trả về một kết quả lỗi kèm lý do của handler, và các lời gọi trong cùng một phản hồi mặc định chạy đồng thời trừ khi `toolExecution` hoặc `executionMode` của công cụ là `sequential` ([agent-loop.ts](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts), [agent README](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)). Theo hướng dẫn extension: handler `tool_call` "can mutate input or block execution" (có thể sửa đầu vào hoặc chặn việc thực thi), còn handler `tool_result` có thể che, chú thích hoặc thay kết quả.

</div>

### Pi đi kèm những gì

<div class="callout documented">

<span class="label documented">Tài liệu</span> [CLI reference](https://pi.dev/docs/latest/cli) liệt kê tám công cụ dựng sẵn, và tập `allToolNames` trong mã nguồn có đúng tám cái đó. Tài liệu không nêu tổng số, nên "tám" là số tôi tự đếm từ bảng ấy. Bốn cái được bật mặc định (`read`, `bash`, `edit`, `write`), do cài đặt `defaultTools` điều khiển ([Settings](https://pi.dev/docs/latest/settings)). Giới hạn output ở cột cuối lấy từ mã nguồn công cụ trên nhánh main của repository (commit `a731ba8`, package phiên bản 1.3.0), không phải từ phần văn xuôi của tài liệu.

</div>

| Công cụ | Trách nhiệm | Mặc định | Giới hạn output (từ mã nguồn) |
|---|---|---|---|
| `read` | Đọc file văn bản và các ảnh được hỗ trợ | bật | 2.000 dòng hoặc 50 KB, dùng `offset` / `limit` để đọc tiếp |
| `bash` | Chạy một lệnh shell trong thư mục làm việc | bật | 2.000 dòng cuối hoặc 50 KB; output đầy đủ lưu vào file tạm |
| `edit` | Thay thế văn bản chính xác trong file đã có | bật | không áp dụng |
| `write` | Tạo mới hoặc ghi đè một file | bật | không áp dụng |
| `grep` | Tìm nội dung file; tôn trọng `.gitignore` | bật thêm | 100 kết quả khớp hoặc 50 KB |
| `find` | Tìm đường dẫn theo mẫu glob; tôn trọng `.gitignore` | bật thêm | 1.000 kết quả hoặc 50 KB |
| `ls` | Liệt kê thư mục, gồm cả file ẩn | bật thêm | 500 mục hoặc 50 KB |
| `powershell` | Chạy lệnh PowerShell, chỉ trên Windows | bật thêm | giống `bash` |

Hai công cụ nữa đến từ các *extension* dựng sẵn của Pi, không thuộc bộ công cụ lõi. Cả hai đều tắt mặc định ([CLI reference](https://pi.dev/docs/latest/cli)):

| Công cụ | Trách nhiệm |
|---|---|
| `codemode` | Model viết JavaScript gọi các công cụ khác; chỉ output của script quay lại (phần 10) |
| `tool_search` | Tìm các công cụ chưa được khai báo với model và khai báo những cái khớp cho lần gọi tiếp theo |

<div class="callout documented">

<span class="label documented">Tài liệu</span> Tài liệu nói extension MCP bật hai công cụ này "when an MCP server needs them" (khi một MCP server cần đến), và bạn có thể tự nêu tên chúng trong `--tools` hoặc `defaultTools`. `--tools` thay toàn bộ phần chọn, còn các mục `+name` / `-name` chỉnh phần chọn mặc định: `pi --tools +codemode,-write` ([CLI reference](https://pi.dev/docs/latest/cli)).

</div>

Một chỉnh sửa cho cách nói tắt trước đó của chính tôi: phần 2 nói bốn công cụ được bật mặc định còn `grep`, `find` và `ls` phải bật thêm. Điều đó đúng nhưng chưa đủ. Có tám tên công cụ dựng sẵn, gồm cả một shell chỉ dành cho Windows, và hai công cụ nữa nằm sau extension.

### Công cụ lõi, công cụ từ extension, và công cụ của riêng bạn

Câu hỏi "Pi có bao nhiêu công cụ?" không có một đáp án duy nhất, vì công cụ đến với model theo những cách khác nhau:

| Loại | Do ai định nghĩa | Đến với model thế nào |
|---|---|---|
| Công cụ dựng sẵn | Lõi của Pi (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`, `powershell`) | Được khai báo khi đang hoạt động; bốn cái đầu hoạt động mặc định |
| Công cụ của extension dựng sẵn | Các extension đi kèm Pi (`codemode`, `tool_search`) | Đăng ký ở trạng thái không hoạt động; được bật theo tên hoặc bởi extension MCP |
| Công cụ MCP | Một MCP server bạn cấu hình; đặt tên `mcp__<server>__<tool>` | `exposure` theo từng server: `codemode` (mặc định, không khai báo với model), `deferred`, `direct` hoặc `hidden` ([MCP](https://pi.dev/docs/latest/mcp)) |
| Công cụ extension tự viết | Extension TypeScript của bạn, qua `pi.registerTool()` | Mặc định `direct`, được bật ngay khi đăng ký; có các kiểu exposure khác |
| Công cụ SDK | Ứng dụng host nhúng Pi, qua tùy chọn `customTools` | Thuộc tập công cụ đang hoạt động mà `tools`, `noTools` và `excludeTools` điều khiển ([SDK](https://pi.dev/docs/latest/sdk)) |

Một công cụ tự viết là một đoạn code nhỏ. Đây là ví dụ `hello.ts` của chính Pi, đã rút gọn ([nguồn](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)):

```typescript
const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: { greeted: params.name },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(helloTool);
}
```

<div class="callout documented">

<span class="label documented">Tài liệu</span> Những gì tài liệu và mã nguồn nói về việc viết công cụ: hãy ném lỗi (throw) từ `execute()` để báo thất bại, vì trả về một object trông giống lỗi không đánh dấu kết quả là lỗi. Cắt bớt kết quả lớn và cho model biết output đầy đủ ở đâu. Công cụ sửa file nên bọc toàn bộ chu trình đọc-sửa-ghi trong `withFileMutationQueue()`, và công cụ dùng chung trạng thái có thể thay đổi nên chạy tuần tự. Công cụ có thể khai báo `outputSchema` để script codemode nhận dữ liệu có cấu trúc trong khi model vẫn nhận văn bản. Theo chú thích trong định nghĩa kiểu, công cụ không có `promptSnippet` bị bỏ khỏi danh sách "Available tools" trong system prompt mặc định. Extension cũng có thể đăng ký một công cụ trùng tên với công cụ dựng sẵn để thay thế nó. Ví dụ [`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts) trong repo làm điều đó với `read`, để ghi log truy cập file và chặn các đường dẫn nhạy cảm. Tôi chưa chạy nó. ([extensions guide](https://pi.dev/docs/latest/extensions), [`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts))

</div>

### Công cụ, extension, skill, MCP server, package

Phần 2 phân tách các cơ chế tùy biến theo thứ chúng cưỡng chế. Ở đây là cùng sự phân tách đó, nhưng theo việc mỗi cơ chế làm gì với bề mặt công cụ của model:

| Cơ chế | Thêm một thao tác model gọi được? | Chạy code trong process Pi? |
|---|---|---|
| Công cụ | Có, chính nó là thao tác đó | Có, `execute()` của nó |
| Extension | Có, nếu gọi `registerTool()`. Nó cũng có thể thêm lệnh, hook, provider và giao diện | Có |
| Skill | Không. Model làm theo chỉ dẫn bằng các công cụ đã có | Không |
| Prompt template | Không. Nó mở rộng thành văn bản tin nhắn | Không |
| MCP server | Có, công cụ của nó xuất hiện dưới dạng `mcp__<server>__<tool>` | Server là một process riêng hoặc dịch vụ từ xa. Extension MCP của Pi là client |
| Package | Mang theo bất kỳ thứ nào ở trên | Tùy nội dung bên trong |

<div class="callout documented">

<span class="label documented">Tài liệu</span> Quickstart của Pi đưa ra quy tắc ngón tay cái: "Start with the least powerful mechanism that meets your need" (bắt đầu với cơ chế ít quyền lực nhất đáp ứng được nhu cầu). Bảng của nó ánh xạ chỉ dẫn bền vững cho một thư mục sang `AGENTS.md`, chỉ dẫn riêng cho một tác vụ sang skill, và "executable tools, commands, or event handlers" (công cụ, lệnh hoặc bộ xử lý sự kiện chạy được) sang extension ([Quickstart](https://pi.dev/docs/latest/quickstart)).

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Những ràng buộc quan trọng với công cụ tự viết. Extension "run inside the Pi process with the same operating-system permissions" (chạy trong process Pi với cùng quyền hệ điều hành) và có thể đọc prompt, lời gọi công cụ, file, thông tin xác thực và lịch sử session, nên hướng dẫn nói chỉ nạp extension từ nguồn đáng tin ([extensions guide](https://pi.dev/docs/latest/extensions)). Các công cụ được bật dùng quyền hệ điều hành của process Pi, và Pi "does not ask for approval before every tool call" (không xin phê duyệt trước mỗi lời gọi công cụ) ([Security](https://pi.dev/docs/latest/security)). Extension cục bộ của dự án và `.pi/mcp.json` chỉ được nạp sau khi cấp project trust, nhưng trust "does not limit what tool calls can access or affect" (không giới hạn những gì lời gọi công cụ có thể truy cập hay tác động).

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Có hai hệ quả. Thứ nhất, một công cụ tự viết là một năng lực mới cần được thiết kế: mô tả và schema tốt, output có giới hạn, lỗi trung thực và một quyết định về những gì nó được phép chạm vào. Không có gì trong Pi làm bước rà soát đó thay bạn. Thứ hai, hook `tool_call` có thể từ chối lời gọi, nhưng chính trang bảo mật của Pi đặt ranh giới thật ở hệ điều hành, không phải ở hook. Nhìn theo hướng này, các thí nghiệm của tôi ở phần 4 là những nỗ lực xây hành vi ở tầng này. Đó là một cách diễn giải. Tôi không báo cáo mỗi thí nghiệm đã dùng hook hay công cụ nào.

</div>

## 4. Tự xây những mảnh còn thiếu

<div class="callout observed">

<span class="label observed">Quan sát</span> Tôi thử nghiệm với extension để có những năng lực mà tôi không tìm thấy ở dạng mình muốn:

- một **orchestrator**,
- **sub-agent** để xử lý công việc có session dài hoặc nhiều ngữ cảnh,
- các extension nhằm **hạn chế quyền**,
- một nỗ lực chạy **Pi bên trong container Docker** làm sandbox.

Những thử nghiệm này vấp phải khó khăn khi triển khai và gặp lỗi. Dù vậy, chúng dạy tôi nhiều hơn về cách một agent vận hành bên trong. Khó khăn tôi mô tả chính xác nhất là việc theo dõi các sub-agent đang làm gì, mà phần 5 sẽ phân tích. Tôi không liệt kê từng lỗi ở đây. Tôi cũng không báo cáo cấu hình hay kết quả của nỗ lực Docker, nên không có gì trong bài này coi nó là một phép thử bảo mật của Pi.

</div>

Trình tự quan trọng hơn bất kỳ lỗi riêng lẻ nào. Động cơ cho các sub-agent là những session dài và ngữ cảnh lớn. Tôi không tìm thấy thứ mình muốn ở dạng mình muốn, nên tôi thử tự xây. Ngoài công sức bỏ ra, thứ nó để lại cho tôi là những câu hỏi về việc ủy quyền: orchestrator chịu trách nhiệm điều gì, kết quả và lỗi của một sub-agent đi đâu, và ai nhìn thấy chúng. Phần còn lại của bài đi theo những câu hỏi đó. Đó là cách tôi đọc thí nghiệm của chính mình. Nó là một diễn giải về những gì xảy ra khi tôi tự xây các mảnh này, không phải một khẳng định rằng Pi nói chung thiếu năng lực ủy quyền.

Những gì tài liệu thiết lập sẵn là một chuyện riêng, và kiểm tra được. Pi gọi "no sub-agents" là một lựa chọn. Hướng dẫn extension của nó cũng không nhắc đến sub-agent, dù cho phép extension chạy các công cụ khác bằng `ctx.executeTool()`, và những lời gọi lồng nhau này đi qua cùng các handler `tool_call` như lời gọi do model phát ra ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Vậy nên orchestrator không phải thứ bạn cấu hình. Nó là thứ bạn thiết kế.

### Ngữ cảnh không chỉ là một cửa sổ


Trước hết là cái gì lấp đầy cửa sổ. System prompt gồm các chỉ dẫn nền của Pi cộng với các context file nó tìm thấy. Định nghĩa công cụ được gửi kèm mỗi request, và nhánh đang hoạt động được chuyển thành các tin nhắn user, assistant và tool-result. Skill được nạp dần: chỉ tên, mô tả và đường dẫn của mỗi skill vào system prompt, còn toàn bộ `SKILL.md` chỉ được đọc khi model quyết định một tác vụ khớp với mô tả. Skill có `disable-model-invocation: true` chỉ dùng được qua lệnh tường minh `/skill:name`. Tin nhắn của bạn có thể mang tham chiếu file bằng `@`, ảnh dán vào và đầu ra của `!command` (`!!command` chạy lệnh mà không gửi đầu ra cho model), và extension có thể thêm chỉ dẫn hoặc biến đổi ngữ cảnh trước khi request rời đi ([How Pi works](https://pi.dev/docs/latest/how-pi-works), [Skills](https://pi.dev/docs/latest/skills), [Usage](https://pi.dev/docs/latest/usage), [extensions guide](https://pi.dev/docs/latest/extensions)).

![Những gì đi vào một request gửi model. Năm nguồn đổ vào: system prompt (chỉ dẫn nền của Pi cộng context file), định nghĩa công cụ gửi kèm mỗi request, danh sách skill (tên, mô tả và đường dẫn, phần nội dung đầy đủ nạp khi cần), lịch sử (nhánh đang hoạt động, trong đó một bản tóm tắt thay cho các turn cũ) và tin nhắn hiện tại (file, ảnh, đầu ra lệnh, template đã mở rộng). Extension có thể biến đổi request qua các hook như before_agent_start, context và before_provider_request, rồi kết quả đi tới provider.](../images/request-assembly.svg)

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Có hai hệ quả. Mô tả của một skill là tín hiệu định tuyến của nó, nên mô tả mơ hồ sẽ định tuyến kém, điều trang Skills cũng nói. Và vì các mô tả luôn nằm trong prompt, một bộ sưu tập skill lớn có chi phí thường trực ở mọi request. Tôi chưa đo chi phí đó, nên coi nó là một cân nhắc thiết kế chứ không phải một con số.

</div>
Ngữ cảnh dài là lý do tôi muốn có sub-agent, nên cần nói chính xác các cơ chế của Pi làm gì. Ba thứ dễ bị lẫn vào nhau:

<div class="callout documented">

<span class="label documented">Tài liệu</span> Session được lưu tự động (trừ khi dùng `--no-session`) dưới `~/.pi/agent/sessions/`, nhóm theo thư mục làm việc. "Pi stores entries as a tree, so returning to an earlier point does not erase the branch you leave." `/tree` di chuyển trong file session hiện tại, `/fork` tạo session mới từ một tin nhắn người dùng trước đó, và `/clone` sao chép nhánh đang hoạt động sang session mới. Model chỉ nhận nhánh đang hoạt động, không nhận mọi nhánh trong file ([Sessions](https://pi.dev/docs/latest/sessions)). Compaction "does not delete the original session entries" ([Sessions](https://pi.dev/docs/latest/sessions)). Một mục tóm tắt thay thế các tin nhắn cũ trong các request sau, còn bản gốc vẫn nằm trong cây ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

</div>

- **Compaction** quản lý thứ model nhìn thấy *lúc này*. Nó thay các tin nhắn cũ bằng một bản tóm tắt, nên bản tóm tắt giữ lại gì sẽ quyết định agent biết gì về sau.
- **Persistence** (lưu bền) giữ toàn bộ bản ghi trên đĩa, gồm cả phần compaction đã giấu khỏi model.
- **Branching** (rẽ nhánh) điều khiển *hướng đi*: bạn có thể quay lại một điểm trước đó và thử cách khác mà không mất nhánh đã rời.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Auto-compaction bắt đầu khi số token ngữ cảnh vượt quá cửa sổ trừ đi `reserveTokens` (mặc định 16.384). Pi đi ngược về phía trước cho đến khi có khoảng `keepRecentTokens` (mặc định 20.000) tin nhắn gần nhất, giữ nguyên văn các tin nhắn đó, và gửi mọi thứ cũ hơn cho model để tóm tắt, kèm bản tóm tắt trước đó nếu có. Kết quả được lưu thành một compaction entry có `firstKeptEntryId`. Điểm cắt không bao giờ rơi vào một tool result, vì nó phải đi cặp với lời gọi của nó, và nếu một lượt user quá lớn thì Pi cắt ngay trong lượt đó rồi gộp hai bản tóm tắt. Bản tóm tắt theo một dàn ý cố định (Goal, Constraints & Preferences, Progress, Key Decisions, Next Steps, Critical Context) cùng danh sách file đã đọc và đã sửa. `/compact [instructions]` định hướng điều bản tóm tắt thủ công nhấn mạnh, `compaction.modelOverrides` đặt giá trị theo từng model, và sự kiện extension `session_before_compact` có thể hủy compaction hoặc cung cấp bản tóm tắt của riêng bạn. Khi `/tree` đưa bạn sang nhánh khác, Pi cũng có thể tóm tắt nhánh bạn vừa rời. ([Compaction](https://pi.dev/docs/latest/compaction))

</div>

![Một session dưới dạng cây. Các entry e1 đến e8 tạo thành nhánh đang hoạt động, và một compaction entry nằm sau e8. Một nhánh phụ b4, b5 mọc ra từ e3, vẫn nằm trên đĩa nhưng không được gửi cho model. Các entry e1 đến e4 là đoạn cũ bị tóm tắt, còn entry gốc của chúng vẫn nằm trong cây. Các entry e5 đến e8 là đoạn gần đây được giữ nguyên văn, kích thước theo keepRecentTokens (mặc định 20.000). Request kế tiếp gồm bản tóm tắt, e5 đến e8 và các tin nhắn mới. Compaction entry lưu bản tóm tắt và firstKeptEntryId.](../images/session-compaction.svg)

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Vậy quản lý ngữ cảnh không chỉ là nhét được nhiều hơn vào một cửa sổ. Nó còn là chọn lịch sử nào agent mang theo và agent đi theo hướng nào tiếp. Nhưng không có gì ở đây được chứng minh là tự nó giải quyết được tình trạng cạn kiệt ngữ cảnh. Compaction có thể thất bại (tài liệu nói hãy sửa lỗi phía nhà cung cấp rồi chạy lại `/compact`), bản tóm tắt vốn mất thông tin, và bản ghi trên đĩa không tự quay lại ngữ cảnh của model. Rẽ nhánh giúp con người lái, nhưng không làm một tác vụ dài tự tiếp tục. Tôi chưa thử các tính năng này hoạt động ra sao trong các thí nghiệm orchestrator của mình, nên không thể nói liệu chúng có loại bỏ nhu cầu về sub-agent hay không.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Các con số trong tài liệu cho thấy chi tiết có thể biến mất ở đâu. Trước khi tóm tắt, Pi tuần tự hóa các tin nhắn thành văn bản có nhãn, bỏ các khối thinking, và cắt mỗi tool result còn 2.000 ký tự ([Compaction](https://pi.dev/docs/latest/compaction)). Một log test hay danh sách file dài đến bộ tóm tắt đã bị cắt. Đó là suy luận của tôi từ các giới hạn được ghi trong tài liệu. Tôi chưa so một bản tóm tắt thật với nguồn của nó.

</div>

## 5. Khi việc ủy quyền trở nên khó nhìn thấy

<div class="callout observed">

<span class="label observed">Quan sát</span> Trong lúc thử nghiệm với sub-agent, tôi thấy rất khó theo dõi chúng đang làm gì. Agent chính có thể liên tục báo rằng công việc đang diễn ra, trong khi tôi gần như không có hoặc không có cái nhìn rõ ràng về việc sub-agent thực sự đang làm gì.

</div>

Quan sát này nói về một khoảng trống: giữa tín hiệu tiến độ chung chung và khả năng kiểm tra việc thực thi thực sự. Dựng cái thứ nhất thì dễ và dễ bỏ qua cái thứ hai. Tôi không khẳng định extension của mình có hay thiếu cơ chế cụ thể nào. Điểm bên dưới là thứ một hệ thống ủy quyền cần có, nếu bạn muốn tin nó.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Khởi chạy một sub-agent mới chỉ là điều phối. Hiểu được nó cần nhiều hơn:

- **Trạng thái so với tiến độ.** "Running" cho biết một tác vụ tồn tại. Nó không cho biết tác vụ đang đọc file, đang chờ model hay đang kẹt.
- **Sự kiện thực thi.** Các lời gọi công cụ và kết quả trung gian của agent con, không chỉ câu trả lời cuối.
- **Truy vết xuyên các cấp.** Cách nối hành động của agent con với request cha đã gây ra chúng.
- **Xử lý lỗi.** Timeout, tác vụ bị treo, và một đường báo lỗi đến được agent cha dưới dạng khác với sự im lặng.

</div>

Các khối xây dựng của Pi bao phủ một phần. Session được lưu dưới dạng cây JSONL ghi lại tin nhắn, lời gọi công cụ và kết quả, cùng các lần compaction, còn chế độ JSON và RPC stream các sự kiện agent ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). API extension bổ sung các hook chi tiết hơn. Sự kiện vòng đời gồm `agent_start`, `turn_start`, `message_update` và `agent_settled`, còn việc thực thi công cụ có `tool_execution_start`, `tool_execution_update` (tiến độ trong một lời gọi) và `tool_execution_end`. Với các lời gọi lồng nhau qua `ctx.executeTool()`, những sự kiện này mang theo `parentToolCallId` ([hướng dẫn extension](https://pi.dev/docs/latest/extensions)). SDK cung cấp `session.subscribe()` cho sự kiện của một session chạy trong cùng process ([SDK](https://pi.dev/docs/latest/sdk)). Đây là các khối xây dựng, và tôi chưa kiểm chứng chúng hoạt động thế nào giữa các process Pi con riêng biệt. Tài liệu tôi đọc không mô tả dashboard, metrics hay hệ thống tracing nào ngoài những thứ này. Việc một process con có xuất hiện hữu ích trong bản ghi đó hay không phụ thuộc vào cách bạn khởi chạy nó. Đó là một quyết định thiết kế thuộc về bạn.

Extension API là nơi các khối xây dựng đó trở nên cụ thể. Hình liệt kê các hook theo thứ tự chúng chạy và điều mỗi loại handler được phép làm: có loại chỉ quan sát, có loại biến đổi thứ đi qua, và một số có thể chặn.

![Thứ tự các hook của extension. Một lượt chạy bắt đầu bằng input (có thể tiêu thụ hoặc biến đổi), before_agent_start (đổi các phần của prompt và công cụ) và agent_start. Mỗi turn chạy turn_start, context (biến đổi tin nhắn), before_provider_request (đổi payload), after_provider_response và các sự kiện message. Mỗi lời gọi công cụ trong một turn chạy tool_execution_start, tool_call (có thể cho phép hoặc chặn), tool_execution_update, tool_result (có thể ẩn bớt hoặc thay thế) và tool_execution_end, rồi turn kết thúc bằng turn_end. Sau các turn là agent_end, agent_before_settle (có thể yêu cầu thêm một lượt chạy) và agent_settled. Chú giải đánh dấu hook nào có thể chặn, hook nào có thể biến đổi và hook nào chỉ quan sát.](../images/extension-lifecycle.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> `tool_call` có thể cho phép, đổi hoặc chặn một lời gọi, và handler ném lỗi sẽ chặn nó. `tool_result` có thể ẩn bớt, chú thích hoặc thay thế kết quả. `turn_end` và `agent_before_settle` có thể thêm entry và yêu cầu tiếp tục, và tài liệu dặn phải canh giữ để tránh vòng lặp. `provider_stream_event` chỉ để thông báo và được await theo thứ tự stream, nên một handler chậm sẽ làm chậm stream. `pi.events` cho phép các extension nhắn nhau, còn `pi.appendEntry()` lưu dữ liệu vào session mà không gửi cho model. Thư mục ví dụ có `debug-provider.ts`, một công cụ xem tùy chọn các sự kiện stream thô của provider. ([extensions guide](https://pi.dev/docs/latest/extensions))

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Đây là chỗ hỗ trợ cụ thể nhất tôi tìm được cho lập luận của mục này. Các đường nối để theo dõi một agent đã có, xuống tới từng lời gọi công cụ và sự kiện provider. Thứ tài liệu không mô tả là một giao diện hoàn chỉnh dựng từ chúng. Nên câu hỏi không phải Pi có quan sát được hay không. Câu hỏi là ai dựng giao diện đó.

</div>

Gộp lại, có ba thuộc tính riêng biệt, và một agent có thể có cái đầu tiên mà thiếu các cái còn lại:

- **Thực thi:** nó có thể thực hiện hành động.
- **Khả năng quan sát:** bạn biết nó đang làm gì và đang ở đâu.
- **Kiểm soát:** bạn có thể can thiệp, đổi cách làm hoặc dừng nó.

Ủy quyền mà thiếu khả năng quan sát tạo ra một hệ thống có thể hành động mà không dễ hiểu được. Đó là kết luận về thiết kế, không phải khẳng định rằng mọi hệ thống đa agent đều như vậy.

Kiểm soát cũng có một mặt được ghi trong tài liệu. Một người có thể steer, xếp follow-up hoặc abort (mục 2), và một chương trình có thể làm như vậy qua RPC. Những thứ đó tác động lên một session Pi. Một agent cha sẽ áp dụng chúng cho agent con ra sao, khi nào nên làm, và agent con xử lý chúng thế nào là những quyết định tôi sẽ phải tự thiết kế. Tôi không khẳng định Pi không làm được.

## 6. Khi việc thực thi dừng lại

<div class="callout observed">

<span class="label observed">Quan sát</span> Trong lúc dùng bình thường, tôi gặp những lỗi bất ngờ: lỗi phản hồi của model, dùng công cụ sai, và cạn kiệt context window. Trong một số trường hợp, việc thực thi dừng mà không tự phục hồi theo cách cho phép tác vụ tiếp tục. Tôi phải can thiệp, chẩn đoán vấn đề, điều chỉnh trạng thái thực thi hoặc cách làm của mình, và tìm cách để chạy tiếp. Một số lỗi tôi xử lý được theo cách đó, và tác vụ tiếp tục sau một gián đoạn nhỏ. Những lỗi khác khiến tác vụ không thể tiến triển.

</div>

Như vậy có hai nhóm, và sự khác biệt giữa chúng chính là phần hữu ích: **các gián đoạn tôi phục hồi được** bằng cách chẩn đoán rồi chạy tiếp, và **các lỗi chặn đứng tác vụ**. Tôi không xếp từng lỗi cụ thể (lỗi phản hồi, dùng sai công cụ, cạn kiệt ngữ cảnh) vào nhóm nào, và tôi cũng không nói lỗi nào trong số đó là không thể phục hồi nói chung. Một lỗi có tự tiếp tục được hay không phụ thuộc vào model, nhà cung cấp, cấu hình và các extension, và phần kể của tôi không gán cái nào cho cái nào.

Đây là vấn đề khác với phần 5. Khả năng quan sát hỏi bạn có thấy được agent đang làm gì không. Khả năng phục hồi hỏi chuyện gì xảy ra khi việc nó đang làm bị hỏng. Khả năng **thực thi** một tác vụ của agent và khả năng **phục hồi** khi việc thực thi thất bại là hai thuộc tính riêng. Một hệ thống có thể rất giỏi cái đầu mà không nói gì về cái sau.

Tôi không nên nói quá những gì Pi thiếu, vì nó có hành vi phục hồi, và tài liệu mô tả chúng:

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi có cơ chế retry tự động ở cấp agent cho "transient failures", bật mặc định, với mặc định 3 lần thử và exponential backoff bắt đầu từ 2 giây, tối đa 60 giây ([Settings](https://pi.dev/docs/latest/settings)). Nó cũng có compaction tự động, khởi động khi ngữ cảnh trống còn dưới mức dự trữ (mặc định 16.384 token). Khi nhà cung cấp trả lỗi tràn hoặc quá dài ngữ cảnh, Pi chạy một lần compaction phục hồi rồi bắt đầu lần thử lại như một lượt chạy mới. Nếu compaction phục hồi đó thất bại hoặc bị hủy, Pi "schedules no internal retry" ([Compaction](https://pi.dev/docs/latest/compaction)). Khi bản thân một công cụ thất bại, lỗi trở thành một kết quả lỗi trả về cho model ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)).

</div>

Vậy phát biểu chính xác không phải là Pi không bao giờ phục hồi. Một số lỗi có đường xử lý tích hợp sẵn, và một số đường đó có giới hạn: ba lần retry theo mặc định, và một đường phục hồi bằng compaction kết thúc mà không thử lại nếu bản thân compaction thất bại. Tài liệu tôi đọc không liệt kê lỗi nào được tính là transient. Chúng cũng không mô tả cách xử lý tích hợp cho một model cứ dùng sai một công cụ, hoặc cho một lần chạy kết thúc ở trạng thái bạn muốn tiếp tục. Tôi không biết liệu lỗi nào của mình nằm trong hay ngoài các đường tích hợp sẵn. Tôi không khẳng định chúng là khoảng trống của Pi. Có thể đó là những trường hợp mặc định đã cạn hoặc không áp dụng.

Hình vẽ các đường đó và điều xảy ra khi từng đường cạn. Ô nét liền là hành vi có trong tài liệu. Hàng nét đứt đánh dấu một khoảng trống trong những gì tôi đã đọc, không phải một khẳng định về Pi.

![Các đường khôi phục theo ba cột: tác nhân, phản ứng có sẵn, và điều xảy ra khi phản ứng đó cạn. Lỗi tạm thời của provider kích hoạt agent-level retry (bật mặc định, 3 lần thử, backoff từ 2 giây, trần 60 giây); khi hết lần thử thì lỗi thuộc về bạn xử lý. Tràn ngữ cảnh hoặc dừng sớm do độ dài kích hoạt recovery compaction và một lần thử lại như một lượt chạy mới; nếu compaction thất bại hoặc bị hủy thì không có retry nội bộ. Ngữ cảnh trống dưới mức dự trữ 16.384 token kích hoạt auto-compaction, và bản tóm tắt bị mất chi tiết. Một lời gọi công cụ lỗi trả về error result cho model, và việc nó có đổi cách làm hay không do model quyết định. Hàng cuối nét đứt, lạm dụng công cụ lặp lại hoặc một lượt chạy kẹt ở trạng thái xấu, không có gì được mô tả trong tài liệu tôi đã đọc, và kết thúc ở việc bạn kiểm tra, điều chỉnh rồi chạy tiếp.](../images/recovery-paths.svg)

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc một lỗi cụ thể có tự tiếp tục hay không ít quan trọng hơn câu hỏi ai quyết định "đã phục hồi" nghĩa là gì. Phục hồi đáng tin cậy thường cần các quyết định về:

- **Chiến lược retry.** Retry lỗi nào, bao nhiêu lần, và khi nào ngừng retry để báo lên.
- **Xử lý lỗi.** Một lời gọi công cụ sai trở thành tin nhắn cho model, một lần dừng, hay một yêu cầu gửi đến bạn.
- **Quản lý ngữ cảnh.** Điều gì được tóm tắt hoặc bị bỏ khi cửa sổ đầy, và tác vụ có sống sót qua đó không. Compaction tóm tắt công việc trước đó, nên bản tóm tắt giữ lại gì sẽ định hình agent biết gì về sau.
- **Workflow phục hồi tường minh.** Một cách được xác định để kiểm tra trạng thái đã hỏng, điều chỉnh nó và chạy tiếp, thay vì ứng biến mỗi lần.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Các mảnh để dựng hàng cuối đó từ bên ngoài cũng có trong tài liệu. Qua RPC, một chương trình điều khiển có thể bật hoặc tắt auto-retry và auto-compaction (`set_auto_retry`, `set_auto_compaction`), hủy một lần retry đang diễn ra (`abort_retry`), compact theo yêu cầu (`compact`), và theo dõi `compaction_start`, `compaction_end` cùng các sự kiện `summarization_retry_*`. Bên trong tiến trình, `session_before_compact` có thể thay bản tóm tắt của Pi, và `session_compact_failed` được kích hoạt khi compaction thất bại hoặc bị hủy. ([RPC](https://pi.dev/docs/latest/rpc), [Compaction](https://pi.dev/docs/latest/compaction))

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Một supervisor nhỏ chạy trên RPC: để retry có sẵn chạy, theo dõi các sự kiện compaction và retry, và khi một lượt chạy dừng ở trạng thái lỗi thì áp dụng chính sách do tôi viết, như compact với chỉ dẫn tường minh, đổi model, hoặc trả tác vụ lại cho tôi. Tôi chưa xây hay thử nó.

</div>

Pi cho bạn một phần những thứ này, và cây session của nó, vốn giữ nguyên các mục gốc ngay cả sau compaction, là một bản ghi hữu ích để tiếp tục từ đó ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). Tôi chưa tìm các package bổ sung retry hay compaction an toàn hơn, nên không thể nói chúng có tồn tại hay hoạt động tốt đến đâu. Ở một sản phẩm tích hợp, nhiều quyết định trong số này có thể đã được đưa sẵn cho bạn. Với Pi, mặc định chỉ là điểm xuất phát, và phần còn lại là của bạn để thiết kế, kiểm thử và bảo trì. Đó là cùng một sự đánh đổi như trước, nhìn từ trường hợp thất bại: tự do tùy biến một agent không đi kèm đảm bảo rằng nó phục hồi một cách trơn tru.

## 7. Ranh giới phân quyền thực sự

Các extension hạn chế quyền và nỗ lực dùng Docker ở phần 4 đặt ra câu hỏi cái gì thực sự giới hạn một agent. Một prompt, một công cụ bị hạn chế và một container là những thứ khác nhau, nên tách chúng ra sẽ có ích.

Vòng lặp dưới đây mang tính khái niệm, không phải sơ đồ cấu trúc nội bộ của Pi:

> context → model → tool request → runtime → execution environment → tool result → updated context

Năm lớp đều có thể được gọi là "permission":

1. **Quyền của process.** Những gì user hệ điều hành chạy agent làm được. Mọi thứ trong process đều bị chặn trên bởi đây.
2. **Kiểm tra ở tầng ứng dụng.** Các quy tắc trong agent xem xét một lời gọi công cụ rồi cho phép, hỏi lại hoặc từ chối.
3. **Ranh giới thư mục project.** Thư mục làm việc là một hàng rào hay chỉ là điểm xuất phát.
4. **Năng lực của công cụ.** Một `read` có cấu trúc có thể bị rào theo đường dẫn. Một shell có thể chạy bất kỳ chương trình nào, và chương trình đó có thể mở bất kỳ file nào.
5. **Cách ly.** Container, VM và sandbox hệ điều hành giới hạn chính process, kể cả các process con.

<div class="callout documented">

<span class="label documented">Tài liệu</span> [Trang bảo mật](https://pi.dev/docs/latest/security) của Pi nói Pi "can read, change, and execute files with the permissions of the account that started it" và "does not ask for approval before every tool call". Thư mục làm việc điều khiển việc khám phá tài nguyên và vị trí mặc định của công cụ, nhưng không giới hạn các lệnh chạm tới đường dẫn khác. Xem transcript, tin cậy một project và xem lại thay đổi đều không phải ranh giới bảo mật. Lựa chọn được khuyến nghị là chạy toàn bộ Pi bên trong container, VM hoặc sandbox, với credential hẹp, ngắn hạn và mạng bị hạn chế khi có thể.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Trong mã nguồn, [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) chấp nhận đường dẫn tương đối hoặc tuyệt đối và chỉ kiểm tra file có đọc được không. Các hàm phụ trợ đường dẫn mà nó gọi ([`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts) và [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)) giữ nguyên đường dẫn tuyệt đối và nối đường dẫn tương đối vào thư mục làm việc. Cả hai đều không so sánh kết quả với thư mục làm việc. Tôi đã đọc mã này trên nhánh main, có phiên bản package là 1.3.0, nhưng tôi chưa chạy các công cụ của Pi, và chưa lần theo mọi cách một file có thể được đọc. Đừng coi đây là kết quả đã được kiểm thử.

</div>

Điều đó khớp với tài liệu: mặc định không có hàng rào ở tầng ứng dụng. Nhưng việc không có hộp thoại không chứng minh quyền truy cập không giới hạn trong mọi cấu hình. Một extension có thể thêm kiểm tra. Sự kiện `tool_call` có thể sửa hoặc chặn một lời gọi, và một handler ném lỗi sẽ chặn nó theo kiểu fail-closed ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Một hộp thoại cũng không chứng minh bảo mật toàn diện. Tài liệu của Claude Code nói quy tắc deny của Read và Edit áp dụng cho các công cụ file tích hợp, cho các lệnh file mà nó nhận ra trong Bash như `cat`, và cho đích của redirection. Chúng không áp dụng cho một lệnh đọc file mà không nêu tên chúng, như `grep -r pattern .`, hay cho một script tự mở file. Để có cưỡng chế ở mức hệ điều hành, tài liệu chỉ đến sandbox của nó, và nói chế độ `bypassPermissions` chỉ nên dùng trong môi trường cách ly như container hoặc VM ([permissions](https://code.claude.com/docs/en/permissions)). Vậy tài liệu của cả hai đều chỉ đến sự cách ly cho ranh giới thật. Chúng khác nhau ở mặc định giữa bạn và ranh giới đó. Ở Manual mode của Claude Code (giá trị cấu hình `default`), nó hỏi trước hầu hết hành động chỉnh sửa file, chạy lệnh shell hoặc truy cập mạng ([permission modes](https://code.claude.com/docs/en/permission-modes)). Một tập lệnh chỉ đọc tích hợp như `cat` và `ls` chạy không cần hỏi, kể cả với đường dẫn ngoài thư mục làm việc, trừ khi `permissions.blockReadsOutsideWorkingDirectories` được bật. Tài liệu cũng nói từ v2.1.283, auto mode là chế độ khởi đầu cho các session tương tác trong terminal và VS Code, với một classifier xem xét hành động thay bạn. Pi không hỏi gì cả. Tôi so sánh tài liệu, không so sánh hành vi: tôi chưa chạy Claude Code cho bài này.

![Ba cấu hình so theo đường đi của một lời gọi công cụ. Pi mặc định: không có kiểm tra tầng ứng dụng và không có sandbox hệ điều hành, nên lời gọi chạm tới mọi thứ user hệ điều hành truy cập được. Pi được gia cố (một đề xuất): extension của bạn chặn hoặc xác nhận lời gọi, container hoặc VM chỉ mount project, nên lời gọi chạm tới project đã mount và credential phạm vi hẹp. Claude Code ở Manual mode: quy tắc phân quyền và chế độ hỏi khi chỉnh sửa, chạy lệnh shell và truy cập mạng, còn các lệnh chỉ đọc như cat chạy không cần hỏi. Có tùy chọn sandbox, và lời gọi chạm tới quyền truy cập của user hệ điều hành sau khi lọc qua các lần phê duyệt.](../images/permission-layers.svg)

Hai chi tiết riêng của Pi dễ bị bỏ sót:

- **Project trust không phải sandbox.** Nó kiểm soát những gì một thư mục cung cấp: settings và MCP server của project, extension, skill, prompt template và theme dưới `.pi`, file system prompt, và các package được cấu hình theo project. Nó "prevents a folder from silently loading executable extensions before you approve it", và trang bảo mật nói nó "does not limit what tool calls can access or affect". Extension chạy "inside the Pi process with the same operating-system permissions", nên một extension đã được tin cậy có thể đọc prompt, lời gọi công cụ, file và lịch sử session ([hướng dẫn extension](https://pi.dev/docs/latest/extensions)). File ngữ cảnh (`AGENTS.md`, `CLAUDE.md`) được nạp mà không cần trust ([Configuration](https://pi.dev/docs/latest/configuration)). Chỉ dẫn trong một repository bạn đã clone có thể đến được model dù bạn có tin cậy nó hay không. Việc một model cụ thể có làm theo một chỉ dẫn độc hại hay không là câu hỏi khác mà tôi chưa thử.

- **Docker là một công cụ, không phải một đảm bảo.** Container thực sự cách ly cái gì phụ thuộc vào việc bạn mount gì, truyền credential nào vào, mạng có mở không, và nó chạy dưới user nào. Một container mount thư mục home của bạn cùng một API key phạm vi rộng chỉ dời vấn đề đi chỗ khác, không giải quyết nó. Đây là bảo mật container nói chung, không phải kết quả từ nỗ lực của tôi ([Docker security](https://docs.docker.com/engine/security/)).

Tóm lại, ba câu hỏi hay bị trộn lẫn. **Trust** hỏi tài nguyên riêng của một thư mục có được nạp hay không. **Permissions** hỏi process đang chạy và các công cụ của nó về mặt kỹ thuật làm được gì. **Isolation** hỏi điều gì vẫn nằm ngoài tầm với ngay cả khi một agent hoặc extension hành xử sai. Tài liệu của Pi cung cấp cái thứ nhất, mô tả cái thứ hai, và để cái thứ ba cho bạn. Tôi chưa kiểm toán bảo mật của Pi ngoài việc đọc các trang này và mã nguồn của một công cụ.

### Hướng dẫn container hóa của Pi cung cấp gì

Chỉ nói "tự mang container đến" thì là lời khuyên mỏng, và tài liệu đi xa hơn thế. [Hướng dẫn containerization](https://pi.dev/docs/latest/containerization) mô tả bốn lựa chọn, và chúng khác nhau ở thứ nằm trong ranh giới:

![Hai phạm vi cô lập. Cô lập toàn bộ tiến trình (Docker, Docker Sandboxes, OpenShell): ranh giới container hoặc sandbox bao lấy tiến trình Pi, gồm cả extension và công cụ của extension, cùng các công cụ dựng sẵn và các lệnh bắt đầu bằng dấu chấm than; máy chủ chỉ bị chạm tới qua những gì bạn mount hoặc truyền vào. Cô lập chỉ công cụ (extension Gondolin): tiến trình Pi và extension của nó vẫn ở máy chủ, và chỉ các công cụ dựng sẵn cùng lệnh bắt đầu bằng dấu chấm than chạy trong một micro-VM Linux cục bộ. Cả hai đều phụ thuộc vào việc bạn mount gì, truyền credential nào vào, và mạng có mở hay không.](../images/isolation-scope.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> **Plain Docker** chạy toàn bộ tiến trình Pi trong container (Dockerfile của hướng dẫn dựa trên `node:24-bookworm-slim`), mount thư mục làm việc ở `/workspace`, truyền key bằng `-e`, và giữ cài đặt cùng session trong một named volume. **Docker Sandboxes** chạy Pi trong một sandbox được quản lý, nơi credential thật nằm lại trên máy chủ và một proxy thay thế nó cho các request tới host đã cấu hình. **OpenShell** chạy Pi trong sandbox cục bộ hoặc từ xa với các policy về filesystem, process, network, credential và inference. Sandbox từ xa không bind-mount thư mục của bạn, nên bạn phải chuyển file một cách tường minh. **Gondolin** là một extension chạy Pi trên máy chủ nhưng chuyển các công cụ dựng sẵn và lệnh `!` vào một micro-VM Linux cục bộ. Các công cụ extension khác vẫn chạy trên máy chủ trừ khi chúng ủy quyền. Hướng dẫn cảnh báo đừng mount `~/.pi/agent` (credential, cài đặt, extension, session) trừ khi chủ ý cho phép truy cập đó, lưu ý rằng biến môi trường truyền vào container thì nhìn thấy được bên trong, và nói rằng lệnh của Gondolin thừa hưởng môi trường của máy chủ, nên key đặt trong biến môi trường có thể hiện ra trong VM. Nó cũng dặn xem lại ví dụ Gondolin trước khi thêm các công cụ có thể vượt qua ranh giới VM. ([Containerization](https://pi.dev/docs/latest/containerization))

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Điều này làm câu chuyện phân quyền trở nên cụ thể, và làm lựa chọn sắc nét hơn. Cô lập toàn bộ tiến trình cũng nhốt luôn các extension tôi nạp, điều quan trọng vì các thử nghiệm của tôi chính là extension. Cô lập chỉ công cụ rào các công cụ dựng sẵn nhưng để code extension của tôi, và mọi công cụ nó đăng ký, ở lại máy chủ. Không cách nào sai, vì chúng trả lời những câu hỏi khác nhau. Công việc là có thật ở cả hai: chọn một cách, mount hẹp, giới hạn credential, và giữ cho thiết lập hoạt động khi Pi và extension của bạn thay đổi. Vì thế đề xuất bên dưới nghiêng về cô lập toàn bộ tiến trình.

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Nếu dùng Pi cho công việc thật, tôi sẽ bắt đầu với container, lựa chọn mà tài liệu nêu là mạnh nhất, chỉ mount project, và truyền một key phạm vi hẹp. Tôi sẽ thêm một extension `tool_call` để có khả năng quan sát và bắt lỗi, không phải để làm bức tường. Tôi chưa thử cấu hình này.

</div>

## 8. Từ agent đến workflow

Khi tôi xem xét việc dùng Pi trong các project vốn đã dùng phát triển có AI hỗ trợ, một vấn đề khác xuất hiện. Năng lực không phải workflow. Một agent có năng lực không biết project build thế nào, theo quy ước nào, test nào phải pass, hay khi nào công việc được coi là xong.

Phần còn lại của mục này là phân tích chi phí để đưa một agent vào một project. Đó là suy luận chung, không phải báo cáo về điều gì đã đi sai trong một project cụ thể của tôi.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> **Năng lực cho biết agent làm được gì. Workflow cho biết công việc tiến hành thế nào, dưới những ràng buộc nào, và việc hoàn thành được kiểm tra ra sao.** Việc đưa một agent vào project sẵn có đặt ra những câu hỏi như:

- **Ngữ cảnh.** Quy tắc của project nằm ở đâu? Pi nạp `AGENTS.md` và `CLAUDE.md` làm file ngữ cảnh, nên chỉ dẫn sẵn có có thể được mang sang. Chỉ dẫn vẫn không phải cưỡng chế.
- **Công cụ.** Các script sẵn có chạy được qua `bash`. Rẻ, nhưng model phải học chúng từ README hoặc `--help`.
- **Điều phối.** Nếu các quy trình có AI hỗ trợ khác cũng chạm vào cùng repository, ai quyết định cái gì chạy khi nào?
- **Kiểm chứng.** Ai đảm bảo test và review thực sự được chạy? Chỉ dẫn chỉ mang tính tham khảo. Extension hoặc một harness bên ngoài (RPC, chế độ JSON, SDK) là nơi có thể cưỡng chế kiểm tra.
- **Bàn giao.** Agent báo là đã xong bằng cách nào, và người hay quy trình tiếp theo biết bằng cách nào?

</div>

Đây là chỗ các phần trước gặp nhau. Khả năng quan sát, khả năng phục hồi và ranh giới phân quyền về bản chất đều là câu hỏi về workflow: hệ thống làm gì, có ai nhìn thấy được không, và cái gì ràng buộc nó. Một sản phẩm tích hợp đã quyết định nhiều điều trong số đó rồi. Với Pi, bạn tự quyết.

## 9. Không có WebUI tích hợp không có nghĩa là không có lựa chọn tích hợp

Pi không có giao diện web tích hợp, điều tôi cảm thấy là một khoảng trống. Nhưng thiếu UI và thiếu giao diện lập trình là hai chuyện khác nhau. Tài liệu liệt kê nhiều cách để điều khiển cùng một agent ([CLI](https://pi.dev/docs/latest/cli), [How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Giao diện | Mục đích sử dụng |
|---|---|
| Interactive (mặc định) | Giao diện terminal cho con người. |
| Print (`-p`) | Một prompt, văn bản cuối ra stdout, rồi thoát. |
| JSON (`--mode json`) | Chạy một lần và ghi sự kiện agent dưới dạng JSONL. |
| RPC (`--mode rpc`) | Process chạy lâu, được điều khiển bằng lệnh JSONL trên stdin, sự kiện ra stdout. |
| SDK | Thư viện TypeScript tạo và điều khiển session trong cùng process. |

Vậy một front end web không bị chặn. Bạn có thể xây một cái trên RPC hoặc SDK. Thứ các giao diện này không làm là công việc xung quanh chúng: dựng UI, xử lý output dạng stream, giữ trạng thái session, quyết định chuyện gì xảy ra khi có lỗi (phần 6), và quản lý vòng đời của agent. Trang SDK còn nêu một điểm tinh tế bạn sẽ phải xử lý: `agent_end` đánh dấu kết thúc một lần chạy, còn `agent_settled` báo hiệu Pi sẽ không tự tiếp tục. Tôi chưa xây front end nào như vậy, nên đây là mô tả bề mặt đã được tài liệu hóa, không phải trải nghiệm của tôi.

Chi tiết là nơi công việc ẩn mình ([RPC](https://pi.dev/docs/latest/rpc)). Hình cho thấy hình dạng của một prompt qua giao diện RPC, và phần mà một client ngây thơ làm sai.

![Vòng đời của một prompt RPC giữa client và pi --mode rpc. Client gửi prompt kèm id. Pi trả lời bằng một response mang cùng id và success true, nghĩa là prompt đã được nhận, xếp hàng hoặc xử lý, chưa phải đã xong. Sau đó Pi stream các sự kiện message_update, rồi agent_end khi một lượt chạy kết thúc, có thể có thêm sự kiện compaction và retry cùng một lượt chạy khác, và cuối cùng là agent_settled, nghĩa là Pi sẽ không tự tiếp tục.](../images/rpc-lifecycle.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> Mỗi bản ghi là một đối tượng JSON kết thúc bằng LF, và client chỉ nên tách theo LF: tài liệu cảnh báo `readline` của Node.js cũng tách theo U+2028 và U+2029, vốn có thể xuất hiện bên trong chuỗi JSON. Stdout chỉ mang bản ghi giao thức, còn thông tin chẩn đoán đi vào stderr. Lệnh nhận một `id` tùy chọn mà response lặp lại, và các response có thể đến không theo thứ tự. Một response `prompt` thành công nghĩa là prompt đã được nhận, xếp hàng hoặc xử lý, không phải công việc đã xong. Nếu `data.disposition` là `"handled"`, không có lượt chạy nào bắt đầu và `agent_settled` sẽ không theo sau. Client nên subscribe trước khi gửi prompt, và đóng stdin là yêu cầu thoát có trật tự. Bộ lệnh bao gồm session (`fork`, `clone`, `get_tree`, `export_html`), model (`set_model`, `set_thinking_level`) và `compact`, nên một front end có thể cung cấp phần lớn những gì TUI làm. Hộp thoại và thông báo của extension được chuyển tiếp qua RPC, nhưng custom component thì không. ([RPC](https://pi.dev/docs/latest/rpc), [extensions guide](https://pi.dev/docs/latest/extensions))

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Một client coi response đầu tiên là hoàn tất, hoặc đọc dòng bằng một bộ đọc tổng quát, có thể chạy tốt trong bản demo rồi hành xử sai về sau. Không điều nào trong số này khó, nhưng đó đúng là loại chi tiết mà việc thiếu WebUI giao cho bạn.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc thiếu WebUI là một phiên bản thu nhỏ của toàn bộ sự đánh đổi. Trải nghiệm làm sẵn không có, một trải nghiệm tự làm là khả thi, nhưng ai xây thì người đó sở hữu. Tôi không khẳng định việc bỏ qua này là một lựa chọn mang tính triết lý. Tài liệu tôi đọc không nói.

</div>

## 10. Code Mode: một hướng thiết kế tôi chưa thử

Tôi tìm thấy Code Mode của Pi trong tài liệu. Tôi **chưa dùng nó cho tác vụ thật nào**, nên phần này mô tả thiết kế đã được tài liệu hóa và không nói gì về kết quả.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Code Mode cho phép model viết một script JavaScript gọi các công cụ khác của Pi. Script chạy trong sandbox QuickJS, và "only the script's output reaches the model", nên một script có thể gom nhiều lời gọi và lọc kết quả lớn trước khi bất cứ thứ gì vào ngữ cảnh. Mỗi công cụ là một method trên `tools`, công cụ MCP gọi được theo cùng cách, và các lời gọi thất bại bị reject để `Promise.allSettled()` có thể giữ kết quả một phần. Sandbox không có API Node, hệ thống file, mạng hay timer: "scripts reach the outside world only through tools and `models`". Các giới hạn được tài liệu nêu gồm mặc định giới hạn output 10.000 token, giới hạn bộ nhớ 256 MB, không cho script codemode lồng nhau, và tối đa hai worker codemode cùng sống trong một process Pi. Một script thất bại vẫn giữ output một phần, và các lời gọi công cụ đã thực hiện trước lúc thất bại không được hoàn tác. ([tài liệu Code Mode](https://pi.dev/docs/latest/codemode))

</div>

![Gọi công cụ thông thường so với Code Mode. Với cách gọi công cụ thông thường, ba lời gọi và ba kết quả đầy đủ đều đi vào ngữ cảnh, mỗi bước là thêm một request tới model. Với Code Mode, model viết một script JavaScript chạy trong sandbox QuickJS, gọi công cụ, lọc và gộp, và chỉ đầu ra của script (trần mặc định 10.000 token, giữ đầu ra một phần khi lỗi) đến được model. Sandbox không có Node API, file system, mạng hay bộ hẹn giờ, giới hạn bộ nhớ 256 MB, không cho script codemode lồng nhau và hai worker cho mỗi tiến trình Pi, và các lời gọi công cụ đã thực hiện trước khi lỗi không được hoàn tác.](../images/codemode-flow.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> Extension quyết định Code Mode nhìn thấy gì. Mức phơi bày của một công cụ có thể là `direct` (mặc định), `model-only`, `codemode`, `deferred` hoặc `hidden`, và công cụ có thể khai báo namespace cùng các annotation kiểu MCP. Extension cũng có thể đăng ký MCP server bằng `pi.registerMcpServer()`. ([extensions guide](https://pi.dev/docs/latest/extensions)) Tôi chưa lần theo chính xác mỗi giá trị phơi bày làm gì, nên chỉ liệt kê chúng như các núm chỉnh có trong tài liệu và không hơn.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Bài [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/) của Earendil (29/09/2026) nói MCP nay đã là một phần của lõi Pi, Codemode chạy ở phía harness, và nó được nạp tự động khi MCP được cấu hình. Bài thừa nhận rằng pi.dev và các bài trước đó từng tuyên bố Pi không hỗ trợ MCP. [Bài tháng 11/2025 của Mario Zechner](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) nói Pi "does not and will not support MCP". Về lý do công cụ cần siêu dữ liệu mới cho Codemode, bài nói họ "did not yet upgrade our tool loadout to better scale to these new capabilities" (bài nêu việc nạp công cụ trì hoãn và các tính năng model tương tự).

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Code Mode và điều phối đa agent giải quyết các vấn đề khác nhau. Code Mode kết hợp các **lời gọi công cụ** trong một lượt của một agent, nên kết quả trung gian không tốn ngữ cảnh hay lượt đi về. Điều phối chia **công việc** cho nhiều agent, mỗi agent có tương tác model riêng. Code Mode không thay thế orchestrator tôi đã cố xây, và tôi không thể nói nó sẽ giúp được. Điều tôi thấy thú vị là sandbox ở đây tường minh: tầm với của script đúng bằng các công cụ nó được trao. Sự đánh đổi từ phần 5 vẫn áp dụng. Một script gom nhiều lời gọi vào một output thì hiệu quả, và cũng là nơi hoạt động trung gian bị giấu khỏi model.

</div>

Tôi muốn thử nó trên một tác vụ thật trước khi đánh giá. Cho đến lúc đó, nó vẫn chỉ là một giả thuyết.

## 11. Nhiều công cụ hơn, agent có tốt hơn?

Phản ứng đầu tiên của tôi trước môi trường mỏng của Pi (phần 1) là đếm những gì còn thiếu. Hệ thống công cụ khiến phản ứng đó đáng được xem xét lại, vì rất dễ biến "ít công cụ dựng sẵn" thành "kém năng lực hơn". Tôi không nghĩ số lượng công cụ quyết định được điều gì, và phần so sánh dưới đây nhằm cho thấy vì sao.

### Ba harness đi kèm những gì

<div class="callout documented">

<span class="label documented">Tài liệu</span> Mọi thứ trong bảng đều lấy từ tài liệu chính thức hoặc mã nguồn mở của các dự án, kiểm tra ngày 20/10/2026. Phần Claude Code lấy từ [tools reference](https://code.claude.com/docs/en/tools-reference) của nó. Các ô của Codex kết hợp tài liệu [customization](https://learn.chatgpt.com/docs/customization/overview), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) và [approvals](https://learn.chatgpt.com/docs/agent-approvals-security) với các tool handler trong mã nguồn [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) (commit `e18a20d`). Tôi không tìm thấy trang Codex chính thức nào liệt kê công cụ hay nêu tổng số, nên tôi không đưa ra con số nào.

</div>

| | Pi | Claude Code | Codex |
|---|---|---|---|
| **Bề mặt công cụ dựng sẵn** | 8 công cụ lõi (4 bật mặc định), cộng 2 công cụ extension tắt mặc định | Tools reference liệt kê 46 mục. Một số có điều kiện: công cụ task tùy model, `Grep` và `Glob` mặc định bị bỏ trên macOS, Linux và WSL, và một mục được ghi là đã gỡ | Không có danh sách hay tổng số được tài liệu hóa. Mã nguồn có handler cho thực thi shell (`exec_command`, `write_stdin`), `apply_patch`, `update_plan`, `view_image`, `request_user_input`, `request_permissions`, công cụ tài nguyên MCP, `tool_search`, công cụ multi-agent và web search do host cung cấp. Tôi không kiểm chứng cái nào được bật với một model hay cấu hình cụ thể |
| **Sửa file** | `edit` (thay thế chính xác), `write` | `Edit`, `Write`, `NotebookEdit` | `apply_patch` |
| **Tìm kiếm** | `bash`, hoặc `grep` / `find` / `ls` bật thêm | `Grep` / `Glob` trên Windows. Ở nơi khác, Claude mặc định tìm bằng `find` và `grep` qua `Bash` | Qua công cụ shell. Tôi không thấy handler tìm kiếm riêng |
| **Lập kế hoạch, sub-agent** | Không dựng sẵn; trang chủ ghi "No sub-agents", "No plan mode" | `Agent`, `EnterPlanMode`, `AskUserQuestion`, công cụ task, công cụ worktree và nhiều hơn | `update_plan`, `request_user_input`, công cụ multi-agent. Tài liệu mô tả subagent như một lớp tùy biến |
| **Thêm công cụ** | `registerTool()` trong extension, `customTools` của SDK, MCP | MCP ("To add custom tools, connect an MCP server"). Một skill "runs through the existing `Skill` tool rather than adding a new tool entry". Hook và quy tắc phân quyền ràng buộc công cụ | MCP, với `enabled_tools` / `disabled_tools` cho MCP server. Skill là chỉ dẫn; plugin đóng gói và phân phối chúng |
| **Phân quyền và sandbox** | Mặc định không có hộp thoại phê duyệt và không có sandbox; tài liệu bảo bạn tự mang container | Quy tắc allow và deny theo tên công cụ, chế độ phân quyền, và cờ theo từng công cụ cho biết có cần hỏi hay không | Sandbox do hệ điều hành cưỡng chế (Seatbelt, bwrap cộng seccomp) cộng chính sách phê duyệt. Với thư mục có version control, mặc định là `workspace-write` với phê duyệt `on-request` |
| **Kiểm soát chi phí ngữ cảnh** | Allowlist `--tools`, `exposure`, `tool_search`, `codemode` | `ToolSearch` mặc định hoãn định nghĩa công cụ MCP; `alwaysLoad` cho một server không bị hoãn | `enabled_tools` / `disabled_tools`; có một công cụ `tool_search` trong mã nguồn |

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Đọc bảng này, tôi thấy ba canh bạc khác nhau, chứ không phải một bên lớn và một bên nhỏ. Pi đặt cược vào một ít nguyên liệu tổng quát cộng hook bạn tự lập trình. Claude Code đặt cược vào một bề mặt rộng, tích hợp, với lớp chính sách (phân quyền, hook, plugin) bao quanh. Codex, xét theo tài liệu và mã nguồn của nó, đặt cược vào một ít nguyên liệu mạnh (shell và patch) bên trong sandbox cấp hệ điều hành cùng chính sách phê duyệt. Các nhà cung cấp không nêu những điều này như triết lý thiết kế, nên đây là cách tôi đọc những gì họ phát hành.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Tác giả của Pi đã nêu lý do cho bộ công cụ nhỏ: tháng 11/2025 Mario Zechner viết rằng "these four tools are all you need for an effective coding agent", rằng system prompt và định nghĩa công cụ của Pi "come in below 1000 tokens", và rằng các MCP server phổ biến "dump their entire tool descriptions into your context on every session" (đổ toàn bộ mô tả công cụ vào ngữ cảnh của bạn ở mỗi session). Ông mô tả định nghĩa công cụ của Codex là "similarly minimal to pi's" và Claude Code là "a spaceship with 80% of functionality I have no use for" ([bài viết](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)). Đó là ý kiến của tác giả, trong một bài cũng nói Pi sẽ không hỗ trợ MCP. Pi từ đó đã đổi hướng về MCP (phần 10), và tôi chưa kiểm chứng con số 1.000 token với phiên bản hiện tại.

</div>

### Lập luận: bộ công cụ lớn hơn không tự động làm agent tốt hơn

Tuyên bố của tôi hẹp hơn "ít hơn thì tốt hơn". **Một bộ công cụ lớn hơn tự nó không làm agent có năng lực, đáng tin cậy hay hữu ích hơn, và một bộ nhỏ hơn tự nó cũng không làm agent an toàn hơn hay dễ sống chung hơn.** Sáu góc nhìn dưới đây, mỗi cái được đánh dấu là loại khẳng định nào.

![Ba cách một công cụ đến với model. Khai báo sẵn: định nghĩa nằm trong mọi request; ở Pi là exposure direct và các công cụ dựng sẵn, ở Claude Code là công cụ dựng sẵn và công cụ MCP có alwaysLoad; chi phí là ngữ cảnh ở mọi turn dù công cụ có được dùng hay không. Tìm khi cần: chỉ có tên ở phía trước và một bước tìm kiếm nạp định nghĩa; ở Pi là exposure deferred cùng công cụ tool_search, ở Claude Code là ToolSearch cho công cụ MCP; chi phí là thêm một bước và model phải tự tìm. Tiếp cận qua script: model viết code gọi công cụ và chỉ output quay lại; ở Pi là công cụ codemode, và công cụ MCP mặc định dùng exposure này; chi phí là các lời gọi trung gian bị ẩn. Một ghi chú nói cùng một công cụ có thể nằm ở các cột khác nhau tùy cấu hình, nên có bao nhiêu công cụ và model thấy bao nhiêu công cụ ở mỗi turn là hai câu hỏi khác nhau.](../images/tool-reach.svg)

**1. Đơn giản so với năng lực.** <span class="label opinion">Quan điểm</span> Một ít công cụ tổng quát có thể phủ các thao tác cơ bản: đọc, ghi, sửa và chạy lệnh. Riêng `bash` đã làm được những gì `grep`, `find` và `ls` làm, đó là lý do ba công cụ ấy phải bật thêm ở Pi, và tài liệu Claude Code nói rằng trên macOS, Linux và WSL nó cũng mặc định bỏ `Grep` và `Glob` và tìm kiếm qua `Bash`. Chồng chéo là chỗ một bộ lớn hơn bắt đầu tốn kém: hai công cụ làm gần giống nhau buộc model phải chọn và buộc bạn phải hiểu hai hành vi. Nhưng một bộ nhỏ cũng có chồng chéo (`edit` và `write` đều sửa file, và `bash` làm được cả hai), nên nhỏ không đồng nghĩa với không chồng chéo.

**2. Chọn công cụ và suy luận.** <span class="label opinion">Quan điểm</span> Trực giác là mỗi công cụ thêm vào là một lựa chọn nữa model phải cân nhắc, có thể làm việc chọn kém dự đoán được hơn. Tôi chưa đo điều đó, và cả tài liệu Pi lẫn Claude Code tôi đọc đều không đưa ra khẳng định về độ chính xác khi chọn công cụ, nên tôi coi nó là một giả thuyết. Điều tài liệu cho thấy là cả hai sản phẩm đều xây cơ chế để không khai báo mọi thứ ngay từ đầu (hình trên), gợi ý rằng các tác giả coi trọng chi phí của một tập khai báo lớn. Đó là suy luận về ý định, không phải lý do được nêu ra.

**3. Khả năng mở rộng so với sự đầy đủ dựng sẵn.** <span class="label opinion">Quan điểm</span> Một lõi tối giản đặt ra ít giả định hơn và dễ đọc từ đầu đến cuối hơn. Cái giá tương ứng chính là điều cả bài này nói đến: bất cứ thứ gì lõi bỏ ra, ai đó phải xây, kiểm thử và bảo trì. API extension của Pi rộng rãi, nhưng một công cụ tự viết là code bạn sở hữu, viết trên một API đã từng thay đổi (phần 12 nhắc tới việc đổi tên package). Một harness tích hợp đã làm việc đó một lần, cho tất cả mọi người.

**4. Kiểm soát so với tiện lợi.** <span class="label opinion">Quan điểm</span> Một bộ mặc định nhỏ là nền rõ ràng để tùy biến: bạn đọc được model được cung cấp gì, đổi nó, và móc vào mọi lời gọi. Một harness được trau chuốt cho bạn thứ chạy được ngay ngày đầu. Cả hai đều là giá trị thật. Bên nào thắng tùy việc bạn có bao giờ dùng đến sự kiểm soát đó không, và tôi sẽ không trung thực nếu nói lúc nào tôi cũng dùng.

**5. Chi phí ngữ cảnh và cài đặt.** <span class="label documented">Tài liệu</span> Định nghĩa công cụ, schema và chỉ dẫn đều là ngữ cảnh. Tài liệu Claude Code nói "each upfront tool consumes context that would otherwise be available for your conversation", rằng mỗi skill trong danh sách "adds to your context on every turn", và rằng tool search giữ ngữ cảnh MCP ở mức thấp "by deferring tool definitions until Claude needs them". Pi giới hạn phần khai báo công cụ trong mô tả của `codemode` ở 3.000 token ước tính theo mặc định. Output cũng quan trọng: công cụ dựng sẵn của Pi cắt ở 2.000 dòng hoặc 50 KB, và Claude Code lưu kết quả MCP quá lớn ra đĩa khi vượt 50.000 ký tự. <span class="label opinion">Quan điểm</span> Vậy chi phí là có thật, nhưng phụ thuộc vào thứ được khai báo. Mười công cụ nhỏ có thể tốn ít hơn một công cụ với schema khổng lồ, và một công cụ bị hoãn gần như không tốn gì cho đến khi cần. Khẳng định "mỗi công cụ thêm vào đều gây hại" không suy ra được.

**6. Độ tin cậy và trách nhiệm.** <span class="label opinion">Quan điểm</span> Một bộ công cụ nhỏ hơn không làm agent an toàn hay đáng tin cậy. Bốn công cụ mặc định của Pi có `bash`, thứ làm được gần như mọi việc người dùng làm được, và tài liệu bảo mật của nó nói thẳng rằng nó không hỏi trước mỗi lời gọi. Codex có sandbox và chính sách phê duyệt, Claude Code có quy tắc phân quyền theo công cụ, và cả hai đều không phụ thuộc vào số lượng công cụ. Điều quyết định độ tin cậy là chất lượng cài đặt của từng công cụ, việc kiểm tra đầu vào, báo lỗi, và ranh giới quanh việc thực thi. Một công cụ có mô tả mơ hồ hoặc lỗi âm thầm gây hại hơn một công cụ bị thiếu.

### Chủ nghĩa tối giản của Pi giúp ở đâu, và tốn kém ở đâu

| Giúp ở đâu | Tốn kém ở đâu |
|---|---|
| Bề mặt ngắn, dễ đọc: tám cái tên, bốn cái mặc định | Mọi thứ ngoài thao tác file và `bash` là việc bạn phải tự xây hoặc cài |
| Bạn chọn model thấy gì (`--tools`, `exposure`) | Bạn phải biết lựa chọn đó tồn tại, và phải đưa ra nó |
| Một điểm hook thấy mọi lời gọi, kể cả lời gọi lồng nhau | Hook là bề mặt chính sách, không phải sandbox; ranh giới là việc bạn tự dựng (phần 7) |
| Ít giả định được nhúng sẵn, nên harness ít gây bất ngờ | Các workflow phổ biến (kế hoạch, sub-agent, phê duyệt) bắt đầu từ trang trắng |
| Dễ nhúng qua RPC hoặc SDK | Nhúng khiến bạn là chủ của phần keo dán (phần 9) |

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Phản biện xứng đáng được cân nhắc đầy đủ. Một bộ dựng sẵn phong phú tiết kiệm công cài đặt, tránh cảnh mười người cùng viết dở một công cụ sub-agent, và đưa các workflow phổ biến đến tầm tay ngay ngày đầu. Với nhiều nhóm, đó đúng là sự đánh đổi phù hợp. Chủ nghĩa tối giản của Pi trả công nhiều nhất khi bạn muốn hiểu và định hình hệ thống, và tốn nhiều nhất khi bạn chỉ muốn một agent chạy được ngay chiều nay. Đây cũng không phải một ranh giới rạch ròi: Claude Code mặc định hoãn công cụ MCP sau tìm kiếm, còn Pi đã có thêm MCP và một công cụ scripting, nên hai sản phẩm đang tiến lại gần nhau.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> **Kết luận của tôi: câu hỏi không phải agent có bao nhiêu công cụ. Mà là chúng có tạo thành một hệ thống mạch lạc hay không.** Tức là đúng năng lực, ở đúng mức trừu tượng (một `bash` tổng quát hay một công cụ hẹp, mô tả kỹ), với cách hợp lý để giữ chúng ngoài ngữ cảnh của model cho đến khi cần, và một ranh giới quanh những gì chúng làm được. Pi đưa cho bạn các bộ phận và các quyết định. Claude Code và Codex đưa ra nhiều quyết định đó hộ bạn hơn. Tôi chưa kiểm tra bên nào cho kết quả tốt hơn trên công việc thực, và chỉ riêng số lượng công cụ không cho bạn biết điều đó.

</div>

## 12. Tự do, tiện lợi, và ai sở hữu hệ thống

Các thí nghiệm này cộng lại thành gì? Khả năng mở rộng chính là điểm mấu chốt của Pi: hành vi lập trình được, một hook duy nhất nơi mọi lời gọi công cụ đều có thể bị kiểm tra hoặc từ chối, các luồng sự kiện bạn có thể xây lên trên, và một lõi đủ nhỏ để hiểu. Mỗi thứ đó đi kèm một cái giá tương ứng, và cái giá luôn giống nhau. Quyết định đã chuyển sang tôi.

| Pi cho bạn gì | Pi đòi hỏi gì ở bạn |
|---|---|
| Định hình nhiều phần của hệ thống hơn | Quyết định có gì trong đó, và bảo trì nó |
| Hành vi tùy chỉnh khớp nhu cầu của bạn | Kiểm thử nó, và giữ cho nó chạy được khi Pi thay đổi. Package từng đổi scope npm một lần: `@mariozechner/pi-coding-agent` có từ 11/2025, `@earendil-works/pi-coding-agent` từ 05/2026, theo npm registry, nơi giờ đánh dấu tên cũ là deprecated và khuyên dùng tên mới. |
| Nhìn thấy và thay đổi các quyết định kiến trúc | Đưa ra chúng cho tốt: phân quyền, cách ly, khả năng quan sát, phục hồi sau lỗi |
| Không có chính sách đóng gói sẵn để phải chống lại | Tự cung cấp chính sách của riêng bạn, hoặc làm việc mà không có |

Hệ thống công cụ là ví dụ rõ nhất. Pi cho bạn một bộ nguyên liệu nhỏ và chỗ để thêm của riêng bạn, và phần 11 lập luận rằng đó là một canh bạc chứ không phải một thiếu sót. Sản phẩm tích hợp không phải là đối lập của khả năng mở rộng. Chẳng hạn Claude Code có hook, skill, sub-agent, plugin và MCP, và Pi không phải không có tiện ích. Khác biệt là **bao nhiêu thứ được quyết định sẵn cho bạn theo mặc định, và ai bảo trì nó**.

## 13. Khi nào nên dùng Pi?

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Hãy dùng Pi khi bạn muốn nhiều hơn một agent chạy được ngay. Hãy dùng nó khi bạn muốn hiểu agent vận hành ra sao, định hình lại workflow của nó, mở rộng năng lực của nó, và nhận trách nhiệm cho hệ thống bạn xây quanh nó. Các phần trên là hình hài của trách nhiệm đó trong các thí nghiệm của tôi: thiết kế việc ủy quyền, làm cho nó quan sát được, quyết định phục hồi nghĩa là gì khi một lần chạy thất bại, quyết định ranh giới phân quyền nằm ở đâu, và đưa agent vào workflow của một project.

Nếu ưu tiên của bạn là hoàn thành công việc với ít thiết lập và bảo trì nhất có thể, một sản phẩm tích hợp hơn có thể là lựa chọn tốt hơn. Chọn tiện lợi thay vì kiểm soát không có gì sai, và tự xây mọi thứ cũng không có gì vốn dĩ tốt hơn.

</div>

Làm việc với Pi khiến tôi ý thức hơn về một sự đánh đổi dễ bị bỏ qua: **tự do chuyển trách nhiệm.** Bạn càng kiểm soát nhiều một hệ thống, bạn càng phải đưa ra nhiều quyết định để biến sự kiểm soát đó thành một trải nghiệm làm việc đáng tin cậy. Chính tài liệu của Pi cũng nói đúng như vậy về phân quyền: nó bảo bạn tự mang container đến, và mô tả bốn cách để làm điều đó.

Vậy câu hỏi không phải là Pi có tốt hơn các coding agent khác hay không. Tôi chưa thử điều đó, và bài này không khẳng định gì về nó. Câu hỏi là sự tự do Pi đem lại có đáng với phần việc thêm mà bạn sẵn sàng nhận hay không. Tôi mở đầu bằng một model mạnh trong một môi trường mỏng. Môi trường mỏng ấy chính là lời đề nghị, và công việc lấp đầy nó là cái giá.

**Tự do cho bạn khả năng xây hệ thống mình muốn. Tiện lợi giúp bạn tốn ít thời gian hơn cho việc xây hệ thống ngay từ đầu.**

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Giờ đây tôi đánh giá một coding agent không chỉ bằng chất lượng code nó tạo ra. Tôi còn xem ranh giới phân quyền của nó nằm ở đâu, nó thất bại và phục hồi ra sao, tôi có thấy được nó đang làm gì không, và tốn bao nhiêu công để đưa nó vào workflow của một project. Đó là những câu hỏi mà các phần trên cứ quay lại.

</div>

## Tài liệu tham khảo

**Pi: tài liệu chính thức và mã nguồn**

- [pi.dev](https://pi.dev), [Sessions](https://pi.dev/docs/latest/sessions), [Skills](https://pi.dev/docs/latest/skills), [Packages](https://pi.dev/docs/latest/packages), [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Configuration](https://pi.dev/docs/latest/configuration), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [CLI](https://pi.dev/docs/latest/cli), [Code Mode](https://pi.dev/docs/latest/codemode), [Usage](https://pi.dev/docs/latest/usage), [RPC](https://pi.dev/docs/latest/rpc), [Containerization](https://pi.dev/docs/latest/containerization), [MCP](https://pi.dev/docs/latest/mcp), [Quickstart](https://pi.dev/docs/latest/quickstart)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools) (gồm [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts)), [`agent-loop.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts), [`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts), [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts), [`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts), [`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts), [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)
- Metadata của npm registry (`npm view`) cho `@earendil-works/pi-coding-agent` và `@mariozechner/pi-coding-agent` (đã deprecated), kiểm tra ngày 20/10/2026

**Pi: bài viết của các tác giả**

- Mario Zechner, [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/), tháng 11/2025
- Earendil, [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/), 29/09/2026

**So sánh và tài liệu nền**

- Claude Code, [Tools reference](https://code.claude.com/docs/en/tools-reference), [MCP (gồm tool search)](https://code.claude.com/docs/en/mcp), [Skills](https://code.claude.com/docs/en/skills), [Configure permissions](https://code.claude.com/docs/en/permissions) và [Permission modes](https://code.claude.com/docs/en/permission-modes)
- OpenAI Codex, [Customization](https://learn.chatgpt.com/docs/customization/overview), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Agent approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security), và các tool handler mã nguồn mở trong [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) (commit `e18a20d`)
- Docker, [Docker security](https://docs.docker.com/engine/security/)
