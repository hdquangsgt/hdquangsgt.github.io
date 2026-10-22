---
title: 'Hiểu về Thinking Effort trong AI Agent: Điều lập trình viên cần biết'
description: 'Hướng dẫn dạng slide về reasoning effort dành cho lập trình viên dùng LLM API và coding agent: thiết lập này thay đổi điều gì, khác gì với agent loop, khi nào tăng effort có ích và cách đo lường thay vì đoán mò.'
pubDate: 2026-10-22T09:00:00+07:00
category: AI Agents
tags: [thinking-effort, reasoning, ai-agents, evaluation, llm-api]
featured: false
draft: false
slides: true
---

## Hiểu về Thinking Effort trong AI Agent

<p class="slide-kicker">Phần I · Thử thách những giả định phổ biến</p>

**Vì sao bảo AI "nghĩ kỹ hơn" không phải lúc nào cũng cho kết quả tốt hơn.**

Một thiết lập thinking effort thực sự thay đổi điều gì, và khi nào bạn nên tăng nó? Bộ slide này đi theo câu hỏi đó qua 18 slide: khái niệm, sự khác biệt giữa reasoning và việc thực thi của agent, các tình huống kỹ thuật thực tế, và cách quyết định dựa trên bằng chứng thay vì trực giác.

![Một agent ở bên trái đưa một task đi qua ba làn. Làn trên là đường đi thẳng ngắn tới một câu trả lời nhanh. Làn giữa cân nhắc một phương án thay thế rồi bỏ nó. Làn dưới là đường đậm với nhiều nhánh, hai ngõ cụt và một bước kiểm chứng trước khi ra kết quả đã được kiểm chứng.](../images/effort-cover-paths.svg "Một task, ba mức reasoning effort. Hình minh họa khái niệm, không phải số đo.")

<div class="callout article-only">

**Cách đọc bài này.** Các nhận định đi kèm nhãn: <span class="label documented">Tài liệu</span> lấy từ tài liệu chính thức được liên kết ngay bên cạnh, <span class="label opinion">Quan điểm</span> là cách diễn giải của tôi, và <span class="label proposal">Đề xuất</span> là kiến trúc tôi khuyên dùng, không phải thứ nhà cung cấp nào phát hành. Các sơ đồ mang tính khái niệm trừ khi chú thích nói khác. Thông tin API được đối chiếu với tài liệu của nhà cung cấp ngày 22 tháng 10 năm 2026; tên model và giá trị được chấp nhận thay đổi thường xuyên, nên hãy kiểm tra các trang được liên kết trước khi sao chép.

</div>

## Cùng model. Cùng prompt. Kết quả khác nhau?

<p class="slide-kicker">Phần I · Thử thách những giả định phổ biến</p>

Bạn chạy hai lần một yêu cầu trông như y hệt nhau, một lần ra câu trả lời gọn gàng, lần sau lại rối. Trước khi đổ lỗi cho một thiết lập, hãy liệt kê mọi thứ đã thay đổi. Có những task chỉ có một lối đi hiển nhiên và được giải trực tiếp. Có những task có nhiều lối đi hợp lý, và câu trả lời tốt hơn khi hệ thống cân nhắc kỹ hơn hoặc thu thập thêm bằng chứng.

![Bên trái: một task đơn giản, đổi tên một config key, đi theo một đường tới build thành công. Bên phải: một task phức tạp, một test chập chờn, rẽ thành ba giả thuyết chưa kiểm chứng cần bằng chứng trước khi xác định nguyên nhân. Bên dưới, sáu ô liệt kê các yếu tố làm thay đổi kết quả, trong đó cấu hình bao gồm effort chỉ là một.](../images/effort-why-results-vary.svg "Task đơn giản có một đường đi. Task phức tạp có nhiều đường, và bằng chứng quyết định chọn đường nào. Effort chỉ là một trong sáu yếu tố.")

- **Độ phức tạp và tính mơ hồ của task** quyết định có bao nhiêu câu trả lời hợp lý.
- **Context có sẵn và đầu ra của tool** quyết định model thực sự có thể biết gì.
- **Tính ngẫu nhiên khi sampling** khiến hai lần chạy cùng một prompt có thể khác nhau.
- **Hành vi model và cấu hình** đều quan trọng, và effort chỉ là một phần của cấu hình.

<div class="takeaway">

Đừng quy một kết quả xấu cho effort trước khi loại trừ thiếu context, kết quả tool yếu và sự dao động thông thường.

</div>

## Thinking effort cao hơn không tự động có nghĩa là thông minh hơn

<p class="slide-kicker">Phần I · Thử thách những giả định phổ biến</p>

Có ba giả định phổ biến, và mỗi cái sai theo một cách hữu ích:

1. **"Effort cao hơn luôn cho câu trả lời tốt hơn."** Nó có thể giúp ở một số task. Nó không đảm bảo tính đúng đắn, và với task dễ thì chủ yếu chỉ tốn thêm chi phí.
2. **"Nghĩ lâu hơn nghĩa là suy luận sâu và chính xác hơn."** Độ dài không phải chất lượng. Một chuỗi suy luận dài vẫn có thể dài mà sai.
3. **"Nhiều bước agent hơn làm agent giỏi hơn."** Nhiều bước hơn có thể cộng dồn lỗi dễ như sửa lỗi.

![Một vấn đề đi vào vùng nét đứt có nhãn suy luận nhiều hơn nghĩa là khám phá rộng hơn, chứa bốn giả thuyết và một bước so sánh rồi loại bớt. Đầu ra là một kết luận không được đảm bảo đúng. Ba ô bên dưới, bằng chứng có sẵn, năng lực của model và ràng buộc của task, cũng đóng góp vào kết luận. Một ghi chú nói thiếu bằng chứng là bức tường mà suy luận thêm cũng không vượt qua được.](../images/effort-reasoning-vs-evidence.svg "Suy luận mở rộng phạm vi tìm kiếm. Kết luận vẫn phụ thuộc vào bằng chứng, năng lực và ràng buộc.")

<div class="callout documented">

<span class="label documented">Tài liệu</span> Hướng dẫn của chính Anthropic về mức effort cao nhất cảnh báo rằng với một số workload nó "thêm chi phí đáng kể cho mức cải thiện chất lượng tương đối nhỏ" và có thể dẫn tới nghĩ quá mức ở các task ít đòi hỏi hơn ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).

</div>

## Thinking effort nói về tài nguyên suy luận, không chỉ là chờ lâu hơn

<p class="slide-kicker">Phần II · Nền tảng kỹ thuật</p>

Thinking effort là một **cơ chế điều khiển riêng của từng model hoặc nền tảng, nếu có,** ảnh hưởng đến lượng nỗ lực dành cho việc suy luận về một task. Đó là một thiết lập trên API công khai. Nó không phải cửa sổ nhìn vào bên trong model.

![Bên trái, đầu vào của API công khai: task và context, cùng một thiết lập effort như từ low đến high. Ở giữa, một vùng nét đứt có nhãn model inference, phần bên trong khác nhau tùy model và không được công bố, với ba ô có dấu hỏi: hành vi suy luận, lượng tính toán, các lựa chọn inference khác. Bên phải, đầu ra công khai: câu trả lời, một bản tóm tắt reasoning tùy chọn không phải vết suy luận thô, và báo cáo usage với số reasoning token bị tính phí.](../images/effort-what-is-it.svg "Thứ bạn đặt và quan sát được là bề mặt API. Điều xảy ra bên trong phụ thuộc vào model và không được thiết lập này quy định.")

<div class="callout documented">

<span class="label documented">Tài liệu</span> Các nhà cung cấp nói gì, bằng lời của chính họ:

- OpenAI: reasoning token được tính phí như output token, được tính vào `max_output_tokens`, và xuất hiện trong `usage.output_tokens_details.reasoning_tokens`. Reasoning thô không được trả về; bản tóm tắt là tùy chọn bật thêm ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)).
- Anthropic: effort là "một tín hiệu hành vi, không phải ngân sách token nghiêm ngặt", và nó ảnh hưởng đến mọi output token, gồm cả văn bản và tool call, không chỉ phần thinking ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).
- Google: `thinking_level` nhận các mức khác nhau tùy model, và bản tóm tắt thought là tùy chọn bật thêm ([Gemini: Thinking](https://ai.google.dev/gemini-api/docs/thinking)).

</div>

Vậy cùng một từ mang nghĩa khác nhau trên các API khác nhau. Đừng giả định mỗi mức tương ứng một số token, số bước hay lượng tính toán cố định.

## Độ phức tạp của task nên ảnh hưởng đến reasoning effort

<p class="slide-kicker">Phần II · Nền tảng kỹ thuật</p>

![Đặt cạnh nhau. Task A, chuyển một object JSON thành TypeScript interface, là ba ô thẳng hàng kết thúc ở khai báo interface. Task B, một race condition thỉnh thoảng xảy ra, bắt đầu từ triệu chứng, rẽ thành các giả thuyết thứ tự lock, cache cũ và retry trùng lặp, gặp nhau ở bằng chứng liên thành phần từ trace, log, thời gian và cách tái hiện, và kết thúc ở nguyên nhân đã thu hẹp. Một ghi chú bên dưới nói độ phức tạp không phải trục duy nhất: một task đơn giản với hậu quả nghiêm trọng vẫn đáng được suy luận cẩn thận.](../images/effort-task-a-vs-b.svg "Task A có một đường đi dễ kiểm tra. Task B có nhiều giả thuyết cần bằng chứng liên thành phần.")

**Task A** chuyển một object JSON thành TypeScript interface. Đầu ra nhìn là kiểm tra được. Cân nhắc thêm hiếm khi thay đổi nó.

**Task B** là một race condition thỉnh thoảng xảy ra trong hệ thống phân tán. Ở đây suy luận có chủ đích có thể đáng giá: so sánh các giả thuyết, cân nhắc trường hợp biên và nối hành vi giữa các thành phần.

Nhưng độ phức tạp không phải trục duy nhất. Một task ngắn với hậu quả nghiêm trọng, như migration dữ liệu production, có thể đáng được suy luận cẩn thận, kiểm tra thêm hoặc con người review, dù nó dễ mô tả.

## Suy luận của model và việc thực thi của agent là hai thứ khác nhau

<p class="slide-kicker">Phần II · Nền tảng kỹ thuật</p>

![Hai khung. A: một lần gọi model với đầu vào, một giai đoạn suy luận bên trong nơi thiết lập effort có tác dụng, và đầu ra, không dùng tool. B: một agent loop bên ngoài model với lần gọi model 1, một tool call chạy test, một quan sát về hai test thất bại, lần gọi model 2 và điều kiện dừng, với mũi tên nét đứt lặp lại vòng cho đến khi dừng.](../images/effort-vs-agent-loop.svg "Bên trái, suy luận bên trong một lần gọi model. Bên phải, một vòng lặp bên ngoài gồm các lần gọi model, tool call và quan sát. Mũi tên nét đứt chuyển động khi hệ thống cho phép.")

**Thinking effort** là phần suy luận được áp dụng trong *một* lần gọi model, khi model và API hỗ trợ cơ chế này.

**Agent loop** là chu trình bên ngoài: model nhận context, tạo ra một phản hồi hoặc một tool call, nhận kết quả tool, và tiếp tục cho đến khi gặp điều kiện dừng ([ReAct](https://arxiv.org/abs/2210.03629) là mô tả kinh điển về việc đan xen suy luận với hành động).

Hai thứ này thay đổi độc lập. Một lần gọi có thể chứa rất nhiều suy luận mà không dùng tool. Một agent có thể thực hiện hàng chục tool call trong khi mỗi bước riêng lẻ đều đơn giản.

## Một AI agent không chỉ là một model

<p class="slide-kicker">Phần II · Nền tảng kỹ thuật</p>

Luồng khái niệm: task và context của người dùng → model suy luận → quyết định trả lời hoặc gọi tool → thực thi tool → context được cập nhật → quyết định tiếp theo. Nó lặp lại cho đến khi task xong hoặc gặp điều kiện dừng.

![Agent loop trong ba lớp nền màu nhạt. Lớp orchestration: 1, task và context; quy tắc dừng; 5, context được cập nhật. Lớp model: 2, suy luận, được nhấn mạnh là nơi duy nhất reasoning effort có tác dụng, và 3, một quyết định giữa trả lời và gọi tool. Lớp thực thi: 4, thực thi tool. Một câu trả lời đi qua điểm kiểm chứng nét đứt nằm vắt ngang các lớp, rồi qua quy tắc dừng, rồi trả về câu trả lời cuối. Một tool call đi tới thực thi tool, kết quả trở thành context được cập nhật, rồi đưa 6, quyết định tiếp theo, trở lại bước suy luận.](../images/effort-agent-flow.svg "Sáu bước trong ba lớp. Chỉ bước 2 chịu ảnh hưởng của reasoning effort. Các mũi tên nét đứt chuyển động là vòng lặp; kiểm chứng là một điểm kiểm tra, không phải một lớp.")

Effort tác động lên một bước của vòng lặp này, phần suy luận bên trong lần gọi model. Hiệu năng tổng thể còn phụ thuộc vào chất lượng context, có những tool nào, cách harness điều phối retry và việc dừng, và liệu có thứ gì kiểm chứng kết quả hay không.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Bài [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) của Anthropic nêu một ý liên quan: hệ thống agentic đánh đổi latency và chi phí để lấy hiệu quả task, nên sự phức tạp thêm vào cần được biện minh.

</div>

## Các mức effort khác nhau là các đánh đổi khác nhau

<p class="slide-kicker">Phần II · Nền tảng kỹ thuật</p>

![Bốn thanh định tính, mỗi thanh từ thấp đến cao, với vòng tròn đánh dấu effort thấp hơn và hình vuông đánh dấu effort cao hơn. Ở task khó, mức cao hơn nằm xa hơn về phía chất lượng tốt hơn. Ở task đơn giản, hai dấu nằm gần nhau. Với latency và chi phí, mức cao hơn nằm xa hơn về phía cao hơn.](../images/effort-low-vs-high.svg "Biểu đồ định tính. Vị trí các dấu chỉ cho thấy xu hướng; không phải kết quả benchmark.")

| | Effort thấp hơn | Effort cao hơn |
| --- | --- | --- |
| Latency | thường thấp hơn | thường cao hơn |
| Chi phí | thường thấp hơn | thường cao hơn |
| Task khó, nhiều bước | có thể kém kỹ lưỡng hơn | có thể kỹ lưỡng hơn |
| Task đơn giản | thường là đủ | lợi ích ít, vẫn tốn hơn |

**Đây là xu hướng, không phải đảm bảo.** Khoảng cách lớn đến đâu phụ thuộc vào model, task và cách đo. Bài này không đưa ra con số cải thiện nào vì không con số nào khái quát được; slide 15 chỉ cách tự tạo số liệu của bạn.

## Khi nào thinking effort cao hơn đáng giá?

<p class="slide-kicker">Phần III · Tình huống kỹ thuật thực tế</p>

Một API thỉnh thoảng trả về HTTP 500. Một model có reasoning effort cao hơn có thể giỏi hơn trong việc giữ nhiều giả thuyết cùng lúc, kiểm tra các dependency và cân nhắc trường hợp biên. Nó vẫn không đọc được log mà không ai thu thập.

![Bên trái: triệu chứng, HTTP 500 thỉnh thoảng xảy ra. Ở giữa: bốn ô giả thuyết nét đứt, cạn pool database, upstream timeout, cache stampede, và một instance chạy bản build cũ. Bên phải: các ô bằng chứng nét liền. Thời gian chờ database bình thường, bác bỏ giả thuyết đầu. Trace upstream thành công, bác bỏ giả thuyết thứ hai. Không có đỉnh cache miss, bác bỏ giả thuyết thứ ba. Log cho thấy 500 chỉ xảy ra trên instance 3, ủng hộ giả thuyết thứ tư. Từ đó dẫn tới bản sửa đã kiểm chứng, rollback instance 3. Một ô cảnh báo riêng nói suy luận không thay thế được bằng chứng không ai thu thập, như log thiếu của instance 5.](../images/effort-incident-evidence.svg "Ô nét đứt là giả thuyết. Ô nét liền là bằng chứng quan sát được. Chỉ bản sửa đã được kiểm chứng mới tính là đã giải quyết.")

Một quy trình tốt xen kẽ suy luận với quan sát:

1. Tạo giả thuyết, và nói rõ bằng chứng nào sẽ xác nhận hoặc bác bỏ từng giả thuyết.
2. Thu thập bằng chứng đó (log, metric, trace).
3. Cập nhật giả thuyết. Bỏ những gì bằng chứng bác bỏ.
4. Áp dụng bản sửa, rồi kiểm chứng triệu chứng đã hết.

<div class="takeaway">

Suy luận nhiều hơn giúp bạn *dùng* bằng chứng. Nó không thể tạo ra bằng chứng chưa từng được thu thập.

</div>

## Một thay đổi một dòng và một đợt refactor toàn hệ thống không cần cùng một chiến lược

<p class="slide-kicker">Phần III · Tình huống kỹ thuật thực tế</p>

![Một phổ từ hẹp và cục bộ đến rộng và không chắc chắn với ba thẻ task. 1: đổi tên biến cục bộ, cần đổi tên theo scope và test không đổi. 2: refactor authentication middleware, với dependency của các nơi gọi, hệ quả bảo mật, tương thích ngược và độ phủ test. 3: điều tra regression sau deploy, với diff code, log và lỗi, kết quả test và các thay đổi gần đây. Một ghi chú nói không có mức effort nào đúng cho mọi loại task.](../images/effort-coding-task-spectrum.svg "Ba task của coding agent trên một phổ minh họa về mức độ ràng buộc, bất định và hệ quả.")

- **Đổi tên một biến cục bộ.** Chủ yếu là cơ học. Trình biên dịch hoặc bộ test là đủ để chốt.
- **Refactor authentication middleware.** Suy luận phải bao quát nơi gọi, hệ quả bảo mật, tương thích ngược và các test chứng minh hành vi được giữ nguyên.
- **Điều tra regression sau khi deploy.** Suy luận chỉ tốt bằng những gì nó đọc được: diff, log, kết quả test và lịch sử thay đổi gần đây.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Hãy coi thứ tự này là giả thuyết khởi đầu, không phải quy tắc. Một lần đổi tên có thể rủi ro trong ngôn ngữ động, và một regression khó có thể cần bằng chứng nhiều hơn là cân nhắc.

</div>

## Chọn đúng cơ chế cho đúng vấn đề

<p class="slide-kicker">Phần III · Tình huống kỹ thuật thực tế</p>

Khi một agent làm sai, "nghĩ kỹ hơn" chỉ là một trong nhiều đòn bẩy, và không phải lúc nào cũng đúng.

![Một cây quyết định. Gốc hỏi điều gì thực sự đã thất bại. Bốn nhánh: phân tích nông dù có đủ dữ kiện dẫn tới tăng reasoning effort. Thiếu dữ kiện không có trong context dẫn tới thêm tool hoặc retrieval. Kế hoạch bị test hoặc log phản bác dẫn tới chạy thêm một vòng lặp với bằng chứng mới. Task quá rộng dẫn tới chia nhỏ với orchestration tốt hơn. Ô dưới cùng nói các can thiệp này bổ trợ nhau, và một ghi chú nói hãy đọc trace và thêm bước kiểm chứng nếu chưa chắc điều gì đã hỏng.](../images/effort-decision-tree.svg "Ánh xạ kiểu thất bại sang can thiệp phù hợp. Các can thiệp kết hợp được; chúng không cạnh tranh nhau.")

- Nếu model chưa cân nhắc các giả thuyết hiện có, **tăng reasoning effort** có thể giúp.
- Nếu nó thiếu thông tin về repository, **một tool tìm kiếm** sẽ giúp nhiều hơn việc nghĩ thêm.
- Nếu một kết quả test phản bác giả thuyết ban đầu, **thêm một vòng lặp agent** với kết quả đó là bước đúng.
- Nếu task quá rộng, **chia nhỏ** giúp nhiều hơn bất kỳ thiết lập đơn lẻ nào.

## Một lời giải thích thuyết phục không phải bằng chứng của tính đúng đắn

<p class="slide-kicker">Phần III · Tình huống kỹ thuật thực tế</p>

Model có thể đưa ra kết luận nghe hợp lý nhưng sai vì thiếu thông tin, giả định sai hoặc các giới hạn khác. Độ trôi chảy của một lời giải thích nói rất ít về việc nó có đúng hay không.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Nghiên cứu về các reasoning model cho thấy phần suy luận được nêu ra thường bỏ sót những yếu tố thực sự ảnh hưởng đến câu trả lời, nên đọc lời giải thích không phải cách kiểm toán đáng tin cậy ([Chen và cộng sự, 2025](https://arxiv.org/abs/2505.05410)).

</div>

![Làn trên: một đề xuất trôi chảy của model đọc rất thuyết phục nhưng không có kiểm tra nào chạy, nên được chấp nhận theo niềm tin với trạng thái không rõ. Làn dưới: đề xuất của model đi qua sáu kiểm tra, test tự động, type check và lint, review diff, log và kết quả chạy, tiêu chí chấp nhận và kiểm tra bảo mật. Kết quả đạt ghi lại bằng chứng. Kết quả không đạt gửi phản hồi về cho model qua mũi tên nét đứt sửa và kiểm tra lại.](../images/effort-verification-flow.svg "Trên: nghe hợp lý nhưng chưa kiểm chứng. Dưới: cùng đề xuất đó được kiểm tra bằng bằng chứng thực thi được, với phản hồi khi thất bại.")

Với coding agent, kiểm chứng nghĩa là các cơ chế cụ thể: test tự động, kiểm tra kiểu và lint, đọc diff được tạo ra, xem log và kết quả thực thi, đối chiếu tiêu chí chấp nhận, và chạy kiểm tra bảo mật khi phù hợp. Hãy đánh giá chất lượng của các kiểm tra đó độc lập với việc phần suy luận trông sâu đến đâu.

## Chất lượng, latency và chi phí

<p class="slide-kicker">Phần IV · Hệ thống production</p>

![Một tam giác với chất lượng ở đỉnh, latency ở góc dưới trái và chi phí ở góc dưới phải. Ba workload minh họa nằm bên trong: autocomplete tương tác nghiêng về latency, một agent migration chạy qua đêm nghiêng về chất lượng, và phân loại khối lượng lớn nghiêng về chi phí. Một ghi chú nói vị trí mang tính khái niệm và không có một chỉ số chung duy nhất.](../images/effort-tradeoff-triangle.svg "Ba chiều kéo nhau. Workload nằm ở đâu là quyết định sản phẩm. Vị trí ở đây mang tính khái niệm.")

- **Chất lượng:** tính đúng, hoàn thành task, độ bền vững và xử lý trường hợp biên.
- **Latency:** thời gian phản hồi, và tổng thời gian hoàn thành một task.
- **Chi phí:** mức dùng model, chi phí inference liên quan đến reasoning nếu có, tool call, và trên hết là *tổng chi phí cho mỗi task thành công*.

Mục tiêu không phải chất lượng tối đa bằng mọi giá, hay latency tối thiểu bằng mọi giá. Đó là một đánh đổi chấp nhận được cho workload và yêu cầu kinh doanh của nó. Ba chiều này không quy được về một điểm số chung.

## Đừng mặc định dùng effort tối đa cho mọi yêu cầu

<p class="slide-kicker">Phần IV · Hệ thống production</p>

Chiến lược thích ứng coi effort là quyết định theo từng task: nhận task, đánh giá độ phức tạp, độ bất định và rủi ro, chọn một thiết lập được hỗ trợ, thực thi, kiểm chứng, và leo thang, thử lại hoặc thu thập thêm bằng chứng nếu kiểm chứng thất bại.

![Một lưu đồ. Nhận task, rồi đánh giá độ phức tạp, độ bất định và rủi ro bằng quy tắc, bộ phân loại hoặc model router, với ghi chú bên cạnh rằng router có thể sai và cần được đo. Rồi chọn một thiết lập được hỗ trợ, rẽ thành effort thấp cho việc thường lệ ít rủi ro, effort trung bình cho việc thông thường, và effort cao cho việc khó hoặc rủi ro cao. Mọi nhánh đều thực thi task rồi kiểm chứng kết quả. Đạt thì tới hoàn tất. Thất bại thì đi tới leo thang, thử lại, tăng effort hoặc thu thập bằng chứng, rồi quay lại thực thi.](../images/effort-adaptive-routing.svg "Định tuyến theo task, kiểm chứng kết quả và leo thang khi thất bại. Mũi tên nét đứt là vòng leo thang.")

Việc định tuyến có thể dùng quy tắc, bộ phân loại, router dựa trên model, hoặc chính sách dựa trên phản hồi.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Nghiên cứu về test-time compute cho thấy phân bổ nỗ lực inference một cách thích ứng theo từng prompt có thể vượt trội so với dùng đồng đều ([Snell và cộng sự, 2024](https://arxiv.org/abs/2408.03314)). Đó là lập luận ủng hộ phân bổ thích ứng nói chung, không phải lời hứa cho workload của bạn.

</div>

Hai lưu ý. Việc phân loại task có thể sai, nên hãy đánh giá router như mọi thành phần khác. Và chỉ dùng các mức effort mà model hay API đã chọn hỗ trợ.

## Đo xem effort cao hơn có thực sự giúp ích không

<p class="slide-kicker">Phần IV · Hệ thống production</p>

Hãy xây một bộ đánh giá đại diện cho workload thật của bạn, rồi so sánh các thiết lập mà model hỗ trợ trên các task tương đương trong điều kiện tương đương.

![Mẫu dashboard với biểu ngữ ghi đây là mẫu, không có số liệu đo. Chín ô trống chỉ có dấu gạch: tỷ lệ task thành công, tỷ lệ được chấp nhận sau kiểm chứng, tỷ lệ qua test, latency P50, latency P95, chi phí mỗi task thành công, số lần retry mỗi task, số tool call mỗi task và thời gian chạy tổng của agent. Bên dưới, biểu đồ thành công theo chi phí còn trống với các dấu giữ chỗ được ghi là không phải dữ liệu, và một checklist quy trình.](../images/effort-eval-dashboard.svg "Một mẫu, không phải kết quả. Mọi giá trị là dấu gạch vì ở đây không báo cáo thí nghiệm nào.")

| Chỉ số | Vì sao |
| --- | --- |
| Tỷ lệ task thành công và được chấp nhận sau kiểm chứng | Thứ bạn thực sự muốn |
| Tỷ lệ qua test | Một kiểm tra khách quan khi có test |
| Latency P50 và P95 | Trải nghiệm điển hình và trải nghiệm xấu nhất thực tế |
| Chi phí mỗi task *thành công* | Thất bại rẻ không phải là rẻ |
| Tần suất retry, số tool call, thời gian chạy tổng | Agent loop tốn của bạn những gì |

Model và agent không tất định, nên hãy chạy lặp nhiều lần và báo cáo độ phân tán, không phải một lần chạy. Đừng đánh giá thành công bằng độ dài câu trả lời hay số reasoning token: cả hai đo nỗ lực đã bỏ ra, không phải chất lượng đã đạt. Mọi con số bạn công bố nên đến từ một thí nghiệm có ghi chép; dashboard ở trên cố ý để trống.

## Biến reasoning effort thành một quyết định kỹ thuật tường minh

<p class="slide-kicker">Phần IV · Hệ thống production</p>

Khi nhà cung cấp hỗ trợ, effort là một tham số của request. Đây là một request OpenAI Responses API theo dạng được tài liệu hóa:

```javascript
const response = await client.responses.create({
  model: "gpt-6-astra",
  reasoning: {
    effort: "high", // thiết lập mà slide này nói tới
  },
  input: "Analyze this production bug...",
});

console.log(response.output_text);
```

<div class="callout documented">

<span class="label documented">Tài liệu</span> Tài liệu được kiểm tra ngày 22 tháng 10 năm 2026 cho thấy `reasoning: { effort: ... }` trên `responses.create`, liệt kê các giá trị `none`, `minimal`, `low`, `medium`, `high`, `xhigh` và `max`, và nêu rằng các giá trị được hỗ trợ phụ thuộc vào model: ví dụ GPT-6 Astra từ chối `none` bằng HTTP 400 ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)). Tên model ở đây là tên mà tài liệu dùng; tôi chưa chạy request này, nên hãy xác nhận model và các giá trị trên trang model của nó trước khi dựa vào.

</div>

Thiết lập này diễn đạt mức suy luận cần áp dụng. Nó không trả về suy luận riêng tư của model; chỉ có bản tóm tắt, tùy chọn bật thêm.

**Các nhà cung cấp khác đặt tên khác.** Không có định dạng chung:

| Nhà cung cấp | Tham số | Nguồn |
| --- | --- | --- |
| OpenAI (Responses API) | `reasoning: { effort }` | [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning) |
| Anthropic (Messages API) | `output_config: { effort }` | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) |
| Google (Gemini API) | `thinking_level` | [Thinking](https://ai.google.dev/gemini-api/docs/thinking) |

## Trước khi tăng thinking effort, hãy tự hỏi năm câu này

<p class="slide-kicker">Phần V · Điều rút ra áp dụng được</p>

<div class="checklist">

1. <strong>Task này có thực sự phức tạp hoặc bất định không?</strong><span>Nếu nó thường lệ và kiểm tra được, suy luận thêm chủ yếu chỉ tốn chi phí.</span>
2. <strong>Model đang gặp khó trong suy luận, hay thiếu thông tin quan trọng?</strong><span>Dữ kiện còn thiếu cần retrieval hoặc tool, không cần nghĩ thêm.</span>
3. <strong>Một tool khác hoặc một bước kiểm chứng có giúp nhiều hơn không?</strong><span>Một lần chạy test thường hơn thêm một đoạn cân nhắc.</span>
4. <strong>Mức cải thiện chất lượng kỳ vọng có đáng với latency và chi phí tăng thêm không?</strong><span>So sánh chi phí mỗi task thành công, không phải chi phí mỗi request.</span>
5. <strong>Tôi đã đo sự khác biệt trên các task thực tế đại diện chưa?</strong><span>Nếu chưa, hãy coi câu trả lời cho bốn câu còn lại là phỏng đoán.</span>

</div>

Hãy giữ nó như một thẻ quyết định dùng lại được: nếu bạn không trả lời "có" cho câu 1 và câu 5, có lẽ bạn chưa nên tăng thiết lập.

## Agent tốt nhất không phải là agent nghĩ nhiều nhất. Mà là agent phân bổ effort đúng chỗ cần thiết.

<p class="slide-kicker">Phần V · Điều rút ra áp dụng được</p>

![Một agent chọn giữa ba đường: đường nhanh đủ cho task dễ, đường cân nhắc được nhấn mạnh áp dụng suy luận ở nơi cần, và đường bằng chứng tìm kiếm, đọc và chạy. Đường được chọn đi qua cổng kiểm chứng tới kết quả.](../images/effort-closing-path.svg "Chọn đường mà task cần, rồi kiểm tra kết quả trước khi chấp nhận.")

1. Thinking effort có thể ảnh hưởng cách model xử lý một task. Nó không đảm bảo tính đúng đắn.
2. Suy luận, dùng tool, truy xuất context và kiểm chứng giải quyết những vấn đề *khác nhau*.
3. Cấu hình phù hợp đến từ việc đánh giá workload của chính bạn.

<p class="pull-question">Thay vì hỏi "Làm sao để AI nghĩ nhiều hơn?", hãy hỏi "Task này cần bao nhiêu suy luận để hoàn thành một cách đáng tin cậy?"</p>

### Tài liệu tham khảo và đọc thêm

- OpenAI, [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): `reasoning.effort`, reasoning token và bản tóm tắt.
- Anthropic, [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) và [Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost): các mức effort, adaptive thinking, thinking token và chi phí.
- Google, [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking): `thinking_level` và bản tóm tắt thought.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (tháng 12 năm 2024): workflow, agent và khi nào nên thêm độ phức tạp.
- Yao và cộng sự, [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (2022).
- Snell và cộng sự, [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters](https://arxiv.org/abs/2408.03314) (2024).
- Chen và cộng sự, [Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410) (2025).
