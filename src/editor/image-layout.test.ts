import { getCoverImageCrop } from "@/editor/image-layout";

describe("图片裁切布局", () => {
  it("根据归一化焦点移动 cover 裁切区域", () => {
    expect(
      getCoverImageCrop({ height: 400, width: 800 }, { height: 300, width: 300 }, 0.8, 0.5),
    ).toEqual({
      height: 400,
      width: 400,
      x: 400,
      y: 0,
    });
  });

  it("把越界焦点限制在图片范围内", () => {
    expect(
      getCoverImageCrop({ height: 800, width: 400 }, { height: 200, width: 400 }, -1, 2),
    ).toEqual({
      height: 200,
      width: 400,
      x: 0,
      y: 600,
    });
  });
});
