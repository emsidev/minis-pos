import { ImageResponse } from "next/og"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at top, #ffd7ea 0%, #ff8ebf 42%, #e040a0 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "rgba(255,255,255,0.16)",
          border: "16px solid rgba(255,255,255,0.22)",
          borderRadius: 120,
          display: "flex",
          height: 296,
          justifyContent: "center",
          width: 296,
        }}
      >
        <div
          style={{
            fontSize: 162,
            fontWeight: 800,
            letterSpacing: -14,
            lineHeight: 1,
          }}
        >
          MP
        </div>
      </div>
      <div
        style={{
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: 10,
          marginTop: 32,
          textTransform: "uppercase",
        }}
      >
        POS
      </div>
    </div>,
    size
  )
}
