import { useMemo } from "react";
import {
  CanvasTexture,
  LinearFilter,
  LinearMipMapLinearFilter,
  SRGBColorSpace,
} from "three";
import { COLORS } from "../utils/animationMath.js";

function wrapText(context, text, maxWidth) {
  const manualLines = String(text).split("\n");
  const lines = [];

  manualLines.forEach((line) => {
    const words = line.split(" ");
    let current = "";

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (context.measureText(next).width <= maxWidth || !current) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    });

    if (current) {
      lines.push(current);
    }
  });

  return lines;
}

export default function TextPlane({
  children,
  text = children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 1,
  height = 0.34,
  color = COLORS.offBlack,
  opacity = 1,
  fontFamily = "Inter Tight, Manrope, Arial, sans-serif",
  fontWeight = 500,
  fontStyle = "normal",
  fontPx = 116,
  lineHeight = 0.92,
  align = "center",
  baseline = "middle",
  letterSpacing = 0,
  stroke = false,
  strokeWidth = 4,
  textShadow = true,
  shadowColor = "rgba(20, 17, 15, 0.16)",
  shadowBlur = 10,
  shadowOffsetX = 3,
  shadowOffsetY = 5,
  depthTest = true,
  renderOrder = 0,
}) {
  const texture = useMemo(() => {
    const ratio = Math.max(0.12, height / width);
    const canvas = document.createElement("canvas");
    canvas.width = 2200;
    canvas.height = Math.max(360, Math.round(canvas.width * ratio));

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = align;
    context.textBaseline = baseline;

    const maxTextWidth = canvas.width * 0.92;
    let resolvedFontPx = fontPx;
    let lines = [];

    for (let attempt = 0; attempt < 18; attempt += 1) {
      context.font = `${fontStyle} ${fontWeight} ${resolvedFontPx}px ${fontFamily}`;
      lines = wrapText(context, text, maxTextWidth);
      const widestLine = lines.reduce(
        (max, line) => Math.max(max, context.measureText(line).width),
        0,
      );
      const totalLineHeight = lines.length * resolvedFontPx * lineHeight;

      if (
        widestLine <= maxTextWidth &&
        totalLineHeight <= canvas.height * 0.9
      ) {
        break;
      }

      resolvedFontPx *= 0.92;
    }

    context.font = `${fontStyle} ${fontWeight} ${resolvedFontPx}px ${fontFamily}`;
    const supportsNativeLetterSpacing = "letterSpacing" in context;
    if (supportsNativeLetterSpacing) {
      context.letterSpacing = letterSpacing ? `${letterSpacing}px` : "0px";
    }
    if (stroke) {
      context.strokeStyle = color;
      context.lineWidth = strokeWidth;
      context.lineJoin = "round";
    }
    context.fillStyle = color;
    if (textShadow) {
      context.shadowColor = shadowColor;
      context.shadowBlur = shadowBlur;
      context.shadowOffsetX = shadowOffsetX;
      context.shadowOffsetY = shadowOffsetY;
    }
    const step = resolvedFontPx * lineHeight;
    const totalHeight = (lines.length - 1) * step;
    const x =
      align === "left" ? canvas.width * 0.04
      : align === "right" ? canvas.width * 0.96
      : canvas.width * 0.5;
    const yStart = canvas.height * 0.5 - totalHeight * 0.5;

    lines.forEach((line, lineIndex) => {
      const y = yStart + lineIndex * step;
      const draw = (value, cx, cy) => {
        if (stroke) {
          context.strokeText(value, cx, cy);
          context.shadowColor = "transparent";
          context.fillText(value, cx, cy);
          context.shadowColor = shadowColor;
          return;
        }
        context.fillText(value, cx, cy);
      };

      if (!letterSpacing || supportsNativeLetterSpacing) {
        draw(line, x, y);
        return;
      }

      const chars = line.split("");
      const rawWidth = chars.reduce((sum, char, index) => {
        const spacing = index === chars.length - 1 ? 0 : letterSpacing;
        return sum + context.measureText(char).width + spacing;
      }, 0);
      let cursor =
        align === "center" ? x - rawWidth / 2
        : align === "right" ? x - rawWidth
        : x;

      chars.forEach((char) => {
        draw(char, cursor, y);
        cursor += context.measureText(char).width + letterSpacing;
      });
    });

    const canvasTexture = new CanvasTexture(canvas);
    canvasTexture.colorSpace = SRGBColorSpace;
    canvasTexture.minFilter = LinearMipMapLinearFilter;
    canvasTexture.magFilter = LinearFilter;
    canvasTexture.anisotropy = 8;
    canvasTexture.generateMipmaps = true;
    canvasTexture.needsUpdate = true;
    return canvasTexture;
  }, [
    align,
    baseline,
    color,
    fontFamily,
    fontPx,
    fontStyle,
    fontWeight,
    height,
    letterSpacing,
    lineHeight,
    stroke,
    strokeWidth,
    textShadow,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    text,
    width,
  ]);

  return (
    <mesh position={position} rotation={rotation} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        alphaTest={0.01}
        depthWrite={false}
        depthTest={depthTest}
        fog={false}
      />
    </mesh>
  );
}
