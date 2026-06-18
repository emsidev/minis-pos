import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "linear-gradient(180deg, #ffd6e7 0%, #ff9bc6 48%, #e040a0 100%)",
        borderRadius: 40,
        color: "#ffffff",
        display: "flex",
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
          border: "7px solid rgba(255,255,255,0.2)",
          borderRadius: 38,
          display: "flex",
          height: 112,
          justifyContent: "center",
          width: 112,
        }}
      >
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          MP
        </div>
      </div>
    </div>,
    size
  )
}
