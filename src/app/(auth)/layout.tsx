export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">AI CRM Agent</span>
        </div>
        {children}
      </div>
    </div>
  );
}
