import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "น้องโจอา",
    short_name: "น้องโจอา",
    description: "ความทรงจำ ปฏิทิน และผู้ช่วยใน LINE ของคุณ",
    lang: "th",
    start_url: "/admin/chat",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5f3",
    theme_color: "#4f4038",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
