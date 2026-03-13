import "./globals.css";

export const metadata = {
  title: "Unitech Cabels | Metal Price Intelligence",
  description: "Live metal price analytics, forecasts, and supplier intelligence for Unitech Cabels."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
