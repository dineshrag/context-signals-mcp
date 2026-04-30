import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Next.js App",
  description: "Next.js App Router benchmark fixture",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  );
}