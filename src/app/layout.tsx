import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "PP · เพื่อนอีกคนในกลุ่ม", description: "บอทตัวแทนของคุณ ความจำที่คุณเลือกแบ่งปัน", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
