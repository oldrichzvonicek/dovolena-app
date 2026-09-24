import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dodio – dovolená bez tabulek a e-mailů";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          padding: 96,
          background: "#085041",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#0F9D7C",
              position: "relative",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -26,
                right: -26,
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#F0997B",
              }}
            />
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#FFFFFF" }}>dodio</div>
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, color: "#FFFFFF", maxWidth: 900, lineHeight: 1.1 }}>
          Dovolená bez tabulek a e‑mailů.
        </div>
        <div style={{ fontSize: 28, color: "#D7EEE6" }}>
          Správa dovolených a absencí pro malé a střední české firmy.
        </div>
      </div>
    ),
    { ...size }
  );
}
