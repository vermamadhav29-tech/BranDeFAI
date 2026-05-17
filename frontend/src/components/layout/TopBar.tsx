"use client";

export default function TopBar() {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-100">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">Credits: —</span>
        <div className="w-8 h-8 rounded-full bg-[#1A7A4A] flex items-center justify-center text-white text-sm font-bold">
          U
        </div>
      </div>
    </header>
  );
}
