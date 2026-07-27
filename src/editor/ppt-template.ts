import type {
  CanvasDocument,
  CanvasElement,
  ChartElement,
  CircleElement,
  GroupElement,
  ImageElement,
  LineElement,
  RectElement,
  TableCellStyle,
  TableElement,
  TextElement,
} from "@/editor/types";
import heroImageUrl from "../../mock/assets/11-symbicort-hero.webp";
import airwayMechanismUrl from "../../mock/assets/12-airway-mechanism.webp";
import ginaProtectionUrl from "../../mock/assets/13-gina-protection.webp";
import inhalerStepsUrl from "../../mock/assets/15-inhaler-steps.webp";
import followupReviewUrl from "../../mock/assets/16-followup-review.webp";
import urgentCareUrl from "../../mock/assets/17-urgent-care.webp";

const SLIDE_WIDTH = 1600;
const SLIDE_HEIGHT = 900;
const SLIDE_COUNT = 8;

const COLORS = {
  amber: "#d88a42",
  blue: "#5066a0",
  border: "#d7dedc",
  dark: "#142f36",
  green: "#25645f",
  ink: "#17323a",
  muted: "#5d7076",
  paleAmber: "#fbf1e7",
  paleBlue: "#eef1f8",
  paleGreen: "#eaf2f0",
  paleGray: "#f4f6f5",
  white: "#ffffff",
} as const;

type RectOptions = Partial<
  Pick<RectElement, "cornerRadius" | "locked" | "opacity" | "stroke" | "strokeWidth">
>;
type TextOptions = Partial<
  Pick<
    TextElement,
    | "align"
    | "fill"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "locked"
    | "opacity"
  >
>;

function rect(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  options: RectOptions = {},
): RectElement {
  return {
    cornerRadius: options.cornerRadius ?? 0,
    fill,
    height,
    id,
    locked: options.locked ?? false,
    name,
    opacity: options.opacity ?? 1,
    rotation: 0,
    stroke: options.stroke ?? "transparent",
    strokeWidth: options.strokeWidth ?? 0,
    type: "rect",
    visible: true,
    width,
    x,
    y,
  };
}

function text(
  id: string,
  name: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: TextOptions = {},
): TextElement {
  return {
    align: options.align ?? "left",
    fill: options.fill ?? COLORS.ink,
    fontFamily: options.fontFamily ?? "noto-sans-sc",
    fontSize: options.fontSize ?? 28,
    fontWeight: options.fontWeight ?? "400",
    height,
    id,
    lineHeight: options.lineHeight ?? 1.35,
    locked: options.locked ?? false,
    name,
    opacity: options.opacity ?? 1,
    rotation: 0,
    text: value,
    type: "text",
    visible: true,
    width,
    x,
    y,
  };
}

function image(
  id: string,
  name: string,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: ImageElement["fit"] = "cover",
): ImageElement {
  return {
    cornerRadius: 0,
    fit,
    height,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    src,
    type: "image",
    visible: true,
    width,
    x,
    y,
  };
}

function line(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  strokeWidth = 2,
): LineElement {
  return {
    height,
    id,
    lineCap: "round",
    locked: false,
    name,
    opacity: 1,
    points: [0, 0, width, height],
    rotation: 0,
    stroke,
    strokeWidth,
    type: "line",
    visible: true,
    width,
    x,
    y,
  };
}

function circle(
  id: string,
  name: string,
  x: number,
  y: number,
  diameter: number,
  fill: string,
): CircleElement {
  return {
    fill,
    height: diameter,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    stroke: COLORS.white,
    strokeWidth: 6,
    type: "circle",
    visible: true,
    width: diameter,
    x,
    y,
  };
}

function chart(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Pick<
    ChartElement,
    "chartType" | "colors" | "series" | "showLegend" | "showValue" | "title"
  >,
): ChartElement {
  return {
    ...options,
    height,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    type: "chart",
    visible: true,
    width,
    x,
    y,
  };
}

const TABLE_HEADER_STYLE: TableCellStyle = {
  align: "center",
  borderColor: COLORS.border,
  borderWidth: 1,
  color: COLORS.white,
  fill: COLORS.green,
  fontFamily: "noto-sans-sc",
  fontSize: 20,
  fontWeight: "700",
  valign: "middle",
};

const TABLE_CELL_STYLE: TableCellStyle = {
  align: "center",
  borderColor: COLORS.border,
  borderWidth: 1,
  color: COLORS.ink,
  fill: COLORS.white,
  fontFamily: "noto-sans-sc",
  fontSize: 18,
  fontWeight: "500",
  valign: "middle",
};

function table(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: TableElement["columns"],
  rows: TableElement["rows"],
): TableElement {
  return {
    cellStyle: TABLE_CELL_STYLE,
    columns,
    headerStyle: TABLE_HEADER_STYLE,
    height,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    rows,
    type: "table",
    visible: true,
    width,
    x,
    y,
  };
}

function group(slideNumber: number, name: string, children: CanvasElement[]): GroupElement {
  return {
    children,
    id: `ppt2-slide-${slideNumber}`,
    locked: false,
    name: `${String(slideNumber).padStart(2, "0")} ${name}`,
    type: "group",
    visible: true,
  };
}

function contentChrome(
  slideNumber: number,
  section: string,
  background: string = COLORS.white,
): CanvasElement[] {
  const top = 0;
  return [
    rect(
      `ppt2-s${slideNumber}-background`,
      "页面背景",
      0,
      top,
      SLIDE_WIDTH,
      SLIDE_HEIGHT,
      background,
      { locked: true },
    ),
    rect(`ppt2-s${slideNumber}-header-accent`, "页眉强调线", 96, top + 42, 46, 6, COLORS.green, {
      locked: true,
    }),
    text(
      `ppt2-s${slideNumber}-header-brand`,
      "页眉品牌",
      "AIRWAY CARE · CLINICAL CONVERSATION",
      158,
      top + 28,
      520,
      36,
      {
        fill: COLORS.green,
        fontFamily: "inter",
        fontSize: 21,
        fontWeight: "700",
        lineHeight: 1,
        locked: true,
      },
    ),
    text(`ppt2-s${slideNumber}-header-section`, "页眉章节", section, 1110, top + 28, 386, 36, {
      align: "right",
      fill: COLORS.muted,
      fontSize: 21,
      fontWeight: "600",
      lineHeight: 1,
      locked: true,
    }),
    line(
      `ppt2-s${slideNumber}-footer-line`,
      "页脚分隔线",
      96,
      top + 832,
      1400,
      0,
      COLORS.border,
      1,
    ),
    text(
      `ppt2-s${slideNumber}-footer-note`,
      "页脚说明",
      "哮喘长期管理沟通简报 · 演示内容仅作沟通示例",
      96,
      top + 846,
      900,
      28,
      {
        fill: COLORS.muted,
        fontSize: 19,
        lineHeight: 1,
        locked: true,
      },
    ),
    text(
      `ppt2-s${slideNumber}-footer-page`,
      "页码",
      `${String(slideNumber).padStart(2, "0")} / ${String(SLIDE_COUNT).padStart(2, "0")}`,
      1330,
      top + 846,
      166,
      28,
      {
        align: "right",
        fill: COLORS.green,
        fontFamily: "inter",
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 1,
        locked: true,
      },
    ),
  ];
}

function createWelcomeSlide(): GroupElement {
  const top = 0;
  return group(1, "欢迎页", [
    image("ppt2-s1-image", "欢迎页全幅背景图", heroImageUrl, 0, top, SLIDE_WIDTH, SLIDE_HEIGHT),
    rect("ppt2-s1-overlay", "背景暗化层", 0, top, SLIDE_WIDTH, SLIDE_HEIGHT, COLORS.dark, {
      locked: true,
      opacity: 0.34,
    }),
    rect("ppt2-s1-panel", "欢迎页文字底板", 0, top, 1030, SLIDE_HEIGHT, COLORS.dark, {
      locked: true,
      opacity: 0.94,
    }),
    rect("ppt2-s1-accent", "欢迎页强调线", 86, top + 154, 12, 540, COLORS.amber, {
      locked: true,
    }),
    text("ppt2-s1-brand", "欢迎页品牌", "AIRWAY CARE · 2026", 88, top + 72, 500, 40, {
      fill: "#b9d5d1",
      fontFamily: "inter",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 1,
    }),
    text("ppt2-s1-kicker", "欢迎页标签", "哮喘长期管理沟通简报", 138, top + 158, 620, 48, {
      fill: "#d4e6e3",
      fontSize: 28,
      fontWeight: "600",
      lineHeight: 1.1,
    }),
    text(
      "ppt2-s1-title",
      "欢迎页标题",
      "从“缓解症状”\n走向长期风险管理",
      132,
      top + 238,
      780,
      230,
      {
        fill: COLORS.white,
        fontSize: 86,
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    text(
      "ppt2-s1-subtitle",
      "欢迎页副标题",
      "把控制评估、规范用药、装置教育与随访闭环放进同一套沟通框架",
      138,
      top + 520,
      720,
      106,
      {
        fill: "#d6e5e3",
        fontSize: 32,
        lineHeight: 1.48,
      },
    ),
    text(
      "ppt2-s1-meta",
      "欢迎页信息",
      "面向患者教育与专业沟通场景  ·  可编辑演示模板",
      138,
      top + 706,
      760,
      42,
      {
        fill: "#9fc0bc",
        fontSize: 22,
        fontWeight: "500",
        lineHeight: 1,
      },
    ),
    text("ppt2-s1-page", "欢迎页页码", "01 / 08", 1380, top + 826, 120, 28, {
      align: "right",
      fill: COLORS.white,
      fontFamily: "inter",
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 1,
    }),
  ]);
}

function createAgendaSlide(): GroupElement {
  const top = 0;
  const rows = [
    ["01", "先识别风险", "为什么症状尚可，也不能等同于未来风险可控"],
    ["02", "再搭建路径", "如何把评估、教育、随访连接成可执行闭环"],
    ["03", "拆解沟通", "如何把专业信息转化为患者听得懂、做得到的行动"],
    ["04", "落到复诊", "如何用固定节奏检查疗效、技巧、依从与行动计划"],
  ] as const;

  return group(2, "议程", [
    ...contentChrome(2, "TODAY’S FOCUS / 今日议程", COLORS.paleGray),
    text("ppt2-s2-title", "议程标题", "今天只回答四个关键问题", 96, top + 112, 920, 88, {
      fontSize: 64,
      fontWeight: "800",
      lineHeight: 1.1,
    }),
    text(
      "ppt2-s2-lead",
      "议程引导",
      "从患者当下感受出发，最终落到下一次可验证的管理行动。",
      100,
      top + 208,
      920,
      52,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    image("ppt2-s2-image", "规范保护主题配图", ginaProtectionUrl, 1120, top + 282, 376, 438),
    rect("ppt2-s2-image-caption-bg", "配图说明底板", 1120, top + 650, 376, 70, COLORS.dark, {
      opacity: 0.9,
    }),
    text(
      "ppt2-s2-image-caption",
      "配图说明",
      "目标不是一次解释清楚，\n而是形成可持续的保护。",
      1146,
      top + 658,
      324,
      54,
      {
        fill: COLORS.white,
        fontSize: 22,
        fontWeight: "600",
        lineHeight: 1.25,
      },
    ),
    ...rows.flatMap(([number, title, description], index) => {
      const rowY = top + 300 + index * 120;
      return [
        text(`ppt2-s2-row-${index + 1}-number`, `议程 ${number}`, number, 100, rowY, 72, 54, {
          fill: index === 1 ? COLORS.amber : COLORS.green,
          fontFamily: "inter",
          fontSize: 42,
          fontWeight: "800",
          lineHeight: 1,
        }),
        text(`ppt2-s2-row-${index + 1}-title`, `${title}标题`, title, 194, rowY, 240, 50, {
          fontSize: 38,
          fontWeight: "700",
          lineHeight: 1.1,
        }),
        text(
          `ppt2-s2-row-${index + 1}-description`,
          `${title}说明`,
          description,
          454,
          rowY + 2,
          576,
          50,
          {
            fill: COLORS.muted,
            fontSize: 25,
            lineHeight: 1.3,
          },
        ),
        ...(index < rows.length - 1
          ? [
              line(
                `ppt2-s2-row-${index + 1}-divider`,
                "议程分隔线",
                100,
                rowY + 78,
                930,
                0,
                COLORS.border,
                1,
              ),
            ]
          : []),
      ];
    }),
  ]);
}

function createRiskSlide(): GroupElement {
  const top = 0;
  const columns = [
    {
      body: "夜间憋醒、活动受限、缓解药使用增多，都是控制正在波动的可见信号。",
      color: COLORS.green,
      fill: COLORS.paleGreen,
      label: "症状盲区",
      number: "01",
      x: 96,
    },
    {
      body: "既往急性发作、急诊或系统激素暴露，会改变对未来风险的判断。",
      color: COLORS.amber,
      fill: COLORS.paleAmber,
      label: "风险盲区",
      number: "02",
      x: 574,
    },
    {
      body: "认知、吸入技巧与复诊节奏任何一环断开，都可能让方案无法真正执行。",
      color: COLORS.blue,
      fill: COLORS.paleBlue,
      label: "执行盲区",
      number: "03",
      x: 1052,
    },
  ] as const;

  return group(3, "核心问题", [
    ...contentChrome(3, "RISK GAP / 风险差距"),
    text(
      "ppt2-s3-title",
      "核心问题标题",
      "患者感觉“还可以”，风险仍可能继续累积",
      96,
      top + 112,
      1240,
      90,
      {
        fontSize: 62,
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    text(
      "ppt2-s3-lead",
      "核心问题引导",
      "长期管理不能只问“今天难不难受”，还要同时看见未来风险与执行质量。",
      100,
      top + 210,
      1180,
      54,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    ...columns.flatMap(({ body, color, fill, label, number, x }) => [
      rect(`ppt2-s3-${number}-panel`, `${label}底板`, x, top + 308, 448, 324, fill, {
        cornerRadius: 24,
      }),
      rect(`ppt2-s3-${number}-accent`, `${label}强调线`, x, top + 308, 448, 12, color, {
        cornerRadius: 24,
      }),
      text(`ppt2-s3-${number}-number`, `${label}序号`, number, x + 34, top + 350, 100, 64, {
        fill: color,
        fontFamily: "inter",
        fontSize: 54,
        fontWeight: "800",
        lineHeight: 1,
      }),
      text(`ppt2-s3-${number}-title`, `${label}标题`, label, x + 34, top + 430, 360, 54, {
        fontSize: 40,
        fontWeight: "700",
        lineHeight: 1.1,
      }),
      text(`ppt2-s3-${number}-body`, `${label}说明`, body, x + 34, top + 502, 372, 98, {
        fill: COLORS.muted,
        fontSize: 26,
        lineHeight: 1.45,
      }),
    ]),
    rect("ppt2-s3-takeaway-bg", "核心结论底板", 96, top + 682, 1404, 104, COLORS.dark, {
      cornerRadius: 18,
    }),
    text("ppt2-s3-takeaway-label", "核心结论标签", "核心结论", 130, top + 710, 180, 48, {
      fill: "#9fc9c4",
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 1,
    }),
    text(
      "ppt2-s3-takeaway",
      "核心结论",
      "症状、风险与执行质量必须在同一次沟通中被共同评估。",
      330,
      top + 702,
      1110,
      60,
      {
        fill: COLORS.white,
        fontSize: 34,
        fontWeight: "600",
        lineHeight: 1.25,
      },
    ),
  ]);
}

function createPathSlide(): GroupElement {
  const top = 0;
  const steps = [
    {
      body: "确认症状控制、急性发作史、诱因暴露与合并问题",
      color: COLORS.green,
      label: "评估：先把现状看完整",
      y: 322,
    },
    {
      body: "解释长期管理目标，核对装置技巧，共同处理用药顾虑",
      color: COLORS.amber,
      label: "教育：把方案变成动作",
      y: 492,
    },
    {
      body: "约定记录方式、复诊节点、调整条件与急性加重行动计划",
      color: COLORS.blue,
      label: "随访：让下一步可追踪",
      y: 662,
    },
  ] as const;

  return group(4, "管理路径", [
    ...contentChrome(4, "MANAGEMENT PATH / 管理路径", COLORS.paleGray),
    text("ppt2-s4-title", "管理路径标题", "三步构建可执行的长期管理闭环", 96, top + 112, 1140, 88, {
      fontSize: 62,
      fontWeight: "800",
      lineHeight: 1.1,
    }),
    text(
      "ppt2-s4-lead",
      "管理路径引导",
      "每一步都要留下可观察、可复查、可调整的结果。",
      100,
      top + 208,
      900,
      54,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    image("ppt2-s4-image", "气道保护机制配图", airwayMechanismUrl, 96, top + 300, 500, 430),
    rect("ppt2-s4-image-caption-bg", "机制配图说明底板", 96, top + 666, 500, 64, COLORS.dark, {
      opacity: 0.92,
    }),
    text(
      "ppt2-s4-image-caption",
      "机制配图说明",
      "从气道炎症与保护机制解释长期管理的必要性",
      122,
      top + 678,
      448,
      40,
      {
        fill: COLORS.white,
        fontSize: 22,
        fontWeight: "600",
        lineHeight: 1.15,
      },
    ),
    line("ppt2-s4-path-line", "管理路径主线", 708, top + 334, 0, 366, "#a9b8b5", 4),
    ...steps.flatMap(({ body, color, label, y }, index) => [
      circle(`ppt2-s4-step-${index + 1}`, `${label}节点`, 680, top + y - 20, 56, color),
      text(
        `ppt2-s4-step-${index + 1}-number`,
        `${label}序号`,
        String(index + 1),
        680,
        top + y - 11,
        56,
        36,
        {
          align: "center",
          fill: COLORS.white,
          fontFamily: "inter",
          fontSize: 23,
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      text(`ppt2-s4-step-${index + 1}-title`, `${label}标题`, label, 780, top + y - 30, 660, 52, {
        fontSize: 40,
        fontWeight: "700",
        lineHeight: 1.12,
      }),
      text(`ppt2-s4-step-${index + 1}-body`, `${label}说明`, body, 780, top + y + 30, 670, 68, {
        fill: COLORS.muted,
        fontSize: 26,
        lineHeight: 1.4,
      }),
    ]),
  ]);
}

function createAssessmentSlide(): GroupElement {
  const top = 0;

  return group(5, "评估框架", [
    ...contentChrome(5, "ASSESSMENT / 评估框架"),
    text(
      "ppt2-s5-title",
      "评估框架标题",
      "同一组评估数据，可以从对比、趋势和构成三个角度解读",
      96,
      top + 112,
      1400,
      88,
      {
        fontSize: 54,
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    text(
      "ppt2-s5-lead",
      "评估框架引导",
      "柱状图回答“哪项更高”，折线图回答“如何变化”，饼图回答“由什么构成”。",
      100,
      top + 208,
      1320,
      52,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    chart("ppt2-s5-bar-chart", "评估维度柱状图", 72, top + 310, 456, 430, {
      chartType: "bar",
      colors: [COLORS.green, COLORS.amber, COLORS.blue],
      series: [
        {
          labels: ["症状控制", "未来风险", "吸入技巧", "随访执行"],
          name: "本次评估",
          values: [78, 54, 66, 72],
        },
      ],
      showLegend: false,
      showValue: true,
      title: "评估维度对比",
    }),
    chart("ppt2-s5-line-chart", "复诊趋势折线图", 572, top + 310, 456, 430, {
      chartType: "line",
      colors: [COLORS.green, COLORS.blue],
      series: [
        {
          labels: ["首次", "1–4 周", "8–12 周", "长期"],
          name: "症状控制",
          values: [52, 64, 71, 78],
        },
        {
          labels: ["首次", "1–4 周", "8–12 周", "长期"],
          name: "随访执行",
          values: [48, 58, 66, 72],
        },
      ],
      showLegend: true,
      showValue: false,
      title: "复诊趋势变化",
    }),
    chart("ppt2-s5-pie-chart", "管理障碍饼图", 1072, top + 310, 456, 430, {
      chartType: "pie",
      colors: [COLORS.green, COLORS.amber, COLORS.blue, "#7c6b8f"],
      series: [
        {
          labels: ["吸入技巧", "依从障碍", "环境暴露", "其他"],
          name: "管理障碍",
          values: [34, 29, 22, 15],
        },
      ],
      showLegend: true,
      showValue: true,
      title: "管理障碍构成",
    }),
    text(
      "ppt2-s5-takeaway",
      "图表选择提示",
      "图表类型应跟随问题，而不是跟随数据形式。",
      96,
      top + 762,
      1400,
      40,
      {
        align: "center",
        fill: COLORS.muted,
        fontSize: 24,
        fontWeight: "600",
        lineHeight: 1.2,
      },
    ),
  ]);
}

function createCommunicationSlide(): GroupElement {
  const top = 0;
  const modules = [
    ["01", "风险识别", "用患者熟悉的场景解释急性发作与高危信号。"],
    ["02", "治疗认知", "区分临时缓解与长期管理，回应真实顾虑。"],
    ["03", "装置教育", "演示、回示、纠错，确保步骤能够被复现。"],
    ["04", "随访闭环", "明确记录内容、复诊节点与何时需要提前就医。"],
  ] as const;

  return group(6, "沟通模块", [
    ...contentChrome(6, "COMMUNICATION / 沟通模块", COLORS.paleGray),
    text(
      "ppt2-s6-title",
      "沟通模块标题",
      "把医学信息拆成患者能理解、能记住、能执行的模块",
      96,
      top + 112,
      1370,
      88,
      {
        fontSize: 58,
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    text(
      "ppt2-s6-lead",
      "沟通模块引导",
      "每个模块只承担一个沟通任务，并以患者复述或演示作为确认。",
      100,
      top + 208,
      1080,
      52,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    image("ppt2-s6-image", "吸入装置教育配图", inhalerStepsUrl, 96, top + 304, 520, 428),
    rect("ppt2-s6-image-caption-bg", "装置教育配图说明底板", 96, top + 652, 520, 80, COLORS.dark, {
      opacity: 0.92,
    }),
    text(
      "ppt2-s6-image-caption",
      "装置教育配图说明",
      "讲解之后必须回到“请您再做一次”，\n才能确认信息真正转化为动作。",
      122,
      top + 662,
      468,
      62,
      {
        fill: COLORS.white,
        fontSize: 22,
        fontWeight: "600",
        lineHeight: 1.25,
      },
    ),
    ...modules.flatMap(([number, title, body], index) => {
      const rowY = top + 300 + index * 112;
      return [
        text(`ppt2-s6-module-${number}-number`, `${title}序号`, number, 694, rowY, 72, 48, {
          fill: index === 1 ? COLORS.amber : COLORS.green,
          fontFamily: "inter",
          fontSize: 36,
          fontWeight: "800",
          lineHeight: 1,
        }),
        text(`ppt2-s6-module-${number}-title`, `${title}标题`, title, 792, rowY - 4, 230, 48, {
          fontSize: 38,
          fontWeight: "700",
          lineHeight: 1.1,
        }),
        text(`ppt2-s6-module-${number}-body`, `${title}说明`, body, 1030, rowY - 1, 430, 58, {
          fill: COLORS.muted,
          fontSize: 24,
          lineHeight: 1.35,
        }),
        ...(index < modules.length - 1
          ? [
              line(
                `ppt2-s6-module-${number}-divider`,
                "沟通模块分隔线",
                694,
                rowY + 78,
                766,
                0,
                COLORS.border,
                1,
              ),
            ]
          : []),
      ];
    }),
  ]);
}

function createFollowupSlide(): GroupElement {
  const top = 0;
  const milestones = [
    {
      body: "确认目标与行动计划",
      color: COLORS.green,
      label: "今天",
      placement: "below",
      x: 170,
    },
    {
      body: "检查耐受、依从与装置技巧",
      color: COLORS.amber,
      label: "1–4 周",
      placement: "above",
      x: 565,
    },
    {
      body: "复评控制水平与风险变化",
      color: COLORS.blue,
      label: "8–12 周",
      placement: "below",
      x: 960,
    },
    {
      body: "持续记录，按条件提前复诊",
      color: "#7c6b8f",
      label: "长期",
      placement: "above",
      x: 1355,
    },
  ] as const;

  return group(7, "随访节奏", [
    ...contentChrome(7, "FOLLOW-UP / 随访节奏"),
    text("ppt2-s7-title", "随访节奏标题", "让管理延续到每一次复诊", 96, top + 112, 1020, 88, {
      fontSize: 60,
      fontWeight: "800",
      lineHeight: 1.12,
    }),
    text(
      "ppt2-s7-lead",
      "随访节奏引导",
      "固定检查四件事：疗效、风险、技巧、行动计划。",
      100,
      top + 208,
      900,
      52,
      {
        fill: COLORS.muted,
        fontSize: 29,
        lineHeight: 1.3,
      },
    ),
    image("ppt2-s7-image", "复诊沟通配图", followupReviewUrl, 1166, top + 106, 330, 210),
    line("ppt2-s7-timeline", "随访时间线", 170, top + 500, 1185, 0, "#a8b7b4", 4),
    ...milestones.flatMap(({ body, color, label, placement, x }, index) => {
      const labelY = placement === "above" ? 390 : 558;
      const bodyY = placement === "above" ? 326 : 620;
      return [
        circle(`ppt2-s7-milestone-${index + 1}`, `${label}节点`, x - 28, top + 472, 56, color),
        text(
          `ppt2-s7-milestone-${index + 1}-label`,
          `${label}标题`,
          label,
          x - 130,
          top + labelY,
          260,
          50,
          {
            align: "center",
            fill: color,
            fontSize: 36,
            fontWeight: "700",
            lineHeight: 1.1,
          },
        ),
        text(
          `ppt2-s7-milestone-${index + 1}-body`,
          `${label}说明`,
          body,
          x - 152,
          top + bodyY,
          304,
          68,
          {
            align: "center",
            fill: COLORS.muted,
            fontSize: 24,
            lineHeight: 1.35,
          },
        ),
      ];
    }),
    table(
      "ppt2-s7-followup-table",
      "复诊检查清单表格",
      96,
      top + 704,
      1400,
      110,
      [
        { id: "ppt2-s7-table-col-1", name: "复诊节点", width: 240 },
        { id: "ppt2-s7-table-col-2", name: "必须检查", width: 420 },
        { id: "ppt2-s7-table-col-3", name: "判断依据", width: 390 },
        { id: "ppt2-s7-table-col-4", name: "下一步", width: 350 },
      ],
      [
        {
          cells: {
            "ppt2-s7-table-col-1": "1–4 周",
            "ppt2-s7-table-col-2": "耐受、依从、吸入技巧",
            "ppt2-s7-table-col-3": "症状记录与回示动作",
            "ppt2-s7-table-col-4": "纠错并确认计划",
          },
          height: 34,
          id: "ppt2-s7-table-row-1",
        },
        {
          cells: {
            "ppt2-s7-table-col-1": "8–12 周",
            "ppt2-s7-table-col-2": "控制水平与风险变化",
            "ppt2-s7-table-col-3": "夜醒、活动、缓解药使用",
            "ppt2-s7-table-col-4": "评估是否调整",
          },
          height: 34,
          id: "ppt2-s7-table-row-2",
        },
      ],
    ),
  ]);
}

function createClosingSlide(): GroupElement {
  const top = 0;
  const takeaways = [
    ["看完整", "症状、风险、执行质量一起评估"],
    ["讲清楚", "每次只完成一个明确沟通任务"],
    ["跟下去", "用复诊与行动计划形成闭环"],
  ] as const;

  return group(8, "结束页", [
    image("ppt2-s8-image", "结束页全幅背景图", urgentCareUrl, 0, top, SLIDE_WIDTH, SLIDE_HEIGHT),
    rect("ppt2-s8-overlay", "结束页暗化层", 0, top, SLIDE_WIDTH, SLIDE_HEIGHT, COLORS.dark, {
      locked: true,
      opacity: 0.76,
    }),
    text("ppt2-s8-brand", "结束页品牌", "AIRWAY CARE · CLOSING", 96, top + 64, 560, 40, {
      fill: "#b9d5d1",
      fontFamily: "inter",
      fontSize: 23,
      fontWeight: "700",
      lineHeight: 1,
    }),
    rect("ppt2-s8-accent", "结束页强调线", 96, top + 142, 120, 8, COLORS.amber, {
      locked: true,
    }),
    text(
      "ppt2-s8-title",
      "结束页标题",
      "把每一次沟通，\n变成下一次更安全的呼吸",
      96,
      top + 190,
      1120,
      220,
      {
        fill: COLORS.white,
        fontSize: 84,
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    text(
      "ppt2-s8-subtitle",
      "结束页副标题",
      "从风险识别开始，以可执行的行动与可追踪的随访结束。",
      102,
      top + 444,
      1000,
      60,
      {
        fill: "#d7e6e3",
        fontSize: 32,
        lineHeight: 1.35,
      },
    ),
    ...takeaways.flatMap(([title, body], index) => {
      const x = 102 + index * 480;
      return [
        rect(
          `ppt2-s8-takeaway-${index + 1}-line`,
          `${title}强调线`,
          x,
          top + 594,
          72,
          6,
          index === 1 ? COLORS.amber : "#7fb4ae",
        ),
        text(`ppt2-s8-takeaway-${index + 1}-title`, `${title}标题`, title, x, top + 620, 200, 48, {
          fill: COLORS.white,
          fontSize: 36,
          fontWeight: "700",
          lineHeight: 1.1,
        }),
        text(`ppt2-s8-takeaway-${index + 1}-body`, `${title}说明`, body, x, top + 680, 382, 74, {
          fill: "#c7dad7",
          fontSize: 24,
          lineHeight: 1.35,
        }),
      ];
    }),
    text("ppt2-s8-next", "结束页行动提示", "讨论与下一步  /  Q&A", 96, top + 816, 500, 34, {
      fill: "#9fc0bc",
      fontFamily: "inter",
      fontSize: 21,
      fontWeight: "700",
      lineHeight: 1,
    }),
    text("ppt2-s8-page", "结束页页码", "08 / 08", 1360, top + 816, 140, 34, {
      align: "right",
      fill: COLORS.white,
      fontFamily: "inter",
      fontSize: 21,
      fontWeight: "700",
      lineHeight: 1,
    }),
  ]);
}

export const PPT_TEMPLATE_DOCUMENT: CanvasDocument = {
  description:
    "八页规范演示模板，包含欢迎页、议程、统一页眉页脚、内容页、随访页与结束页；顶层 group 对应导出的单页 slide。",
  documentType: "pptx",
  elements: [
    createWelcomeSlide(),
    createAgendaSlide(),
    createRiskSlide(),
    createPathSlide(),
    createAssessmentSlide(),
    createCommunicationSlide(),
    createFollowupSlide(),
    createClosingSlide(),
  ],
  height: SLIDE_HEIGHT,
  id: "ppt-template-2-medical-brief",
  name: "PPT模板2：哮喘长期管理沟通简报",
  width: SLIDE_WIDTH,
};
