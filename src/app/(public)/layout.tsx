import { PublicNavbar } from "@/components/shared/public-navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNavbar />
      {children}
    </>
  );
}
