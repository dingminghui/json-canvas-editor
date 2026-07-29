# PPT Master 参考基线

本文固化此前对 PPT Master 的调研结果，供后续 AI PPT 设计与实现优先复用。后续判断以本文为本地研究缓存，不要求重新检查或比较远端仓库。

## 1. 基线信息

| 字段                  | 内容                                                   |
| --------------------- | ------------------------------------------------------ |
| 完整调研日期          | 2026-07-29                                             |
| 调研基线 commit       | `081e56323d0869c79913a5fb03405df1523ce49f`             |
| PPT Master Skill 版本 | `4.2.0`                                                |
| 结论适用范围          | PPT 内容规划、视觉规划、可编辑元素生成、模板与质量检查 |

### 1.1 已检查资料

本基线不是根据 README 推断，完整调研读取过以下类别的文件：

- `skills/ppt-master/SKILL.md`
- `docs/technical-design.md`
- `docs/templates-architecture.md`
- `skills/ppt-master/references/strategist.md`
- `skills/ppt-master/references/strategist-image.md`
- `skills/ppt-master/references/executor-web-image.md`
- `skills/ppt-master/references/image-searcher.md`
- `skills/ppt-master/references/image-layout-patterns.md`
- `skills/ppt-master/references/visual-review.md`
- `skills/ppt-master/templates/charts/README.md`
- `skills/ppt-master/templates/layouts/presentation_core/templates/design_spec.md`
- `examples/examples.json`
- `examples/ppt169_global_ai_capital_2026/design_spec.md`
- `examples/ppt169_global_ai_capital_2026/spec_lock.md`
- `examples/ppt169_indie_bookstore_zine_guide/design_spec.md`
- `examples/ppt169_indie_bookstore_zine_guide/spec_lock.md`
- Swiss Grid、AI Capital、Pritzker、Zine、Glassmorphism、Memphis 等示例预览

## 2. PPT Master 的核心实现逻辑

PPT Master 的关键价值不在某一种页面模板，而在于把演示文稿生成拆成有明确所有权的阶段，并让每个阶段产生可验证的中间产物。

```text
用户输入与来源材料
→ 来源归档、转换与事实充分性检查
→ Strategist：沟通目标、叙事与视觉方案
→ design_spec + spec_lock
→ 资源准备
→ Executor：逐页生成
→ 结构与视觉质量检查
→ 编译为原生 PPTX
→ 最终包与资源审计
```

### 2.1 先路由，再执行

PPT Master 先根据任务决定唯一工作流：

- 从主题或资料生成新 PPT。
- 从参考材料创建 Brand、Layout 或 Deck 模板工作区。
- 填充用户提供的原生 PPTX 模板。
- 在不重做版式的情况下增强既有 PPTX。

这些路线不会混在一起。新设计、模板填充和原生 OOXML 修改使用不同的实现边界。

可迁移原则：在生成前先判断任务是在“重建内容和设计”，还是“保留原文件结构并修改”，避免一个渲染器承担互相冲突的职责。

### 2.2 内容规划先于页面绘制

Strategist 先确认：

- 目标听众。
- 演示要促成的理解、判断或行动。
- 核心信息。
- 演示场景与交付后用途。
- 内容与来源材料的贴合程度。
- 叙事模式、阅读密度、页数和视觉方向。

随后形成完整的 `design_spec.md`，再提取供执行器使用的稳定约束到 `spec_lock.md`。

可迁移原则：

- 页面不是从一个“布局类型”开始，而是从一个“沟通任务”开始。
- 每页只承担一个叙事职责，并有一个主要结论。
- 视觉决策必须服务于内容关系，不能脱离内容随机挑模板。

### 2.3 规划产物与渲染产物分离

PPT Master 将以下内容分开保存：

- 来源事实与结构化分析。
- 沟通和设计规格。
- 已锁定的执行约束。
- 页面级视觉源文件。
- 验证报告。
- 最终 PPTX。

这种拆分让失败可以回到真正的上游修复。例如内容错误回到 Strategist，素材缺失回到资源准备，几何错误才由 Executor 修复。

可迁移原则：不要让最终 Canvas JSON 同时承担原始内容、视觉意图和渲染结果三个角色。

### 2.4 SVG 是它的页面设计中间语言

PPT Master 使用受限、项目自定义的 SVG 作为页面设计权威：

- AI 容易生成和阅读 SVG。
- SVG 与 PowerPoint DrawingML 都是绝对坐标的二维图形模型。
- SVG 可以在浏览器中预览和调试。
- 转换器只支持注册过的 SVG 子集，不接受任意 SVG。
- 最终由确定性转换器生成 DrawingML，而不是把整页 SVG 当图片嵌入。

重要边界：

- SVG 是 PPT Master 的工程选择，不是所有 PPT 项目的通用必选项。
- 提示词负责生成规范写法，质量检查器负责发现违规，转换器负责防御性校验和确定性转换。
- 能生成 PPTX 文件不代表质量检查已经通过。

### 2.5 Shape-first，而不是截图式 PPT

PPT Master 的图表、流程、架构和框架默认由独立形状组成：

- 基础节点、容器和直线关系使用普通矢量图元。
- 简单关系使用原生线条和箭头。
- 复杂形状优先使用 PowerPoint preset 或布尔组合。
- 手绘路径只用于确有必要的品牌轮廓、数据轮廓或特殊有机形状。
- 数据图表可以选择转成原生 PowerPoint Chart，但这是显式能力，不是默认承诺。

原生图表替换可能损失中心 KPI、自定义标注、固定轴范围或特殊拆分，因此需要同时检查“编辑性”和“视觉保真度”。

### 2.6 模板被拆成 Brand、Layout、Deck

PPT Master 将模板规则拆为三个平行维度：

| 类型   | 负责                                               | 不负责   |
| ------ | -------------------------------------------------- | -------- |
| Brand  | 颜色、字体、Logo、语气、图标风格                   | 页面结构 |
| Layout | 画布、页面类型、区域、语义文本角色、槽位与空间行为 | 品牌身份 |
| Deck   | 特定重复场景下整合后的身份、结构和应用语境         | —        |

可迁移原则：视觉主题和页面构图应该分层，避免把“蓝色商务风”和“三栏数据页”绑定成一个不可复用模板。

### 2.7 资源选择在执行器之前完成

图片、图标和图表模板由 Strategist 选择并登记，Executor 只负责几何、层级、留白和视觉实现。

Executor 不临时搜索、不临时生成、不擅自替换资源。资源不合适时返回上游重新选择。

这对无图片方案同样适用：确认“不使用图片”后，执行器应直接使用排版、数据与结构关系，不应添加装饰性占位图。

### 2.8 质量检查分为结构检查和视觉检查

PPT Master 的确定性检查关注：

- 画布越界。
- 文本和元素重叠。
- 缺失元素。
- 锚定页码、页眉、页脚的位置。
- 图片失真或丢失。
- 字体、颜色、SVG 语法和映射约束。

视觉检查关注：

- 视觉中心是否偏移。
- 对齐和网格是否漂移。
- 强调对象是否与页面结论一致。
- 页面节奏是否过密或过空。
- 强调色是否过多。
- 呼吸页是否退化成卡片网格。

首张页面会被当作方法样本检查，整套生成完成后再做一次全量检查。修复必须可回滚，不能用局部修复破坏全局设计约束。

## 3. 对本项目最有价值的设计原则

### 3.1 三层数据模型

本项目对应关系如下：

| PPT Master                   | 本项目                                              |
| ---------------------------- | --------------------------------------------------- |
| 来源与事实分析               | `PptMaterialPlan`                                   |
| 页面内容计划                 | `PptStructure` + `evidenceRefs`                     |
| `design_spec` 与页面视觉决策 | `PptVisualPlan`                                     |
| 页面 SVG                     | `CanvasDocument`                                    |
| SVG → DrawingML 转换器       | Canvas 元素 → PptxGenJS                             |
| SVG 质量报告                 | Zod 校验、结构问题检查、画布越界测试、PPTX 解包测试 |

本项目已经采用：

```text
PptMaterialPlan
→ PptStructure
→ PptVisualPlan
→ CanvasDocument
→ 编辑器
→ PPTX
```

内容结构是事实源，视觉计划只保存视觉意图，Canvas 文档是可编辑渲染产物。

### 3.2 内容关系决定主视觉

推荐的确定性映射：

| 内容关系     | 优先视觉                         |
| ------------ | -------------------------------- |
| 数值比较     | 柱状图或横向条形图               |
| 时间变化     | 折线图                           |
| 构成占比     | 饼图或环形图                     |
| 流程、因果   | 节点与箭头                       |
| 层级         | 层级关系图                       |
| 系统关系     | 中心节点与卫星节点               |
| 少量关键指标 | 大数字主指标页                   |
| 方案差异     | 非对称双栏或对比结构             |
| 行动顺序     | 编号流程                         |
| 精确查阅     | 原生表格                         |
| 单一观点     | 大标题、引语或留白陈述页         |
| 多段普通内容 | 编辑式纵向流；卡片网格只作为备选 |

### 3.3 统一设计系统，变化页面轮廓

整套 PPT 应保持：

- 稳定的颜色角色。
- 稳定的标题、正文和数字字体。
- 稳定的页边距、页眉、页脚与页码。
- 稳定的形状语言和线条语义。

同时让相邻页面在轮廓上发生变化：

- `anchor`：标准信息锚点页。
- `dense`：高密度分析页。
- `breathing`：低密度结论或转场页。
- `editorial-flow`：编辑式纵向内容流。
- `asymmetric-split`：非对称主次分栏。
- `centered-statement`：中心陈述。
- `modular-grid`：确有并列关系时使用模块网格。
- `data-led`：数据占据主导面积。
- `relationship-led`：关系结构占据主导面积。

连续三页不应同时重复同一构图和版式变体。

### 3.4 无图片不等于无主视觉

没有图片时，主视觉可以来自：

- 文字尺度差。
- 大数字。
- 数据图表。
- 关系图。
- 色块与留白。
- 非对称布局。
- 编号与阅读路径。
- 表格中的局部强调。
- 页面之间的疏密变化。

图片只在能够提供真实证据、场景、人物、产品或难以用原生元素表达的视觉信息时使用。纯装饰图片不应成为解决“页面单调”的默认手段。

## 4. 不应直接照搬的部分

### 4.1 不引入 SVG 编译链

本项目已经拥有 JSON Canvas 元素模型、Konva 编辑器和 PptxGenJS 导出器。再加入 SVG 作为第二套页面权威会产生：

- Canvas 与 SVG 双向同步。
- 两套元素 schema。
- 两套预览和坐标系统。
- SVG 到 Canvas 或 DrawingML 的额外转换层。
- 更复杂的错误定位和版本迁移。

因此本项目继续以 `CanvasDocument` 作为页面可编辑中间表示。

### 4.2 不复制文件型项目工作区

PPT Master 使用 `sources/`、`analysis/`、`svg_output/`、`validation/` 和 `exports/` 等文件目录。当前产品是浏览器本地应用，使用结构化 JSON 与 localStorage 更符合现有架构。

只有未来出现服务端任务、文件批处理、团队协作或可恢复长任务时，才需要重新评估文件型工作区。

### 4.3 不复制多角色运行时

本项目当前的两个 Skill 已足够表达：

- 结构生成。
- 视觉计划与画布生成。

无需照搬 Strategist、Image Searcher、Executor、Reviewer 等完整角色切换协议。应迁移职责边界，而不是复制全部运行仪式。

### 4.4 不默认依赖图片

PPT Master 对图片搜索、生成、裁切和溯源有完整流程，但本项目当前选择原生可编辑、无图片优先的路线。

未来增加图片能力时，也应把图片选择放在视觉规划阶段，并让画布渲染器只消费已经确认的资源。

### 4.5 暂不实现原生 PPTX 模板填充

当前编辑器生成自己的 `CanvasDocument`，并不保留用户 PPTX 的 Master、Layout、Placeholder 或 OOXML 身份。原生模板填充与原生增强应被视为独立产品能力，不能伪装成现有画布导出的一种参数。

## 5. 当前实现映射

| 关注点               | 本项目入口                                           |
| -------------------- | ---------------------------------------------------- |
| 内容与视觉 schema    | `src/features/ai-ppt/schema.ts`                      |
| PPT 结构生成 Skill   | `skills/generate-ppt-structure/`                     |
| 视觉计划与画布 Skill | `skills/render-ppt-canvas/`                          |
| Canvas 元素工厂      | `src/features/ai-ppt/render/canvas-factories.ts`     |
| 确定性页面渲染       | `src/features/ai-ppt/render/render-ppt-structure.ts` |
| 提纲与语义数据编辑   | `src/pages/AiPptOutlinePage.tsx`                     |
| 视觉产物版本和兼容   | `src/features/ai-ppt/canvas-storage.ts`              |
| PPTX 原生元素导出    | `src/editor/pptx-export.ts`                          |

## 6. 后续使用规则

处理新的 PPT 生成需求时：

1. 先读本文，不要重新读取或比较远端 PPT Master 仓库。
2. 将本文记录的原则与本项目当前架构进行比较，并结合具体需求独立判断。
3. 只有用户明确要求重新调研 PPT Master 时，才访问远端资料并决定是否更新本文。

## 7. 当前推荐方案

本项目继续坚持以下路线：

```text
材料事实与确认方向
→ 语义内容结构
→ 页面级视觉计划
→ 确定性 Canvas 原生元素
→ 人工可编辑
→ 原生 PPTX 导出
```

优先完善语义块、视觉节奏、版式变化、质量检查和原生元素覆盖率。图片、SVG 编译链和原生 PPTX 模板填充只有在真实需求出现时再作为独立能力设计。
