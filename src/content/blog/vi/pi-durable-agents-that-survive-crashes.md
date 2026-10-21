---
title: 'Pi Durable: Xây dựng AI agent sống sót qua sự cố'
description: 'Durable execution, hội thoại được lưu bền, checkpoint của task và điều thực sự xảy ra với một tool call dang dở sau khi crash. Hướng dẫn Pi Durable kèm một ví dụ chạy được, tự kill chính process của nó.'
pubDate: 2026-10-21T09:00:00+07:00
category: AI Agents
tags: [pi, pi-durable, durable-execution, architecture, typescript]
featured: false
draft: false
---

<div class="callout">

**Cách đọc bài này.** Pi Durable còn non trẻ và API của nó thay đổi liên tục, nên mỗi nhận định đều mang nhãn:

- <span class="label documented">Tài liệu</span>: có trong thông báo chính thức, README của package hoặc tài liệu Cloudflare, kèm liên kết ngay cạnh nhận định.
- <span class="label verified">Đã kiểm chứng</span>: tôi đã chạy thử. Mã nằm trong bài này; tôi chưa công bố repository nào, nên hãy sao chép từ đây.
- <span class="label opinion">Quan điểm</span>: cách tôi diễn giải.
- <span class="label proposal">Đề xuất</span>: một kiến trúc tôi cho rằng suy ra được từ thiết kế. Không phải thứ package có sẵn.

**Phiên bản.** Mọi thứ đều dựa trên `@earendil-works/pi-durable` **1.3.0**, `@earendil-works/pi-ai` 1.3.0 và `@earendil-works/chord` 1.3.0, tức các tag `latest` trên npm ngày 21/10/2026, chạy trên Node.js 26.9.0 (package khai báo `node >=22.19.0`). Pi Durable còn **mang tính thử nghiệm**: README ghi rằng "the API changes without notice between releases" (API thay đổi giữa các bản phát hành mà không báo trước). Hãy xem mọi signature ở đây là một bản chụp tại thời điểm viết.

</div>

## 1. Cuộc săn lỗi 40 phút chết ở phút thứ 38

Một AI coding agent đang truy một lỗi đơn hàng chập chờn. Nó đã grep log, đọc bốn file, chạy bộ test hai lần và hình thành một giả thuyết. Nó sắp mở một ticket với kết quả điều tra. Rồi process bị kill: một lần deploy, một lần bị OOM kill, một lần gập laptop.

Bạn mất gì? Nếu bản ghi duy nhất của lượt chạy là một đoạn chat, bạn có thể khởi động lại agent với đoạn chat đó. Nhưng đoạn chat chỉ nói "tôi đã chạy test", chứ không cho biết lời gọi tạo ticket đã đến được tracker hay chưa. Một lần khởi động lại gửi lại request cuối có thể mở ra một ticket trùng. Khởi động lại từ đầu thì trả tiền cho cùng những lần gọi model một lần nữa và đi đến một kết luận hơi khác.

Đây là khoảng cách giữa **lịch sử hội thoại** (điều đã được nói) và **trạng thái thực thi** (điều đang chạy dở, điều đã xong, điều không được chạy hai lần). Các công cụ chat đơn giản có thể bỏ qua nó. Những agent chạy hàng phút hay hàng giờ, trên server, do nhiều người cùng điều khiển thì không thể.

Câu hỏi bài viết này theo đuổi: *nếu một agent có thể tiếp tục sau crash thay vì làm lại từ đầu thì sao?* Và câu hỏi tiếp theo khó chịu hơn: *"tiếp tục" chính xác cam kết điều gì, và không cam kết điều gì?*

### 1.1 "Durable" nghĩa là gì và không có nghĩa là gì

Ba tầng, mỗi tầng đòi hỏi nhiều hơn tầng trước:

1. **Lưu bền hội thoại.** Các entry đã commit vào storage được cấu hình vẫn còn sau khi khởi động lại.
2. **Khôi phục thực thi.** Khi mở lại, framework tìm các task bị gián đoạn (một model request, một tool call) và áp dụng quy tắc khôi phục của nó: tiếp tục, gửi lại, chạy lại, hoặc báo task là bị gián đoạn.
3. **Durable workflow đầu cuối.** Một workflow nhiều bước tiếp tục được an toàn, nhưng chỉ khi storage, các tool và những hệ thống bên ngoài mà chúng gọi cung cấp các bảo đảm mà workflow cần. Framework không thể tự cung cấp những bảo đảm đó từ bên trong.

Trạng thái nội bộ được lưu bền **không**, tự thân nó, cho bạn:

- việc thực thi đúng một lần (exactly-once) của các side effect bên ngoài;
- việc biết một thao tác bên ngoài đã thành công hay thất bại;
- khả năng khôi phục từ mọi sự cố hạ tầng hay storage (process bị kill không phải là mất điện hay đĩa hỏng);
- việc retry an toàn các thao tác không idempotent;
- sự nhất quán giữa một hệ thống bên ngoài và trạng thái nội bộ của agent.

Bạn nhận được những gì trong số này phụ thuộc vào kiểu sự cố, cấu hình storage, quy tắc khôi phục của framework và cách viết từng tool. Mục 5 và 6 kiểm thử một kiểu sự cố (process bị kill) trên một storage (SQLite), và nói rõ phép thử dừng ở đâu.

## 2. Pi Durable là gì

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi Durable là một framework TypeScript cho các agent chạy lâu, chịu được crash, có thể chạy ở bất cứ đâu có runtime JavaScript. [Thông báo](https://earendil.com/posts/pi-durable/) mô tả nó được phát hành thử nghiệm cùng với Pi 1.0. [README](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md) mô tả package là một durable agent harness.

</div>

Thông báo nói rõ rằng nó **không thay thế Pi coding agent**. Nó là một framework riêng, dùng chung mã (như `pi-ai`, API model thống nhất) và các nguyên tắc thiết kế với Pi. Những bài học từ nó có thể chảy ngược về Pi.

| | Pi Coding Agent | Pi Durable |
|---|---|---|
| Hình dạng | Một agent tương tác, một người điều khiển một process trong terminal | Một thư viện để xây ứng dụng agent |
| Trạng thái | Nằm trong process duy nhất điều khiển nó | Storage là nguồn sự thật; process có thể thay thế |
| Nơi chạy điển hình | Terminal của lập trình viên | Một backend service, một bot, một Cloudflare Durable Object |
| Client | Một | Số lượng bất kỳ có thể gắn vào một hội thoại |

<div class="callout documented">

<span class="label documented">Tài liệu</span> Thông báo liệt kê những gì nó nhắm tới: các agent chạy trên bất kỳ máy nào, truy cập được từ nhiều bề mặt, xử lý hội thoại rất dài, sống sót qua crash, và cho phép nhiều người cùng lái một agent.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Tôi sẽ không mô tả Pi Durable là "phiên bản production của Pi". Thông báo nói một số bài học của nó có thể chảy ngược về Pi, và hai bên dùng chung mã, nhưng hiện nay nó là một framework để bạn xây ứng dụng lên trên, không phải một sản phẩm để khởi chạy.

</div>

## 3. Vòng lặp agent truyền thống đánh mất điều gì

Vòng lặp quen thuộc rất ngắn:

```text
User request → LLM → tool call → tool result → LLM → … → final response
```

Toàn bộ trạng thái làm việc của nó nằm trong process: mảng messages, tool call nào đang chạy, kết quả nào đã trả về, các follow-up đang xếp hàng. Lưu *messages* (tầng 1 ở mục 1.1) là một cải tiến phổ biến. Nó cho phép bạn hiển thị, tìm kiếm và tiếp tục transcript, và nó giải quyết một vấn đề khác với vấn đề crash gây ra: biết rằng một model request đang chạy dở và một tool call mới xong một nửa (tầng 2). Durable workflow, tầng thứ ba, bổ sung timer, chờ đợi và công việc con, tất cả đều được checkpoint.

Sau một crash, một agent chỉ lưu transcript gặp những vấn đề sau:

- Nó không biết tool call nào đã xong. Kết quả của một tool chỉ có trong transcript nếu vòng lặp kịp ghi nó.
- Một lần retry có thể lặp lại side effect: một ticket trùng, một email thứ hai, một lần trừ tiền kép.
- Output đang stream và các kết quả trung gian chưa kịp ghi sẽ mất.
- Khởi động lại từ đầu lại tốn token của model một lần nữa.

Pi Durable chuyển trạng thái của vòng lặp vào storage để process trở nên dùng xong bỏ được:

![Hai cột so sánh. Một agent truyền thống giữ trạng thái vòng lặp trong bộ nhớ process, nên sau crash nó khởi động lại từ đầu hoặc đoán điều gì đã xong. Một durable agent commit từng bước vào storage trước, nên process mới mở lại storage, giữ công việc đã commit, tiếp tục các task chưa xong và báo các tool call không an toàn là bị gián đoạn.](../images/durable-vs-traditional.svg)

Sơ đồ trên là luồng khôi phục mà tôi kiểm chứng ở phần sau của bài. Trước hết là các khối xây dựng.

## 4. Kiến trúc

![Kiến trúc của Pi Durable. Ứng dụng gọi vào một Harness, bên trong có các conversation, task và document. Mỗi thay đổi là một atomic commit vào một storage backend. Các model provider, bash và API bên ngoài nằm ngoài commit.](../images/durable-architecture.svg)

### 4.1 Harness

<div class="callout documented">

<span class="label documented">Tài liệu</span> Một harness là "one open storage plus the machinery that runs agents on it" (một storage đang mở cộng với bộ máy chạy các agent trên đó). Mọi thay đổi đi qua một chuỗi atomic commit, và không có gì được hiển thị cho observer trước khi commit của nó được lưu ([README, Concepts](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md)).

</div>

Harness sở hữu việc lập lịch, lời gọi model, việc thực thi tool, retry và compaction. Ứng dụng sở hữu lựa chọn model, những tool nào tồn tại và tool nào an toàn để chạy lại, cách client kết nối, xác thực, và mọi thứ nằm ngoài ranh giới commit.

### 4.2 Conversation và entry

Một conversation là một transcript gồm các **entry bất biến**: tin nhắn người dùng (`pi.user`), phản hồi của model (`pi.assistant`), kết quả tool (`pi.tool-result`), thay đổi system prompt (`pi.system`), reset (`pi.reset`), hoặc các loại entry do bạn tự định nghĩa. Một handle `Conversation` không giữ trạng thái, nên bạn so sánh các handle theo `id`. Model nhìn thấy các entry từ lần reset gần nhất trở đi.

Conversation có thể được tạo, tiếp tục từ storage, và fork từ bất kỳ điểm nào trong transcript của conversation khác mà không sao chép lịch sử ([thông báo](https://earendil.com/posts/pi-durable/)).

Vì sao lịch sử không phải toàn bộ trạng thái: transcript cho biết model đã thấy gì. Hiểu biết của scheduler về task nào đang chờ, tool call nào đã ghi intent nhưng chưa có kết quả, và những submission nào đang xếp hàng nằm trong **document và task record** bên cạnh nó, như `pi.live`, `pi.inbox` và `pi.agent`.

### 4.3 Task và checkpoint

<div class="callout documented">

<span class="label documented">Tài liệu</span> Một task là "a durable state machine that saves a checkpoint at every step, so a restarted process continues from the last one" (một state machine bền, lưu checkpoint ở mỗi bước, để process khởi động lại tiếp tục từ checkpoint cuối). Mỗi task có một owner, là conversation của nó hoặc một task khác. README cho một input được trả lời như sau:

</div>

```text
submit(input) → pi.user
  pi.generation → pi.system (only if the prompt or tools changed), pi.assistant (tool calls)
    pi.tool × n → pi.tool-result × n   (owned by the generation, which waits for them)
  pi.generation → pi.assistant (answer) → submission done
```

Như vậy một lời gọi model là một task (`pi.generation`), và mỗi tool call là một task riêng (`pi.tool`). Khi mở lại, harness tìm các task chưa xong và quyết định, theo từng task, nên tiếp tục, retry hay báo gián đoạn. Mục 5 trình bày các quy tắc đó.

### 4.4 Document và atomic commit

Một **document** là trạng thái JSON có kiểu, được lưu cùng transcript và thay đổi trong cùng các commit. `conversation.commit((tx) => …)` có thể đồng thời append entry, sửa document và tạo task: "either all of it is stored or none of it" (hoặc tất cả được lưu, hoặc không gì cả). Các document có sẵn chứa lựa chọn của agent, các submission đang xếp hàng, lượt generation đang chạy và chi phí; bạn có thể tự định nghĩa thêm (một danh sách todo, một kế hoạch).

<div class="callout documented">

<span class="label documented">Tài liệu</span> Tính nguyên tử nằm **bên trong storage**. Một commit không thể bao gồm một lời gọi HTTP tới issue tracker của bạn. Thông báo và README không khẳng định có transaction xuyên qua các dịch vụ bên ngoài, và tôi cũng không khẳng định như vậy.

</div>

### 4.5 Storage

<div class="callout documented">

<span class="label documented">Tài liệu</span> Từ [bảng storage trong README](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md):

</div>

| Backend | Sống sót qua khởi động lại | Ghi chú |
|---|---|---|
| `MemoryStorage` | Không | Cho test và demo |
| SQLite (`openNodeSqliteStorage`) | Có | Chế độ WAL, `synchronous = NORMAL`: commit sống sót qua crash process; commit mới nhất có thể mất khi mất điện hoặc host hỏng |
| JSONL (`openNodeJsonlStorage`) | Có | File chỉ ghi thêm (append-only); `{ fsync: true }` flush trước mỗi commit marker; giữ toàn bộ lịch sử trong bộ nhớ, nên dùng SQLite cho agent chạy lâu |
| Cloudflare Durable Object | Có | `openDurableObjectSqliteStorage(ctx.storage)`; commit là các storage transaction của object |

Phần lõi SQLite và JSONL không dùng Node API, nên với một adapter nhỏ chúng có thể chạy trên Bun hoặc trong Durable Object. Interface của storage đủ nhỏ để cài đặt trên một kho khác, và package kèm một bộ conformance suite cho việc đó.

Hai giới hạn quan trọng với thiết kế: **một process sở hữu một storage tại một thời điểm, không có khóa liên process**, và một lỗi storage sẽ đóng harness (mục 8). Chọn SQLite cho dịch vụ một server, Durable Object khi Cloudflare là host, JSONL khi bạn muốn file có thể đọc và diff, và memory chỉ để test.

## 5. Khôi phục crash hoạt động thế nào

Đây là kịch bản, cùng với điều tài liệu và lần chạy của tôi cho biết sẽ xảy ra ở mỗi bước.

1. Người dùng gửi "investigate the order failures". Input được **ghi nhận bền** trong một commit trước khi có bất kỳ công việc nào của model.
2. Model yêu cầu `search_logs`. Tool task ghi lại **intent** của nó (tham số cuối cùng và replay policy) *trước khi* `execute()` chạy ([README, Tools](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md)).
3. `search_logs` chạy xong và kết quả của nó được commit.
4. Model yêu cầu `open_ticket`. Intent của nó được commit, `execute()` bắt đầu, và process bị kill.
5. Một process mới mở cùng storage và gọi `resume()`.
6. Harness thấy các task chưa xong. Trạng thái đã commit được giữ nguyên.
7. Với tool call bị gián đoạn, **replay policy** quyết định: chỉ chạy lại nếu nó được khai báo `replay: "safe"`, nếu không model nhận một kết quả lỗi `interrupted` chứa output đã commit đến lúc đó, và lượt chạy tiếp tục từ đó.

<div class="callout verified">

<span class="label verified">Đã kiểm chứng (đọc mã nguồn)</span> Trong `dist/harness/tool.js` của 1.3.0, handler khôi phục chỉ chạy lại một call khi policy lưu cùng intent **và** khai báo hiện tại của tool đều là `safe`. README chỉ mô tả cờ được khai báo, nên một tool có cờ thay đổi giữa các lần deploy sẽ không được chạy lại theo intent cũ.

</div>

<div class="callout documented">

Thông báo và README cũng mô tả các phần có thể khôi phục khác:

- <span class="label documented">Tài liệu</span> Một **model request** bị gián đoạn được gửi lại, phần trả lời dở được giữ và đánh dấu là aborted ([thông báo](https://earendil.com/posts/pi-durable/)).
- <span class="label documented">Tài liệu</span> **Vòng lặp crash bị giới hạn** bởi `settings.restartLimit` (mặc định 5). Các task vượt giới hạn bị đưa vào trạng thái parked, và `harness.retryTask(id)` retry chúng.
- <span class="label documented">Tài liệu</span> Một submission mang `requestId` được **ghi nhận exactly-once**: gửi lại cùng ID sẽ trả về submission đã có.

</div>

Cách phân loại đó là cốt lõi:

| Trạng thái tại thời điểm crash | Khôi phục |
|---|---|
| Đã commit (entry, kết quả tool đã xong, document) | Giữ nguyên. Không bao giờ tính lại. |
| Model request đang chạy | Gửi lại; phần trả lời dở được giữ và đánh dấu aborted |
| Tool call đang chạy, `replay: "safe"` | Chạy lại |
| Tool call đang chạy, mặc định | Không chạy lại; model nhận lỗi `interrupted` và tự quyết định làm gì |
| Quyết định của hook chưa được memoize | Chạy lại, nên hãy lưu quyết định bằng `api.memo` (lần ghi đầu thắng) |

Bảng trên cho biết điều gì xảy ra với trạng thái *nội bộ*. Sơ đồ tiếp theo bổ sung phần mà storage không nhìn thấy: cùng vòng đời đó với hai ranh giới được vẽ ra.

![Vòng đời của một durable task qua chín bước, trên ba cột: agent process, storage và một external tracker. Các bước 1 đến 4 commit input, một checkpoint của generation, tool call của model và intent của tool vào storage. Bước 5, execute() gọi tracker và một ticket được tạo bên ngoài storage trong khi chưa có kết quả nào được commit. Bước 6, process bị kill; ticket vẫn tồn tại và storage không đổi. Một khung nét đứt quanh bước 5 và 6 đánh dấu cửa sổ mơ hồ: tác động đã tồn tại, nhưng không có kết quả nào được commit. Sau khi khởi động lại, bước 7 mở lại storage và nạp lại trạng thái đến intent, bước 8 áp dụng quy tắc khôi phục (replay safe chạy lại và có thể tạo ticket thứ hai trừ khi lời gọi có key; mặc định commit một kết quả lỗi interrupted), và bước 9 tiếp tục từ trạng thái đã khôi phục.](../images/durable-boundaries.svg)

**Ranh giới durability nội bộ** (màu xanh) chỉ chứa những gì đã được commit vào storage được cấu hình. **Ranh giới side effect bên ngoài** (màu đỏ) chứa mọi thứ tool đã làm với thế giới bên ngoài. Chúng là hai hệ thống không có transaction chung, nên một crash có thể rơi vào giữa chúng. Ở bước 6, tracker giữ một ticket mà storage không hề biết: intent nói "sắp gọi", và kết quả vắng mặt nói "không rõ", nhưng không có gì nói "nó đã xảy ra". Vì vậy khôi phục không thể dựng lại sự thật, chỉ có thể áp dụng một policy, và chính policy là nơi các kết quả rẽ nhánh. Mục 6.5 kiểm thử cả hai nhánh.

### Điều này không cho bạn

<div class="callout documented">

<span class="label documented">Tài liệu</span> README, ở phần về tool gọi tool, nói thẳng: "a replay-safe tool with external effects still needs its own idempotency" (một tool replay-safe có tác động bên ngoài vẫn cần idempotency của riêng nó). Durable execution không phải là thực thi exactly-once đối với thế giới bên ngoài.

</div>

Hãy xét cửa sổ mơ hồ trong sơ đồ trên: `open_ticket` đã gọi tracker, tracker đã tạo ticket, và process chết trước khi kết quả được commit. Harness không thể biết. Với policy mặc định nó sẽ không chạy lại lời gọi, và model được báo rằng lời gọi "was interrupted and may have partially run" (bị gián đoạn và có thể đã chạy một phần). Những lựa chọn trung thực sau đó thuộc về ứng dụng:

- **Mở pull request.** Tra cứu một PR đang mở cho branch trước khi tạo mới. Một tên branch xác định là một idempotency key tự nhiên.
- **Gửi email.** Truyền một message ID mà provider khử trùng lặp, hoặc ghi log "ý định gửi" kèm một key và kiểm tra provider trước khi retry.
- **Cập nhật database.** Biến thao tác ghi thành upsert theo khóa của request, không phải phép tăng.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Cờ `replay` là dòng quan trọng nhất mà tác giả tool viết ra. "Safe" phải có nghĩa là *chạy lại cái này không thể gây hại*, không phải "cái này thường chạy được". Đọc dữ liệu là safe. Bất cứ thứ gì tính tiền, gửi đi hoặc tạo mới thì không, cho đến khi nó mang một idempotency key.

</div>

![Sơ đồ tuần tự của crash và khôi phục. Process A commit input, một checkpoint, kết quả của search_logs và intent của open_ticket, rồi bị kill trong lúc chạy open_ticket. Process B mở lại storage, resume, giữ kết quả search_logs đã commit, không chạy lại open_ticket, commit một kết quả lỗi interrupted, và model đưa ra câu trả lời cuối.](../images/durable-recovery-sequence.svg)

## 6. Thực hành: một durable agent sống sót qua `kill -9`

Toàn bộ mã ở đây đã chạy với các phiên bản nêu trên. Faux provider đóng vai model, nên phép thử có tính xác định và không cần API key. Hướng dẫn dùng `SIGKILL` thật, không phải một lỗi giả lập.

### 6.1 Thiết lập

```bash
mkdir pi-durable-demo && cd pi-durable-demo
npm init -y && npm pkg set type=module
npm install @earendil-works/pi-durable @earendil-works/pi-ai @earendil-works/chord
npm install -D typescript @types/node
```

Package khai báo Node 22.19 trở lên. Tôi chạy Node 26, có thể chạy trực tiếp file `.ts` (type stripping), nên demo không cần bước build. Với model thật, bạn sẽ thay faux provider bằng một provider như `openaiProvider()` từ `@earendil-works/pi-ai/providers/openai`, đọc `OPENAI_API_KEY` ([README, Quick Start](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md)). Storage được khởi tạo bằng cách mở một file SQLite; file được tạo ở lần dùng đầu tiên.

Ví dụ gồm bảy file trong `src/`: `agent.ts`, `worker.ts` và `demo.ts` (mục 6.2 đến 6.4), rồi `tracker.ts`, `agent-tracker.ts`, `worker-tracker.ts` và `demo-tracker.ts` (mục 6.5). Tất cả đều được liệt kê đầy đủ bên dưới, vì không có repository nào để dẫn liên kết.

### 6.2 Tool, model và harness

`src/agent.ts` định nghĩa hai tool. `search_logs` chỉ đọc, nên nó là `replay: "safe"`. `open_ticket` có tác động bên ngoài, nên giữ mặc định. Cả hai đều ghi thêm vào một file ledger để chúng ta đếm được số lần thực thi thật giữa các process. Ở chế độ crash, `open_ticket` tự kill process của chính nó sau khi ghi vào ledger.

```ts
import { appendFile } from "node:fs/promises";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, defineExtension, defineTool, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

export const context = BACKGROUND_CONTEXT;

export async function ledger(file: string, line: string) {
	await appendFile(file, `${line}\n`);
}

export function createAgent(ledgerFile: string, crashInTicketTool: boolean) {
	const searchLogs = defineTool({
		name: "search_logs",
		description: "Search the service logs for a pattern",
		parameters: Type.Object({ pattern: Type.String() }),
		replay: "safe",
		execute: async (args) => {
			await ledger(ledgerFile, `search_logs ${args.pattern}`);
			return { output: [{ type: "text", text: "3 matches: NullPointerException in OrderService.java:42" }] };
		},
	});

	const openTicket = defineTool({
		name: "open_ticket",
		description: "Open a ticket in the issue tracker",
		parameters: Type.Object({ title: Type.String() }),
		execute: async (args) => {
			await ledger(ledgerFile, `open_ticket ${args.title}`);
			if (crashInTicketTool) process.kill(process.pid, "SIGKILL"); // no cleanup, no close()
			return { output: [{ type: "text", text: "Opened TICKET-1" }] };
		},
	});

	const registry = createRegistry();
	registry.install(defineExtension({ name: "triage", tools: [searchLogs, openTicket] }));

	// A scripted model that decides from the transcript, so every process behaves the same.
	const faux = fauxProvider();
	const call = (name: string, args: Record<string, string>, id: string) =>
		fauxAssistantMessage([fauxToolCall(name, args, { id })], { stopReason: "toolUse" });
	faux.setResponses(
		Array.from({ length: 10 }, () => (ctx) => {
			const last = ctx.messages[ctx.messages.length - 1];
			if (last.role === "toolResult" && last.toolName === "open_ticket") {
				return fauxAssistantMessage([
					fauxText(last.isError ? "The ticket call was interrupted; check the tracker before retrying." : "Ticket opened."),
				]);
			}
			if (last.role === "toolResult" && last.toolName === "search_logs") {
				return call("open_ticket", { title: "NPE in OrderService" }, "t1");
			}
			return call("search_logs", { pattern: "NullPointerException" }, "s1");
		}),
	);
	const models = createModels();
	models.setProvider(faux.provider);
	return { models, registry };
}

export async function openHarness(dbFile: string, ledgerFile: string, crash: boolean) {
	const { models, registry } = createAgent(ledgerFile, crash);
	const harness = await Harness.open(await openNodeSqliteStorage(dbFile), { models, registry }, context);
	const root = await harness.root(context, { agent: { model: { provider: "faux", modelId: "faux-1" } } });
	return { harness, root };
}
```

**Liên quan đến production:** `defineTool` cùng cờ `replay` của nó, `createRegistry` và `defineExtension`, `Harness.open` với một storage bền, và `root.submit` với `requestId`. **Chỉ là giàn giáo cho test:** file ledger, lệnh `process.kill` bên trong tool, và faux provider với các phản hồi được kịch bản hóa.

Các tùy chọn làm gì: `Harness.open(storage, { models, registry }, context)` mở một storage và gắn model registry cùng các extension của bạn. `harness.root()` trả về root conversation, tạo nó ở lần dùng đầu với các lựa chọn agent đã cho. Mọi lời gọi async đều nhận một `Context` của Chord mang theo việc hủy; `BACKGROUND_CONTEXT` không bao giờ hủy, và hủy một lần wait chỉ hủy lần wait đó, không bao giờ hủy công việc.

### 6.3 Gửi một task

`src/worker.ts` là process mà chúng ta sẽ kill. Nó submit kèm `requestId`, tiếp tục mọi công việc chưa xong và chờ.

```ts
import { context, openHarness } from "./agent.ts";

const [dbFile, ledgerFile, mode] = process.argv.slice(2);
const { harness, root } = await openHarness(dbFile, ledgerFile, mode === "crash");

const submission = await root.submit(
	{ type: "input", content: "Investigate the order failures.", requestId: "investigate-1" },
	context,
);
harness.resume(); // continue anything the previous process left unfinished
const settled = await submission.wait(context);
console.log(JSON.stringify({ submission: submission.id, status: settled.status }));
await harness.close(context);
```

`submit()` ghi nhận bền input và trả về một `Submission`; `wait()` resolve thành `done` hoặc `unanswered`. Lượt generation và hai tool call là các task, và các entry của chúng xuất hiện trong transcript khi chúng được commit.

### 6.4 Crash, khởi động lại, kiểm tra

`src/demo.ts` là phép thử có kiểm soát. Process 1 chạy ở chế độ crash và phải chết bằng `SIGKILL`. Process 2 chạy bình thường trên cùng file SQLite. Sau đó demo assert trên ledger và trên transcript.

```ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import { ToolResultEntry } from "@earendil-works/pi-durable";
import { context, openHarness } from "./agent.ts";

const dir = await mkdtemp(join(tmpdir(), "pi-durable-demo-"));
const db = join(dir, "agent.sqlite");
const ledgerFile = join(dir, "ledger.txt");
const run = (mode: string) =>
	spawnSync(process.execPath, ["src/worker.ts", db, ledgerFile, mode], { encoding: "utf8" });

const first = run("crash"); // 1. dies with SIGKILL inside open_ticket
console.log("process 1 signal:", first.signal);
assert.equal(first.signal, "SIGKILL");

const second = run("normal"); // 2. reopens the same file and resumes
console.log("process 2 output:", second.stdout.trim());
assert.equal(second.status, 0, second.stderr);
assert.equal(JSON.parse(second.stdout).status, "done");

const lines = (await readFile(ledgerFile, "utf8")).trim().split("\n"); // 3. verify
console.log("ledger:", lines);
assert.equal(lines.filter((l) => l.startsWith("open_ticket")).length, 1, "ticket tool must not rerun");
assert.equal(lines.filter((l) => l.startsWith("search_logs")).length, 1, "search_logs finished before the crash");

const { harness, root } = await openHarness(db, ledgerFile, false);
const page = await root.entries({}, 50, undefined, context);
const results = [...page.items].reverse().filter(ToolResultEntry.is).map((e) => e.model![0] as ToolResultMessage);
for (const r of results) console.log(r.toolName, "isError:", r.isError, JSON.stringify(r.content));
assert.equal(results.find((r) => r.toolName === "search_logs")?.isError, false);
assert.equal(results.find((r) => r.toolName === "open_ticket")?.isError, true);
await harness.close(context);
console.log("OK");
```

Chạy bằng `node src/demo.ts`. Output từ lần chạy của tôi:

```text
process 1 signal: SIGKILL
process 2 output: {"submission":8,"status":"done"}
ledger: [
  'search_logs NullPointerException',
  'open_ticket NPE in OrderService'
]
search_logs isError: false [{"type":"text","text":"3 matches: NullPointerException in OrderService.java:42"}]
open_ticket isError: true [{"type":"text","text":"<harness>\n[error] Tool open_ticket was interrupted and may have partially run\n</harness>"}]
OK
```

<div class="callout verified">

<span class="label verified">Đã kiểm chứng</span> `tsc --strict` pass trên cả bảy file ví dụ, và các assertion của cả hai demo đều đúng trong các lần chạy của tôi.

</div>

### 6.5 Kịch bản thứ hai: tác động xảy ra, kết quả thì không

Ledger của demo đầu tiên chỉ đếm số lần thử. Demo này thay nó bằng một tracker giả lập lưu ticket thật trong một file bên ngoài storage của agent, để có thể kiểm tra cả hai phía của ranh giới sau crash. Nó chạy cùng một crash ba lần, chỉ đổi cách khai báo `open_ticket`:

- **default:** không có cờ `replay`.
- **safe, no key:** `replay: "safe"`, lời gọi tracker không có idempotency key.
- **safe, keyed:** `replay: "safe"`, lời gọi tracker có key `ticket:<title>`.

`src/tracker.ts` là hệ thống bên ngoài. Nó chỉ là giàn giáo cho test; việc khử trùng lặp theo `key` đại diện cho điều idempotency key của một provider thật làm.

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type Ticket = { id: string; title: string; key?: string };

const read = (file: string): Ticket[] => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);

export function listTickets(file: string): Ticket[] {
	return read(file);
}

// With an idempotency key the tracker deduplicates, like a real provider would. Without one it cannot.
export function createTicket(file: string, title: string, key?: string): Ticket {
	const tickets = read(file);
	const existing = key === undefined ? undefined : tickets.find((t) => t.key === key);
	if (existing) return existing;
	const ticket: Ticket = { id: `TICKET-${tickets.length + 1}`, title, key };
	writeFileSync(file, JSON.stringify([...tickets, ticket]));
	return ticket;
}
```

`src/agent-tracker.ts` chứa tool. Hai dòng quan trọng được đánh dấu: tác động bên ngoài, rồi crash trước khi kết quả kịp được commit.

```ts
import { Type } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, defineExtension, defineTool, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { context } from "./agent.ts";
import { createTicket } from "./tracker.ts";

export type Policy = "default" | "safe-naive" | "safe-keyed";

export async function openHarness(dbFile: string, trackerFile: string, policy: Policy, crash: boolean) {
	const openTicket = defineTool({
		name: "open_ticket",
		description: "Open a ticket in the issue tracker",
		parameters: Type.Object({ title: Type.String() }),
		...(policy === "default" ? {} : { replay: "safe" as const }),
		execute: async (args) => {
			const key = policy === "safe-keyed" ? `ticket:${args.title}` : undefined;
			const ticket = createTicket(trackerFile, args.title, key); // 1. the external effect happens
			if (crash) process.kill(process.pid, "SIGKILL"); // 2. the process dies before the result is committed
			return { output: [{ type: "text", text: `Opened ${ticket.id}` }] };
		},
	});
	const registry = createRegistry();
	registry.install(defineExtension({ name: "tracker", tools: [openTicket] }));

	const faux = fauxProvider();
	faux.setResponses(
		Array.from({ length: 10 }, () => (ctx) => {
			const last = ctx.messages[ctx.messages.length - 1];
			if (last.role === "toolResult") {
				return fauxAssistantMessage([fauxText(last.isError ? "The ticket call was interrupted." : "Ticket opened.")]);
			}
			return fauxAssistantMessage([fauxToolCall("open_ticket", { title: "NPE in OrderService" }, { id: "t1" })], {
				stopReason: "toolUse",
			});
		}),
	);
	const models = createModels();
	models.setProvider(faux.provider);
	const harness = await Harness.open(await openNodeSqliteStorage(dbFile), { models, registry }, context);
	const root = await harness.root(context, { agent: { model: { provider: "faux", modelId: "faux-1" } } });
	return { harness, root };
}
```

`src/worker-tracker.ts` là `worker.ts` với policy là một tham số thêm:

```ts
import { context } from "./agent.ts";
import { openHarness, type Policy } from "./agent-tracker.ts";

const [dbFile, trackerFile, policy, mode] = process.argv.slice(2);
const { harness, root } = await openHarness(dbFile, trackerFile, policy as Policy, mode === "crash");
const submission = await root.submit({ type: "input", content: "Open a ticket for the NPE.", requestId: "ticket-1" }, context);
harness.resume();
const settled = await submission.wait(context);
console.log(JSON.stringify({ status: settled.status }));
await harness.close(context);
```

`src/demo-tracker.ts` chạy từng biến thể trong hai process thật (crash, rồi khôi phục), đọc tracker và transcript, và assert trên cả hai:

```ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import { ToolResultEntry } from "@earendil-works/pi-durable";
import { context } from "./agent.ts";
import { openHarness, type Policy } from "./agent-tracker.ts";
import { listTickets } from "./tracker.ts";

// Crash after the tracker created the ticket but before the tool result is committed; restart; inspect both sides.
async function scenario(policy: Policy) {
	const dir = await mkdtemp(join(tmpdir(), "pi-durable-tracker-"));
	const db = join(dir, "agent.sqlite");
	const tracker = join(dir, "tracker.json");
	const run = (mode: string) => spawnSync(process.execPath, ["src/worker-tracker.ts", db, tracker, policy, mode], { encoding: "utf8" });

	const first = run("crash");
	assert.equal(first.signal, "SIGKILL");
	const afterCrash = listTickets(tracker).length;

	const second = run("normal"); // the recovery process runs the same tool with crash disabled
	assert.equal(second.status, 0, second.stderr);
	assert.equal(JSON.parse(second.stdout).status, "done");

	const { harness, root } = await openHarness(db, tracker, policy, false);
	const page = await root.entries({}, 50, undefined, context);
	const result = [...page.items].reverse().filter(ToolResultEntry.is).map((e) => e.model![0] as ToolResultMessage)[0];
	await harness.close(context);
	return { afterCrash, tickets: listTickets(tracker), result };
}

const out: Record<string, Awaited<ReturnType<typeof scenario>>> = {};
for (const policy of ["default", "safe-naive", "safe-keyed"] as const) {
	out[policy] = await scenario(policy);
	const o = out[policy];
	console.log(policy, "| tickets in tracker after crash:", o.afterCrash, "| after recovery:", o.tickets.length, "| tool result isError:", o.result.isError, JSON.stringify(o.result.content));
}

// A. Default policy: the ticket exists externally, the harness does not rerun, and its record says "interrupted", not "created".
assert.equal(out.default.afterCrash, 1);
assert.equal(out.default.tickets.length, 1, "default policy must not rerun the tool");
assert.equal(out.default.result.isError, true);
assert.ok(!JSON.stringify(out.default.result.content).includes("TICKET-1"), "internal state never learned the ticket id");

// B. replay: "safe" without a key: the tool reruns and the tracker holds a duplicate.
assert.equal(out["safe-naive"].tickets.length, 2, "safe replay with no idempotency key duplicates the effect");
assert.equal(out["safe-naive"].result.isError, false);

// C. replay: "safe" with a key: the tool reruns, the tracker deduplicates, and the committed result carries the id.
assert.equal(out["safe-keyed"].tickets.length, 1);
assert.equal(out["safe-keyed"].result.isError, false);
assert.ok(JSON.stringify(out["safe-keyed"].result.content).includes("TICKET-1"));
console.log("OK");
```

Chạy bằng `node src/demo-tracker.ts`. Output từ lần chạy của tôi:

```text
default | tickets in tracker after crash: 1 | after recovery: 1 | tool result isError: true [{"type":"text","text":"<harness>\n[error] Tool open_ticket was interrupted and may have partially run\n</harness>"}]
safe-naive | tickets in tracker after crash: 1 | after recovery: 2 | tool result isError: false [{"type":"text","text":"Opened TICKET-2"}]
safe-keyed | tickets in tracker after crash: 1 | after recovery: 1 | tool result isError: false [{"type":"text","text":"Opened TICKET-1"}]
OK
```

| Khai báo | Ticket sau crash | Ticket sau khôi phục | Kết quả tool đã commit |
|---|---|---|---|
| default | 1 | 1 | lỗi `interrupted` |
| `replay: "safe"`, no key | 1 | **2** | `Opened TICKET-2` |
| `replay: "safe"`, keyed | 1 | 1 | `Opened TICKET-1` |

<div class="callout verified">

<span class="label verified">Đã kiểm chứng</span> Trên 1.3.0, với một tracker giả lập: ticket đầu tiên tồn tại sau mọi crash; policy mặc định không chạy lại tool và commit một lỗi `interrupted` không hề nhắc đến ticket; một tool replay-safe được chạy lại, và không có key thì tracker kết thúc với một ticket trùng. Storage và tracker không khớp nhau ở dòng đầu (có một ticket tồn tại, transcript không nói vậy) và ở dòng thứ hai (transcript nêu `TICKET-2`, còn `TICKET-1` bị bỏ mồ côi).

</div>

Rút ra điều gì:

- **Cả default lẫn safe đều không khôi phục được sự thật.** Default báo sự mơ hồ một cách trung thực và để việc đối soát cho ứng dụng. `replay: "safe"` giải quyết nó bằng cách đoán rằng chạy lại là vô hại, điều chỉ đúng khi tác động đó là idempotent.
- **Dòng keyed là công của tác giả tool.** Chỉ có một ticket vì tool đã gửi một key và dịch vụ đã khử trùng lặp theo nó. Pi Durable không làm gì ở đây, và README cũng nói vậy: một tool replay-safe có tác động bên ngoài vẫn cần idempotency của riêng nó.
- <span class="label proposal">Đề xuất</span> Với dòng default, một bước đối soát nên nằm trong ứng dụng: trước khi retry, hãy tra ticket theo key của nó trong tracker. Tôi chưa cài đặt hay kiểm thử điều này ở đây.

### 6.6 Phép thử này chứng minh gì và không chứng minh gì

Gộp lại, hai demo cho thấy, trên phiên bản đã thử và với các kịch bản này:

- Trạng thái đã commit sống sót qua `SIGKILL`: kết quả `search_logs` và transcript còn nguyên sau khi mở lại.
- Tool chỉ đọc đã hoàn tất chạy một lần, không phải hai.
- Tool không replay-safe đang chạy dở không bị chạy lại. Ledger cho thấy `open_ticket` chỉ bắt đầu một lần, và model được báo rằng lời gọi bị gián đoạn. Điều đó không nói gì về việc ticket có tồn tại hay không; mục 6.5 bổ sung một tracker cho biết điều đó.
- Lượt chạy đạt trạng thái `done` ở process thứ hai.
- Với một tracker có trạng thái sống sót qua crash, policy mặc định để ticket tồn tại bên ngoài trong khi transcript đã commit chỉ ghi `interrupted`; `replay: "safe"` chạy lại tool và nhân đôi ticket trừ khi tracker khử trùng lặp theo key (mục 6.5).

Nó **không** cho thấy:

- Rằng harness biết kết quả của `open_ticket`. Nó không biết: sau khôi phục với policy mặc định, storage chỉ có một lỗi `interrupted` và không gì khác, và chỉ tracker biết ticket có tồn tại hay không.
- Hành vi exactly-once dưới bất kỳ hình thức nào. Biến thể keyed tạo ra một ticket vì *tracker giả lập của tôi khử trùng lặp*; đó là thuộc tính của tool và dịch vụ, không phải của Pi Durable.
- Tích hợp với một tracker thật. Bản giả lập chỉ là một file JSON. Timeout, phản hồi dở dang, và một tracker tạm thời không khả dụng đều không được mô phỏng.
- Hành vi dưới tình huống mất điện. SQLite ở chế độ WAL với `synchronous = NORMAL` có thể mất commit mới nhất khi mất điện ([README](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md)); `SIGKILL` một process là một sự cố nhẹ nhàng hơn.
- Hành vi của model thật. Faux provider được kịch bản hóa. Một model thật có thể phản ứng với kết quả interrupted bằng cách thử gọi lại, hỏi một con người, hoặc bỏ cuộc. Tôi chưa thử điều đó.
- Một model request được gửi lại. Thông báo có mô tả nó; tôi kill process bên trong một tool, chưa bao giờ giữa lúc generation.
- Các crash ở điểm khác. Mọi phép thử đều kill process bên trong `execute()`, sau commit của intent. Một crash giữa lúc tool trả về và lúc commit kết quả có cùng hình dạng nhưng tôi chưa chèn nó riêng.
- Tính đồng thời, nhiều client, compaction hay việc host trên Cloudflare.

## 7. Vượt ra ngoài một conversation

<div class="callout documented">

<span class="label documented">Tài liệu</span> Package hỗ trợ trực tiếp những điều sau:

- **Nhiều conversation trên một harness.** Một harness chạy song song nhiều conversation, mỗi cái có agent được lưu riêng: model, mức thinking, extension, tool, instruction, thư mục làm việc. Một conversation reviewer có thể dùng model rẻ hơn và các tool chỉ đọc.
- **Fork.** Một conversation có thể fork từ bất kỳ điểm nào trong transcript của conversation khác mà không sao chép lịch sử. Ví dụ trong thông báo là một Slack thread được fork từ một tin nhắn trong channel.
- **Nhiều client.** Số lượng client bất kỳ có thể gắn vào một conversation, nhận một view hiện tại rồi các cập nhật tăng dần, và có thể lái một conversation đang chạy hoặc xếp hàng các follow-up.
- **Subagent** được xây từ các tool tạo ra một conversation do nó sở hữu. Thông báo nêu rằng không có subagent dựng sẵn.
- **Environment theo từng conversation.** Một hàm `env` chọn nơi các tool của mỗi conversation chạy: một laptop, một VM từ xa, một sandbox trong bộ nhớ.

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Một số pattern suy ra được từ các mảnh ghép đó nhưng không có sẵn:

- Một cổng phê duyệt con người cho tool deploy: một hook `beforeTool` chặn lại, với quyết định phê duyệt được lưu qua `api.memo` để crash không khiến hỏi hai lần. Thông báo có một ví dụ cổng phê duyệt theo hướng này; giao diện phê duyệt xung quanh thì bạn tự xây.
- Một dịch vụ triage trong đó mỗi issue đến là một conversation và một worker khởi động lại tự do phía sau một hàng đợi.

</div>

Những gì *không* được dựng sẵn, theo như README và thông báo: phân quyền nhiều người dùng, cô lập tenant và điều phối phân tán giữa các process. Một process sở hữu một storage, và các client khác gắn vào qua process đó. Nếu bạn cần nhiều worker, bạn tự phân chia các conversation giữa các storage.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Với Cloudflare, [tài liệu Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/) mô tả `PiHarness`, lưu các bảng của Pi trong cơ sở dữ liệu SQLite của một Durable Object và dùng một heartbeat job (mỗi 30 giây) để khởi động lại một object bị evict, để Pi có thể tiếp tục. Trang đó đánh dấu `PiHarness` là beta và liệt kê các giới hạn của chính nó, ví dụ chưa có bước phê duyệt cho tool call, event stream không thể tiếp tục từ một cursor, và các lần gọi alarm bị giới hạn 15 phút.

</div>

## 8. Cân nhắc khi đưa vào production

Với mỗi mục: package cho bạn gì, và phần nào vẫn là của bạn.

**API thử nghiệm và việc đánh phiên bản.** *Package:* một changelog đi kèm trong package npm. *Bạn:* ghim chính xác phiên bản, đọc changelog mỗi lần nâng cấp, và giữ một bài test crash đầu cuối (như mục 6) trong CI để một thay đổi hành vi hiện ra thành một build đỏ. README nêu rằng API thay đổi mà không báo trước.

**Độ bền của storage.** *Package:* atomic commit và một policy xác định cho từng backend; một lỗi storage kết thúc harness, và "commits are atomic, so the store is consistent" (commit là nguyên tử, nên store nhất quán) khi mở lại ([README, Errors](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md)). Harness không retry gì cả; một storage tùy biến tự retry các lỗi tạm thời của nó. *Bạn:* chọn `fsync` hoặc tương đương nếu không chấp nhận mất commit mới nhất, sao lưu file, và quyết định làm gì khi chính đĩa không khả dụng hoặc bị hỏng. Package không tuyên bố sẽ sửa chuyện đó.

**Replay của tool và idempotency.** *Package:* intent được ghi trước khi thực thi, cờ `replay`, `requestId` cho submission, `memo` cho quyết định của hook. *Bạn:* idempotency key cho mọi tác động bên ngoài, và đối soát cho trường hợp "may have partially run".

**Ngữ cảnh của model.** *Package:* compaction chạy như một task nền, với các bản tóm tắt ở ranh giới lượt; nếu provider từ chối một request vì quá dài thì harness compact và retry một lần. Các tin nhắn cũ vẫn nằm trong storage. *Bạn:* lịch sử được lưu không có nghĩa là nó vừa cửa sổ ngữ cảnh. Chọn cài đặt compaction (`reserveTokens` và các override theo model) và quyết định một ghi chú bàn giao nên giữ lại những gì.

**Khả năng quan sát.** *Package:* `onReport` cho các lỗi được báo, `harness.inspect()` và một view đồ thị task, document chi phí và usage, `watch()` cho các commit chính xác và `watchEvents()` cho các event kiểu coding-agent. *Bạn:* đẩy chúng vào log và metric của bạn, cảnh báo với các task bị parked (đạt `restartLimit`), và để mắt tới các task bị kẹt.

**Bảo mật.** *Package:* bộ tool và environment theo từng conversation, `callers` để quyết định ai được gọi một tool, các hook chặn hoặc viết lại call. *Bạn:* API key trong biến môi trường hoặc một secret manager, quyền file trên file SQLite (nó chứa toàn bộ hội thoại và output của tool), che dữ liệu nhạy cảm trong các hook `afterTool`, và cô lập tenant. Tôi không tìm thấy cô lập tenant trong tài liệu, nên hãy giả định đó là việc của bạn.

**Độ tin cậy vận hành.** *Package:* giới hạn vòng lặp crash, `retryTask`, `harness.closed` để host có thể mở lại khi lỗi. *Bạn:* bộ giám sát khởi động lại, sao lưu, các buổi diễn tập khôi phục định kỳ, và một runbook cho các task vẫn bị parked.

## 9. Khi nào nên dùng

| Trường hợp sử dụng | Workflow agent thông thường | Workflow durable agent |
|---|---|---|
| Phiên coding tương tác tại terminal | Phù hợp. Mất một phiên chỉ tốn vài phút. | Chi phí bạn không cần |
| Tác vụ nghiên cứu hay migration qua đêm | Crash nghĩa là chạy lại từ đầu | Tiếp tục từ checkpoint cuối; chi phí không bị trả lại |
| Bot backend phục vụ một nhóm | Trạng thái theo từng process; khởi động lại làm mất công việc đang chạy | Phù hợp tự nhiên: storage là nguồn sự thật |
| Workflow có tool đắt đỏ hoặc không đảo ngược được | Retry tùy hứng | Replay policy buộc bạn quyết định theo từng tool |
| Hỏi đáp ngắn, không trạng thái | Ổn | Không cần thiết |

Các tiêu chí quyết định thực sự quan trọng: một lượt chạy kéo dài bao lâu, mất công việc trung gian tốn bao nhiêu (bằng tiền hay bằng side effect), process của bạn bị gián đoạn thường xuyên đến đâu, có cần nhiều người cùng gắn vào một agent hay không, và bạn có kham nổi bề mặt vận hành hay không (storage, sao lưu, một bộ giám sát khởi động lại).

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Durability không miễn phí và cũng không phải lúc nào cũng tốt hơn. Nó thêm một phụ thuộc vào storage, một kỷ luật replay bạn phải áp dụng cho từng tool, và một API thử nghiệm. Nếu một lượt chạy mất đi chỉ tốn hai phút, đừng trả giá cho nó.

</div>

## 10. Kết luận

- Các agent chạy lâu cần nhiều hơn lịch sử hội thoại. Chúng cần biết điều gì đã commit, điều gì đang chạy dở, và điều gì có thể bị lặp lại.
- Pi Durable làm điều đó tường minh: mỗi bước là một task có checkpoint, mỗi thay đổi là một atomic commit, và mỗi tool khai báo việc chạy lại nó có an toàn hay không.
- Nó không cho thực thi exactly-once đối với các tác động bên ngoài. Kết quả `interrupted` là harness đang nói với bạn rằng kết cục là mơ hồ, và bạn là người giải quyết nó.
- Khôi phục là một hành vi để kiểm thử, không phải để giả định. Demo ở trên là loại phép thử tôi sẽ giữ trong CI.
- Hãy bắt đầu với một bản proof of concept nhỏ, và thận trọng trước khi hướng một package thử nghiệm vào các workflow quan trọng.

*Bạn sẽ xây gì nếu các agent của bạn có thể tiếp tục công việc một cách đáng tin cậy sau sự cố?*

## Tài liệu tham khảo

Mọi thứ dưới đây đều được tham khảo khi viết. Các nhận định từ chúng được dẫn liên kết ngay gần văn bản.

- Earendil, [Thông báo Pi Durable](https://earendil.com/posts/pi-durable/).
- [README của `@earendil-works/pi-durable`](https://github.com/joyanes97/pi-coding-agent/blob/main/packages/durable/README.md) (cũng được đóng gói trong package npm, phiên bản 1.3.0).
- Cloudflare, [Pi harness trên Cloudflare Agents](https://developers.cloudflare.com/agents/harnesses/pi/).
- Các package npm `@earendil-works/pi-durable`, `@earendil-works/pi-ai` và `@earendil-works/chord`, phiên bản 1.3.0, mà tôi đã đọc file type definition để viết ví dụ.
- Ví dụ `13-recovery.ts` của repository, cho thấy pattern `memo` và mở lại rồi tiếp tục.
